export interface Group {
  id: string;
  tenantId: string;
  groupCode: string;
  groupName: string;
  description: string;
  groupType: 'STATIC' | 'DYNAMIC';
  dynamicRule?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt?: string;
}
