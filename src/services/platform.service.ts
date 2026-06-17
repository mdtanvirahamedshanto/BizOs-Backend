import os from 'os';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { prisma } from '@/prisma/client';
import { redis } from '@/config/redis';
import { env } from '@/env';
import { logger } from '@/config/logger';
import { AppError, NotFoundError, ValidationError } from '@/utils/errors';

/** A dependency probe result. */
interface ServiceProbe {
  ok: boolean;
  latencyMs: number | null;
  error?: string;
}

export interface BackupFileInfo {
  name: string;
  sizeBytes: number;
  createdAt: string;
}

// Backup filenames are tightly constrained to prevent path traversal.
const BACKUP_NAME_RE = /^bizos-backup-[\w.-]+\.sql$/;

/**
 * PlatformService — the cross-tenant control plane for the software owner.
 * Provides: system health (DB/Redis/process), platform-wide usage statistics,
 * and a PostgreSQL backup system (pg_dump → local file with retention).
 */
export class PlatformService {
  // ── System health ─────────────────────────────────────────────────────────

  private async probeDatabase(): Promise<ServiceProbe> {
    const start = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { ok: false, latencyMs: null, error: (err as Error).message };
    }
  }

  private async probeRedis(): Promise<ServiceProbe> {
    const start = Date.now();
    try {
      const pong = await redis.ping();
      return { ok: pong === 'PONG', latencyMs: Date.now() - start };
    } catch (err) {
      return { ok: false, latencyMs: null, error: (err as Error).message };
    }
  }

  async getHealth() {
    const [database, redisProbe] = await Promise.all([this.probeDatabase(), this.probeRedis()]);

    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    const status = database.ok && redisProbe.ok ? 'healthy' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      services: {
        database,
        redis: redisProbe,
      },
      system: {
        environment: env.NODE_ENV,
        nodeVersion: process.version,
        platform: os.platform(),
        pid: process.pid,
        cpuCount: os.cpus().length,
        loadAverage: os.loadavg(), // [1m, 5m, 15m] — 0 on Windows
        memory: {
          rssBytes: mem.rss,
          heapUsedBytes: mem.heapUsed,
          heapTotalBytes: mem.heapTotal,
          systemTotalBytes: totalMem,
          systemFreeBytes: freeMem,
          systemUsedPct: Math.round(((totalMem - freeMem) / totalMem) * 100),
        },
      },
    };
  }

  // ── Platform-wide usage statistics (cross-tenant) ───────────────────────────

  async getStats() {
    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      shopsByStatus,
      shopsByPlan,
      totalShops,
      newShops7,
      newShops30,
      activeUsers,
      totalUsers,
      totalProducts,
      lowStockRows,
      totalCustomers,
      totalSuppliers,
      salesAgg,
      totalSales,
      sales7Agg,
      purchasesAgg,
      expensesAgg,
      khataReceivable,
      khataPayable,
      signupTrend,
      salesTrend,
    ] = await Promise.all([
      prisma.shop.groupBy({ by: ['status'], _count: true, where: { deletedAt: null } }),
      prisma.shop.groupBy({ by: ['plan'], _count: true, where: { deletedAt: null } }),
      prisma.shop.count({ where: { deletedAt: null } }),
      prisma.shop.count({ where: { deletedAt: null, createdAt: { gte: since7 } } }),
      prisma.shop.count({ where: { deletedAt: null, createdAt: { gte: since30 } } }),
      prisma.user.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.product.count({ where: { deletedAt: null } }),
      prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM products
        WHERE deleted_at IS NULL AND stock_quantity <= low_stock_threshold`,
      prisma.customer.count({ where: { deletedAt: null } }),
      prisma.supplier.count({ where: { deletedAt: null } }),
      prisma.sale.aggregate({
        _sum: { totalCents: true },
        _count: true,
        where: { status: 'COMPLETED', deletedAt: null },
      }),
      prisma.sale.count({ where: { deletedAt: null } }),
      prisma.sale.aggregate({
        _sum: { totalCents: true },
        _count: true,
        where: { status: 'COMPLETED', deletedAt: null, saleDate: { gte: since7 } },
      }),
      prisma.purchase.aggregate({ _sum: { totalCents: true }, _count: true, where: { deletedAt: null } }),
      prisma.expense.aggregate({ _sum: { amountCents: true }, where: { deletedAt: null } }),
      prisma.khataAccount.aggregate({
        _sum: { balanceCents: true },
        where: { partyType: 'CUSTOMER', balanceCents: { gt: 0 }, isActive: true },
      }),
      prisma.khataAccount.aggregate({
        _sum: { balanceCents: true },
        where: { partyType: 'SUPPLIER', balanceCents: { lt: 0 }, isActive: true },
      }),
      prisma.$queryRaw<{ day: string; count: number }[]>`
        SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
        FROM shops
        WHERE deleted_at IS NULL AND created_at >= now() - interval '14 days'
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ day: string; count: number; revenue: number }[]>`
        SELECT to_char(date_trunc('day', sale_date), 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS count,
               COALESCE(SUM(total_cents), 0)::float8 AS revenue
        FROM sales
        WHERE deleted_at IS NULL AND status = 'COMPLETED' AND sale_date >= now() - interval '14 days'
        GROUP BY 1 ORDER BY 1`,
    ]);

    const statusCount = (s: string) =>
      shopsByStatus.find((r) => r.status === s)?._count ?? 0;

    const planMap: Record<string, number> = {};
    for (const row of shopsByPlan) planMap[row.plan] = row._count;

    return {
      generatedAt: new Date().toISOString(),
      shops: {
        total: totalShops,
        active: statusCount('ACTIVE'),
        trial: statusCount('TRIAL'),
        suspended: statusCount('SUSPENDED'),
        cancelled: statusCount('CANCELLED'),
        newLast7Days: newShops7,
        newLast30Days: newShops30,
        byPlan: {
          FREE: planMap.FREE ?? 0,
          STARTER: planMap.STARTER ?? 0,
          PROFESSIONAL: planMap.PROFESSIONAL ?? 0,
          ENTERPRISE: planMap.ENTERPRISE ?? 0,
        },
      },
      users: { total: totalUsers, active: activeUsers },
      catalog: { products: totalProducts, lowStock: lowStockRows[0]?.count ?? 0 },
      parties: { customers: totalCustomers, suppliers: totalSuppliers },
      sales: {
        total: totalSales,
        completed: salesAgg._count,
        revenueCents: salesAgg._sum.totalCents ?? 0,
        last7DaysCount: sales7Agg._count,
        last7DaysRevenueCents: sales7Agg._sum.totalCents ?? 0,
      },
      purchases: {
        total: purchasesAgg._count,
        totalCents: purchasesAgg._sum.totalCents ?? 0,
      },
      finance: {
        expensesCents: expensesAgg._sum.amountCents ?? 0,
        khataReceivableCents: khataReceivable._sum.balanceCents ?? 0,
        khataPayableCents: Math.abs(khataPayable._sum.balanceCents ?? 0),
      },
      trends: {
        signups: signupTrend.map((r) => ({ day: r.day, count: r.count })),
        sales: salesTrend.map((r) => ({
          day: r.day,
          count: r.count,
          revenueCents: Math.round(r.revenue),
        })),
      },
    };
  }

  // ── Database backups ────────────────────────────────────────────────────────

  private getBackupDir(): string {
    return env.BACKUP_DIR ? path.resolve(env.BACKUP_DIR) : path.join(process.cwd(), 'backups');
  }

  private resolveBackupPath(name: string): string {
    if (!BACKUP_NAME_RE.test(name)) {
      throw new ValidationError('Invalid backup file name');
    }
    const dir = this.getBackupDir();
    const resolved = path.resolve(dir, name);
    // Defense-in-depth against path traversal.
    if (path.dirname(resolved) !== dir) {
      throw new ValidationError('Invalid backup file path');
    }
    return resolved;
  }

  async listBackups(): Promise<BackupFileInfo[]> {
    const dir = this.getBackupDir();
    if (!fs.existsSync(dir)) return [];

    const files = await fs.promises.readdir(dir);
    const infos: BackupFileInfo[] = [];
    for (const name of files) {
      if (!BACKUP_NAME_RE.test(name)) continue;
      const stat = await fs.promises.stat(path.join(dir, name));
      infos.push({ name, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() });
    }
    return infos.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getBackupFilePath(name: string): string {
    const resolved = this.resolveBackupPath(name);
    if (!fs.existsSync(resolved)) {
      throw new NotFoundError('Backup file');
    }
    return resolved;
  }

  async deleteBackup(name: string): Promise<void> {
    const resolved = this.getBackupFilePath(name);
    await fs.promises.unlink(resolved);
  }

  /** Parse DATABASE_URL into pg_dump connection parameters. */
  private parseDatabaseUrl() {
    const url = new URL(env.DATABASE_URL);
    return {
      host: url.hostname,
      port: url.port || '5432',
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ''),
    };
  }

  /** Delete backups beyond the configured retention count (keeps the newest). */
  private async enforceRetention(): Promise<void> {
    const backups = await this.listBackups(); // newest first
    const stale = backups.slice(env.BACKUP_RETENTION_COUNT);
    for (const file of stale) {
      try {
        await fs.promises.unlink(path.join(this.getBackupDir(), file.name));
      } catch (err) {
        logger.warn({ err, file: file.name }, 'Failed to prune old backup');
      }
    }
  }

  async createBackup(triggeredBy?: string): Promise<BackupFileInfo & { durationMs: number }> {
    const dir = this.getBackupDir();
    await fs.promises.mkdir(dir, { recursive: true });

    const conn = this.parseDatabaseUrl();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = `bizos-backup-${stamp}.sql`;
    const filePath = path.join(dir, name);

    const args = [
      '--no-owner',
      '--no-privileges',
      '--clean',
      '--if-exists',
      '-h',
      conn.host,
      '-p',
      conn.port,
      '-U',
      conn.user,
      '-d',
      conn.database,
      '-f',
      filePath,
    ];

    const start = Date.now();
    logger.info({ triggeredBy, name }, 'Starting database backup');

    await new Promise<void>((resolve, reject) => {
      const child = spawn(env.PG_DUMP_PATH, args, {
        env: { ...process.env, PGPASSWORD: conn.password },
      });

      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          reject(
            new AppError(
              `pg_dump executable not found ("${env.PG_DUMP_PATH}"). Install PostgreSQL client tools or set PG_DUMP_PATH to its absolute path.`,
              500,
              'PG_DUMP_NOT_FOUND',
            ),
          );
          return;
        }
        reject(new AppError(`Backup process failed: ${err.message}`, 500, 'BACKUP_FAILED'));
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          // Clean up a partial/empty dump so it is not listed as a valid backup.
          fs.promises.unlink(filePath).catch(() => undefined);
          reject(
            new AppError(
              `pg_dump exited with code ${code}: ${stderr.trim() || 'unknown error'}`,
              500,
              'BACKUP_FAILED',
            ),
          );
        }
      });
    });

    const stat = await fs.promises.stat(filePath);
    await this.enforceRetention();

    logger.info({ name, sizeBytes: stat.size }, 'Database backup completed');

    return {
      name,
      sizeBytes: stat.size,
      createdAt: stat.mtime.toISOString(),
      durationMs: Date.now() - start,
    };
  }
}
