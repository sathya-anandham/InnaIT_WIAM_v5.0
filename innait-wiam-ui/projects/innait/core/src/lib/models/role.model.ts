export interface Role {
  id: string;
  tenantId: string;
  roleCode: string;
  roleName: string;
  description: string;
  roleType: 'SYSTEM' | 'TENANT' | 'APPLICATION';
  system: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt?: string;
}
