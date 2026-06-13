import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';

import { corsOptions } from '@/config/cors';
import { env } from '@/env';
import { errorHandler, requestLogger, rateLimiter, xssSanitizer, csrfProtection, requestId } from '@/middlewares';

// Import Routes
import apiRouter from '@/routes';
import { createDocsRouter } from '@/routes/docs.routes';

const app = express();

// ─── Security & Utility Middlewares ───────────────────────
app.use(
  helmet({
    contentSecurityPolicy: env.ENABLE_SWAGGER
      ? false
      : {
          directives: {
            defaultSrc: ["'none'"],
            frameAncestors: ["'none'"],
            sandbox: ['allow-forms', 'allow-same-origin', 'allow-scripts'],
          },
        },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'deny' },
  }),
);
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: env.JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: env.JSON_BODY_LIMIT }));
app.use(cookieParser());

// ─── Request Logging ──────────────────────────────────────
app.use(requestId);
app.use(requestLogger);
app.use(rateLimiter);
app.use(xssSanitizer);
app.use(csrfProtection);

// ─── Routes ───────────────────────────────────────────────
// Health Check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

if (env.ENABLE_SWAGGER) {
  app.use('/api/v1/docs', createDocsRouter());
}

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
