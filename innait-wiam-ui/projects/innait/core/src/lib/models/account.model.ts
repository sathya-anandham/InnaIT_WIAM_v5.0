export interface Account {
  id: string;
  tenantId: string;
  userId: string;
  loginId: string;
  accountStatus: 'ACTIVE' | 'LOCKED' | 'DISABLED' | 'PENDING_ACTIVATION' | 'EXPIRED';
  passwordEnabled: boolean;
  fidoEnabled: boolean;
  totpEnabled: boolean;
  softtokenEnabled: boolean;
  failedAttemptCount: number;
  mustChangePassword: boolean;
  lastLoginAt?: string;
  passwordExpiresAt?: string;
  createdAt: string;
  updatedAt?: string;
}
