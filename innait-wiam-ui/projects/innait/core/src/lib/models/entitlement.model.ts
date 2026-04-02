export interface Entitlement {
  id: string;
  tenantId: string;
  entitlementCode: string;
  entitlementName: string;
  resource: string;
  action: 'READ' | 'WRITE' | 'DELETE' | 'EXECUTE' | 'ADMIN';
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt?: string;
}
