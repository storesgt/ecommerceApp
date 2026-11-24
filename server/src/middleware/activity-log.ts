import type { NextFunction, Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const sensitiveKeys = new Set(['password', 'passwordHash', 'secretKey', 'clientSecret', 'webhookSecret', 'token', 'authorization']);

function safeBody(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
  return Object.fromEntries(Object.entries(body as Record<string, unknown>).map(([key, value]) => [key, sensitiveKeys.has(key) ? '[REDACTED]' : Array.isArray(value) ? `[${value.length} items]` : typeof value === 'object' && value !== null ? '[object]' : value]));
}

export function recordActivity(request: Request, response: Response, next: NextFunction) {
  if (!request.path.startsWith('/api/v1/') || !mutatingMethods.has(request.method)) return next();
  response.on('finish', () => {
    const actor = request.user;
    if (!actor) return;
    const path = request.path.replace(/\/[a-z0-9]{20,}/gi, '/:id').replace(/\/[A-Z0-9_-]{8,}/g, '/:reference');
    const metadata = JSON.parse(JSON.stringify({ path, method: request.method, statusCode: response.statusCode, body: safeBody(request.body) })) as Prisma.InputJsonValue;
    void prisma.auditLog.create({ data: { userId: actor.id, action: `API_${request.method}`, entity: path.split('/')[3] || 'API', entityId: null, metadata } }).catch((error) => console.error('Activity audit write failed:', error));
  });
  next();
}
