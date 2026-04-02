export interface User {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  employeeNo: string;
  department: string;
  designation: string;
  userType: 'EMPLOYEE' | 'CONTRACTOR' | 'VENDOR' | 'SERVICE';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  locale: string;
  timezone: string;
  createdAt: string;
  updatedAt?: string;
}
