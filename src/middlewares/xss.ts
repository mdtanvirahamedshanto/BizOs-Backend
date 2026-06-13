import type { Request, Response, NextFunction } from 'express';

/**
 * Clean string of script tags, inline event handlers, and javascript: protocols.
 */
function cleanXss(val: any): any {
  if (typeof val === 'string') {
    return val
      .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '') // Remove <script> blocks
      .replace(/on\w+\s*=\s*"[^"]*"/gi, '') // Remove onload="..."
      .replace(/on\w+\s*=\s*'[^']*'/gi, '')
      .replace(/on\w+\s*=\s*\S+/gi, '')
      .replace(/javascript:\s*[^"'\s>]+/gi, ''); // Remove javascript:...
  }

  if (Array.isArray(val)) {
    return val.map(cleanXss);
  }

  if (val !== null && typeof val === 'object') {
    const cleaned: Record<string, any> = {};
    for (const key of Object.keys(val)) {
      cleaned[key] = cleanXss(val[key]);
    }
    return cleaned;
  }

  return val;
}

/**
 * XSS Input Sanitization Middleware.
 * Recursively scans and cleans req.body, req.query, and req.params of malicious scripts.
 */
export function xssSanitizer(req: Request, _res: Response, next: NextFunction): void {
  if (req.body) req.body = cleanXss(req.body);
  if (req.query) req.query = cleanXss(req.query);
  if (req.params) req.params = cleanXss(req.params);
  next();
}
