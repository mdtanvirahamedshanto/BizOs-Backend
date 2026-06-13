import { AppError } from './AppError';

export class DatabaseError extends AppError {
  constructor(message: string, details?: Record<string, unknown>[]) {
    super(message, 400, 'DATABASE_ERROR', true, details);
  }
}
