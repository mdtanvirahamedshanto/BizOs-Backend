import { env } from '@/env';

const bearerAuth = { BearerAuth: [] as string[] };
const csrfHeader = { CsrfToken: [] as string[] };

const successEnvelope = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: { type: 'object' },
  },
};

const errorEnvelope = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
};

function paginatedList(description: string) {
  return {
    get: {
      tags: [description],
      summary: `List ${description}`,
      security: [bearerAuth],
      parameters: [
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 25 } },
        { name: 'cursor', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        '200': { description: 'Paginated list', content: { 'application/json': { schema: successEnvelope } } },
        '401': { description: 'Unauthorized', content: { 'application/json': { schema: errorEnvelope } } },
      },
    },
  };
}

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'BizOS API',
    version: '1.0.0',
    description:
      'BizOS — SaaS Business Operating System API for small retail/trade businesses. All protected routes require JWT Bearer auth and tenant context from the token.',
  },
  servers: [{ url: `${env.APP_URL}/api/v1`, description: 'API v1' }],
  tags: [
    { name: 'Auth', description: 'Authentication and session management' },
    { name: 'Shops', description: 'Shop profile and settings' },
    { name: 'Customers', description: 'Customer CRM' },
    { name: 'Suppliers', description: 'Supplier CRM' },
    { name: 'Products', description: 'Inventory products and categories' },
    { name: 'Sales', description: 'Sales and returns' },
    { name: 'Payments', description: 'Payment ledger' },
    { name: 'Purchases', description: 'Purchase orders' },
    { name: 'Khata', description: 'Credit/debit ledger' },
    { name: 'Expenses', description: 'Daily and recurring expenses' },
    { name: 'Cashbook', description: 'Cash in/out and daily closing' },
    { name: 'MFS', description: 'Mobile financial services accounts' },
    { name: 'Flexiload', description: 'Flexiload recharge accounts' },
    { name: 'Reports', description: 'Reports and dashboard analytics' },
    { name: 'Telegram', description: 'Telegram bot linking' },
    { name: 'Audit', description: 'Immutable audit trail' },
    { name: 'Uploads', description: 'S3-compatible file storage' },
    { name: 'System', description: 'Health and status' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token from /auth/login or /auth/register',
      },
      CsrfToken: {
        type: 'apiKey',
        in: 'header',
        name: 'X-CSRF-Token',
        description: 'Required for mutating requests when CSRF protection is enabled',
      },
    },
    schemas: {
      SuccessResponse: successEnvelope,
      ErrorResponse: errorEnvelope,
      AuditLog: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          shopId: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid', nullable: true },
          action: { type: 'string', example: 'sale.created' },
          entity: { type: 'string', nullable: true },
          entityId: { type: 'string', format: 'uuid', nullable: true },
          oldValues: { type: 'object', nullable: true },
          newValues: { type: 'object', nullable: true },
          ipAddress: { type: 'string', nullable: true },
          userAgent: { type: 'string', nullable: true },
          metadata: { type: 'object', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      UploadedFile: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          bucket: { type: 'string' },
          mimeType: { type: 'string' },
          size: { type: 'integer' },
          originalName: { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/status': {
      get: {
        tags: ['System'],
        summary: 'API status',
        responses: {
          '200': { description: 'Operational', content: { 'application/json': { schema: successEnvelope } } },
        },
      },
    },

    '/auth/csrf': {
      get: { tags: ['Auth'], summary: 'Get CSRF token', responses: { '200': { description: 'CSRF token' } } },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register shop and owner',
        security: [csrfHeader],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['shopName', 'name', 'email', 'password'],
                properties: {
                  shopName: { type: 'string' },
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Registered' }, '400': { description: 'Validation error' } },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login with email and password',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Auth tokens' } },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh access token',
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string' } } },
            },
          },
        },
        responses: { '200': { description: 'New tokens' } },
      },
    },
    '/auth/logout': {
      post: { tags: ['Auth'], summary: 'Logout', security: [bearerAuth], responses: { '204': { description: 'Logged out' } } },
    },
    '/auth/me': {
      get: { tags: ['Auth'], summary: 'Current user profile', security: [bearerAuth], responses: { '200': { description: 'User profile' } } },
    },

    '/shops/{id}': {
      get: {
        tags: ['Shops'],
        summary: 'Get shop by ID',
        security: [bearerAuth],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Shop details' } },
      },
      put: {
        tags: ['Shops'],
        summary: 'Update shop',
        security: [bearerAuth, csrfHeader],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Updated shop' } },
      },
      delete: {
        tags: ['Shops'],
        summary: 'Soft delete shop',
        security: [bearerAuth, csrfHeader],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '204': { description: 'Deleted' } },
      },
    },

    '/customers': paginatedList('Customers'),
    '/customers/{id}': {
      get: {
        tags: ['Customers'],
        summary: 'Get customer',
        security: [bearerAuth],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Customer' } },
      },
    },

    '/products': paginatedList('Products'),
    '/sales': {
      ...paginatedList('Sales'),
      post: {
        tags: ['Sales'],
        summary: 'Create sale',
        security: [bearerAuth, csrfHeader],
        responses: { '201': { description: 'Sale created' } },
      },
    },
    '/sales/{id}': {
      get: {
        tags: ['Sales'],
        summary: 'Get sale',
        security: [bearerAuth],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Sale' } },
      },
    },
    '/sales/{id}/return': {
      post: {
        tags: ['Sales'],
        summary: 'Process sale return',
        security: [bearerAuth, csrfHeader],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Return processed' } },
      },
    },

    '/payments': paginatedList('Payments'),
    '/purchases': paginatedList('Purchases'),
    '/khata': paginatedList('Khata'),
    '/khata/due-summary': {
      get: { tags: ['Khata'], summary: 'Due summary', security: [bearerAuth], responses: { '200': { description: 'Summary' } } },
    },
    '/expenses': paginatedList('Expenses'),
    '/cashbook': paginatedList('Cashbook'),
    '/cashbook/closing-preview': {
      get: { tags: ['Cashbook'], summary: 'Daily closing preview', security: [bearerAuth], responses: { '200': { description: 'Preview' } } },
    },
    '/mfs/accounts': paginatedList('MFS'),
    '/flexiload/accounts': paginatedList('Flexiload'),

    '/reports/dashboard': {
      get: {
        tags: ['Reports'],
        summary: 'Dashboard metrics',
        security: [bearerAuth],
        parameters: [
          {
            name: 'timeframe',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'this_year', 'custom'],
              default: 'this_month',
            },
          },
        ],
        responses: { '200': { description: 'Dashboard KPIs and trends' } },
      },
    },
    '/reports/daily-sales': {
      get: { tags: ['Reports'], summary: 'Daily sales report', security: [bearerAuth], responses: { '200': { description: 'Report' } } },
    },
    '/reports/monthly-sales': {
      get: { tags: ['Reports'], summary: 'Monthly sales report', security: [bearerAuth], responses: { '200': { description: 'Report' } } },
    },
    '/reports/profit': {
      get: { tags: ['Reports'], summary: 'Profit report', security: [bearerAuth], responses: { '200': { description: 'Report' } } },
    },
    '/reports/inventory': {
      get: { tags: ['Reports'], summary: 'Inventory valuation report', security: [bearerAuth], responses: { '200': { description: 'Report' } } },
    },
    '/reports/dues': {
      get: { tags: ['Reports'], summary: 'Khata dues report', security: [bearerAuth], responses: { '200': { description: 'Report' } } },
    },
    '/reports/generate': {
      post: {
        tags: ['Reports'],
        summary: 'Queue async report generation',
        security: [bearerAuth, csrfHeader],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['reportType'],
                properties: {
                  reportType: {
                    type: 'string',
                    enum: ['daily_sales', 'monthly_sales', 'profit', 'inventory', 'dues'],
                  },
                  parameters: { type: 'object' },
                },
              },
            },
          },
        },
        responses: { '202': { description: 'Report queued' } },
      },
    },

    '/telegram/link': {
      post: {
        tags: ['Telegram'],
        summary: 'Generate Telegram link token',
        security: [bearerAuth, csrfHeader],
        responses: { '201': { description: 'Link token and deep link' } },
      },
      get: {
        tags: ['Telegram'],
        summary: 'Get Telegram link status',
        security: [bearerAuth],
        responses: { '200': { description: 'Link status' } },
      },
      delete: {
        tags: ['Telegram'],
        summary: 'Unlink Telegram account',
        security: [bearerAuth, csrfHeader],
        responses: { '204': { description: 'Unlinked' } },
      },
    },

    '/audit': {
      get: {
        tags: ['Audit'],
        summary: 'List audit logs',
        security: [bearerAuth],
        parameters: [
          { name: 'action', in: 'query', schema: { type: 'string' } },
          { name: 'entity', in: 'query', schema: { type: 'string' } },
          { name: 'entityId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'userId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 25 } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Paginated audit logs',
            content: { 'application/json': { schema: successEnvelope } },
          },
        },
      },
    },
    '/audit/actions': {
      get: {
        tags: ['Audit'],
        summary: 'List distinct audit actions for the shop',
        security: [bearerAuth],
        responses: { '200': { description: 'Action strings' } },
      },
    },
    '/audit/{id}': {
      get: {
        tags: ['Audit'],
        summary: 'Get audit log by ID',
        security: [bearerAuth],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': {
            description: 'Audit log entry',
            content: { 'application/json': { schema: { allOf: [successEnvelope, { properties: { data: { $ref: '#/components/schemas/AuditLog' } } }] } } },
          },
        },
      },
    },

    '/uploads/status': {
      get: {
        tags: ['Uploads'],
        summary: 'Check storage configuration status',
        security: [bearerAuth],
        responses: { '200': { description: 'Storage status' } },
      },
    },
    '/uploads': {
      post: {
        tags: ['Uploads'],
        summary: 'Upload a file to S3-compatible storage',
        security: [bearerAuth, csrfHeader],
        parameters: [
          {
            name: 'folder',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['products', 'receipts', 'avatars', 'documents', 'attachments'],
              default: 'documents',
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Uploaded file metadata',
            content: { 'application/json': { schema: { properties: { data: { $ref: '#/components/schemas/UploadedFile' } } } } },
          },
        },
      },
      delete: {
        tags: ['Uploads'],
        summary: 'Delete an uploaded file by storage key',
        security: [bearerAuth, csrfHeader],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['key'], properties: { key: { type: 'string' } } },
            },
          },
        },
        responses: { '204': { description: 'Deleted' } },
      },
    },
    '/uploads/presign': {
      get: {
        tags: ['Uploads'],
        summary: 'Get presigned download URL',
        security: [bearerAuth],
        parameters: [
          { name: 'key', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'expiresIn', in: 'query', schema: { type: 'integer', default: 3600 } },
        ],
        responses: { '200': { description: 'Presigned URL' } },
      },
    },
  },
} as const;

export type OpenApiSpec = typeof openApiSpec;
