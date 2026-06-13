import { PrismaClient } from '@prisma/client';
import { productionConfig } from '@/config/production';
import { env } from '@/env';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: [...productionConfig.prismaLogLevels],
  });

if (env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
