import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';

const secret = process.env.JWT_SECRET || 'development-only-secret';

type Claims = { sub: string; role: UserRole };

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) return response.status(401).json({ error: 'Authentication required' });
  try {
    const claims = jwt.verify(token, secret) as Claims;
    const user = await prisma.user.findUnique({ where: { id: claims.sub }, select: { role: true, status: true } });
    if (!user || user.status !== 'ACTIVE') return response.status(401).json({ error: 'Account access has been revoked or suspended' });
    request.user = { id: claims.sub, role: user.role };
    next();
  } catch {
    return response.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function optionalAuth(request: Request, response: Response, next: NextFunction) {
  if (!request.headers.authorization) return next();
  return requireAuth(request, response, next);
}

export function requireRole(...roles: UserRole[]) {
  return (request: Request, response: Response, next: NextFunction) => {
    const staffRoles: UserRole[] = ['STAFF', 'FINANCE_MANAGER', 'OPERATIONS_MANAGER', 'SUPPORT_AGENT', 'WAREHOUSE_STAFF'];
    const matches = roles.includes(request.user?.role as UserRole)
      || (roles.includes('ADMIN') && request.user?.role === 'SUPER_ADMIN')
      || (roles.includes('STAFF') && staffRoles.includes(request.user?.role as UserRole));
    if (!request.user || !matches) return response.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
}
