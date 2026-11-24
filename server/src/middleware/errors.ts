import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { HttpError } from '../lib/http-error';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof HttpError) return response.status(error.status).json({ error: error.message, ...(error.details ? { details: error.details } : {}) });
  if (error instanceof ZodError) return response.status(400).json({ error: 'Validation failed', message: error.issues.map((issue) => `${issue.path.join('.') || 'request'}: ${issue.message}`).join('; '), details: error.flatten() });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return response.status(409).json({ error: 'A record with this value already exists' });
    if (error.code === 'P2025') return response.status(404).json({ error: 'Requested record was not found' });
    if (error.code === 'P2000') return response.status(400).json({ error: 'One of the submitted values is too long', code: 'VALUE_TOO_LONG' });
  }
  console.error(error);
  return response.status(500).json({ error: 'Internal server error', ...(process.env.NODE_ENV === 'production' ? {} : { details: error instanceof Error ? error.message : String(error) }) });
};
