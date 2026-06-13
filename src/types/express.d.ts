/**
 * Augmented Express Request type.
 * Injected by authenticate and tenantContext middleware.
 */
declare global {
  namespace Express {
    interface Request {
      /** Authenticated user context — set by authenticate middleware */
      user?: {
        id: string;
        tenantId: string;
        shopId: string;
        email: string;
        permissions: string[];
      };

      /** Tenant/Shop ID — set by tenantContext middleware */
      tenantId?: string;
      shopId?: string;

      /** Unique request correlation ID — set by requestId middleware */
      requestId?: string;
    }
  }
}

export {};
