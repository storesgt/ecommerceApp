import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';

export type Permission =
  | 'products.read' | 'products.create' | 'products.update' | 'products.delete'
  | 'orders.read' | 'orders.update' | 'orders.cancel' | 'orders.refund'
  | 'inventory.read' | 'inventory.update' | 'coupons.read' | 'coupons.manage' | 'reports.read'
  | 'settings.update' | 'users.read' | 'users.manage' | 'reviews.moderate'
  | 'finance.ledger' | 'finance.payouts' | 'finance.tax_reports'
  | 'payments.credentials' | 'security.manage' | 'database.manage' | 'staff.roles'
  | 'customer.pii' | 'customer.pii_export' | 'shipping.update' | 'shipping.packing_slips';

export const allPermissions: Permission[] = [
  'products.read', 'products.create', 'products.update', 'products.delete',
  'orders.read', 'orders.update', 'orders.cancel', 'orders.refund',
  'inventory.read', 'inventory.update', 'coupons.read', 'coupons.manage', 'reports.read',
  'settings.update', 'users.read', 'users.manage', 'reviews.moderate',
  'finance.ledger', 'finance.payouts', 'finance.tax_reports', 'payments.credentials',
  'security.manage', 'database.manage', 'staff.roles', 'customer.pii',
  'customer.pii_export', 'shipping.update', 'shipping.packing_slips'
];

export const rolePermissions: Record<UserRole, Set<Permission>> = {
  CUSTOMER: new Set(['products.read', 'orders.read', 'orders.cancel']),
  ADMIN: new Set(allPermissions),
  SUPER_ADMIN: new Set(allPermissions),
  STAFF: new Set(['products.read', 'orders.read', 'orders.update', 'orders.cancel', 'inventory.read', 'coupons.read', 'reports.read', 'reviews.moderate', 'users.read']),

  FINANCE_MANAGER: new Set(['orders.read', 'orders.refund', 'finance.ledger', 'finance.payouts', 'finance.tax_reports', 'coupons.read', 'reports.read']),
  OPERATIONS_MANAGER: new Set(['products.read', 'products.create', 'products.update', 'products.delete', 'inventory.read', 'inventory.update', 'orders.read', 'orders.update', 'shipping.update', 'coupons.read', 'reports.read']),
  SUPPORT_AGENT: new Set(['orders.read', 'orders.cancel', 'orders.refund', 'shipping.update', 'coupons.read', 'users.read']),
  WAREHOUSE_STAFF: new Set(['orders.read', 'shipping.update', 'shipping.packing_slips', 'inventory.read', 'coupons.read'])
};

export function roleHasPermission(role: UserRole, permission: Permission) {
  return rolePermissions[role]?.has(permission) || false;
}

export function requirePermission(permission: Permission) {
  return async (request: Request, response: Response, next: NextFunction) => {
    if (!request.user) return response.status(403).json({ error: `Missing permission: ${permission}` });
    const staffForbiddenPermissions: Permission[] = ['products.create', 'products.update', 'products.delete', 'inventory.update'];
    if (request.user.role === 'STAFF' && staffForbiddenPermissions.includes(permission)) return response.status(403).json({ error: 'Staff accounts cannot modify products or inventory', code: 'STAFF_CATALOG_WRITE_FORBIDDEN' });
    const staffReadPermissions: Permission[] = ['products.read', 'orders.read', 'inventory.read', 'coupons.read', 'users.read', 'reports.read'];
    if (request.user.role === 'STAFF' && !staffReadPermissions.includes(permission)) {
      const kyc = await prisma.kycApplication.findUnique({ where: { userId: request.user.id }, select: { status: true } });
      if (kyc?.status !== 'APPROVED') return response.status(403).json({ error: 'KYC approval is required before staff can perform this activity', code: 'STAFF_KYC_REQUIRED', kycStatus: kyc?.status || 'NOT_SUBMITTED' });
    }
    const override = await prisma.userPermission.findUnique({ where: { userId_permission: { userId: request.user.id, permission } } });
    const allowed = override ? override.granted : roleHasPermission(request.user.role, permission);
    if (!allowed) return response.status(403).json({ error: `Missing permission: ${permission}` });
    next();
  };
}
