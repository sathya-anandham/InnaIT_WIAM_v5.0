export type AuthStatus = 'UNAUTHENTICATED' | 'AUTHENTICATING' | 'MFA_REQUIRED' | 'AUTHENTICATED' | 'SESSION_EXPIRED';

export interface AuthState {
  status: AuthStatus;
  txnId?: string;
  accountId?: string;
  userId?: string;
  loginId?: string;
  displayName?: string;
  roles: string[];
  groups: string[];
  amr: string[];
  acr: string;
  sessionId?: string;
  availableMfaMethods?: string[];
}

export const INITIAL_AUTH_STATE: AuthState = {
  status: 'UNAUTHENTICATED',
  roles: [],
  groups: [],
  amr: [],
  acr: '',
};
