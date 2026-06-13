import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from '@/config/openapi';

export function createDocsRouter(): Router {
  const router = Router();

  router.get('/openapi.json', (_req, res) => {
    res.json(openApiSpec);
  });

  router.use(
    '/',
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      customSiteTitle: 'BizOS API Docs',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
      },
    }),
  );

  return router;
}
