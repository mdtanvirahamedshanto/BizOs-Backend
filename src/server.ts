import { createServer } from 'http';
import { app } from '@/app';
import { env } from '@/env';
import { logger } from '@/config/logger';
import { prisma } from '@/prisma/client';
import { closeAllQueues } from '@/config/bull';
import { redis } from '@/config/redis';
import { createSocketServer } from '@/config/socket';
import { setSocketServer } from '@/config/socketInstance';
import { registerSocketNamespaces } from '@/sockets/registerNamespaces';
import { registerEventHandlers } from '@/events/eventHandlers';
import { registerSocketBroadcaster } from '@/events/socketBroadcaster';

const PORT = env.PORT || 3000;

async function bootstrap() {
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL via Prisma');

    registerEventHandlers();

    app.set('trust proxy', 1);
    const httpServer = createServer(app);
    const io = createSocketServer(httpServer);
    setSocketServer(io);
    registerSocketNamespaces(io);
    registerSocketBroadcaster(io);

    httpServer.listen(PORT, () => {
      logger.info(`Server is running in ${env.NODE_ENV} mode on port ${PORT}`);
    });

    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received. Shutting down gracefully...`);

      httpServer.close(async () => {
        logger.info('HTTP server closed.');

        try {
          io.close();
          await closeAllQueues();
          await prisma.$disconnect();
          await redis.quit();

          logger.info('All resources disconnected successfully. Exiting.');
          process.exit(0);
        } catch (err) {
          logger.error({ err }, 'Error during graceful shutdown');
          process.exit(1);
        }
      });

      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

bootstrap();
