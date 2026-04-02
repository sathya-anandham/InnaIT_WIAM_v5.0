export interface Session {
  sessionId: string;
  accountId: string;
  tenantId: string;
  authMethodsUsed: string[];
  acrLevel: number;
  sessionType: 'INTERACTIVE' | 'API' | 'SERVICE';
  ipAddress: string;
  userAgent: string;
  active: boolean;
  createdAt: string;
  expiresAt: string;
  lastActivityAt?: string;
}
