import { app } from '@/app';
import { env } from '@/env';
import { logger } from '@/config/logger';
import { prisma } from '@/prisma/client';
import { closeAllQueues } from '@/config/bull';
import { redis } from '@/config/redis';

const PORT = env.PORT || 3000;

async function bootstrap() {
  try {
    // Test DB Connection
    await prisma.$connect();
    logger.info('Connected to PostgreSQL via Prisma');

    // Start Express Server
    const server = app.listen(PORT, () => {
      logger.info(`Server is running in ${env.NODE_ENV} mode on port ${PORT}`);
    });

    // Graceful Shutdown Handler
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      
      server.close(async () => {
        logger.info('HTTP server closed.');
        
        try {
          // Close resources
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

      // Force shutdown if it takes too long
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    // Listen for termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

bootstrap();
