export interface AuditEvent {
  id: string;
  tenantId: string;
  eventType: string;
  actorId: string;
  actorType: 'USER' | 'SYSTEM' | 'SERVICE';
  targetId?: string;
  targetType?: string;
  outcome: 'SUCCESS' | 'FAILURE';
  ipAddress: string;
  userAgent: string;
  details?: Record<string, string>;
  timestamp: string;
}
