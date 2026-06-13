import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';

import { env } from '@/env';
import { logger } from '@/config/logger';
import { errorHandler } from '@/middlewares/errorHandler';
import { rateLimiter } from '@/middlewares/rateLimiter';

// Import Routes
import apiRouter from '@/routes';

const app = express();

// ─── Security & Utility Middlewares ───────────────────────
app.use(helmet());
app.use(cors({ origin: env.APP_URL, credentials: true }));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(rateLimiter);

// ─── Request Logging ──────────────────────────────────────
app.use((req, _res, next) => {
  logger.info({
    method: req.method,
    url: req.url,
    ip: req.ip,
  }, 'Incoming request');
  next();
});

// ─── Routes ───────────────────────────────────────────────
// Health Check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// API Router
app.use('/api/v1', apiRouter);

// ─── Error Handling ───────────────────────────────────────
// Catch 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', message: `Route ${req.method} ${req.url} not found` });
});

// Global Error Handler
app.use(errorHandler);

export { app };
