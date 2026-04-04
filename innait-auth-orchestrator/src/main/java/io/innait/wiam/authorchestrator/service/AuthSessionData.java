package io.innait.wiam.authorchestrator.service;

import io.innait.wiam.authorchestrator.statemachine.AuthState;

import java.io.Serializable;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Auth transaction state cached in Redis for fast access.
 * Serialized as JSON via Jackson.
 */
public class AuthSessionData implements Serializable {

    private UUID txnId;
    private UUID accountId;
    private UUID tenantId;
    private String loginId;
    private AuthState currentState;
    private boolean mfaRequired;
    private int failedPrimaryAttempts;
    private int failedMfaAttempts;
    private int maxPrimaryAttempts;
    private int maxMfaAttempts;
    private List<String> authMethodsUsed = new ArrayList<>();
    private List<String> availablePrimaryMethods = new ArrayList<>();
    private List<String> availableMfaMethods = new ArrayList<>();
    private Instant startedAt;
    private Instant expiresAt;
    private boolean bootstrapFlow;
    private UUID bootstrapSessionId;

    public AuthSessionData() {
    }

    // Getters and setters

    public UUID getTxnId() { return txnId; }
    public void setTxnId(UUID txnId) { this.txnId = txnId; }

    public UUID getAccountId() { return accountId; }
    public void setAccountId(UUID accountId) { this.accountId = accountId; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public String getLoginId() { return loginId; }
    public void setLoginId(String loginId) { this.loginId = loginId; }

    public AuthState getCurrentState() { return currentState; }
    public void setCurrentState(AuthState currentState) { this.currentState = currentState; }

    public boolean isMfaRequired() { return mfaRequired; }
    public void setMfaRequired(boolean mfaRequired) { this.mfaRequired = mfaRequired; }

    public int getFailedPrimaryAttempts() { return failedPrimaryAttempts; }
    public void setFailedPrimaryAttempts(int failedPrimaryAttempts) { this.failedPrimaryAttempts = failedPrimaryAttempts; }

    public int getFailedMfaAttempts() { return failedMfaAttempts; }
    public void setFailedMfaAttempts(int failedMfaAttempts) { this.failedMfaAttempts = failedMfaAttempts; }

    public int getMaxPrimaryAttempts() { return maxPrimaryAttempts; }
    public void setMaxPrimaryAttempts(int maxPrimaryAttempts) { this.maxPrimaryAttempts = maxPrimaryAttempts; }

    public int getMaxMfaAttempts() { return maxMfaAttempts; }
    public void setMaxMfaAttempts(int maxMfaAttempts) { this.maxMfaAttempts = maxMfaAttempts; }

    public List<String> getAuthMethodsUsed() { return authMethodsUsed; }
    public void setAuthMethodsUsed(List<String> authMethodsUsed) { this.authMethodsUsed = authMethodsUsed; }

    public List<String> getAvailablePrimaryMethods() { return availablePrimaryMethods; }
    public void setAvailablePrimaryMethods(List<String> availablePrimaryMethods) { this.availablePrimaryMethods = availablePrimaryMethods; }

    public List<String> getAvailableMfaMethods() { return availableMfaMethods; }
    public void setAvailableMfaMethods(List<String> availableMfaMethods) { this.availableMfaMethods = availableMfaMethods; }

    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }

    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }

    public boolean isBootstrapFlow() { return bootstrapFlow; }
    public void setBootstrapFlow(boolean bootstrapFlow) { this.bootstrapFlow = bootstrapFlow; }

    public UUID getBootstrapSessionId() { return bootstrapSessionId; }
    public void setBootstrapSessionId(UUID bootstrapSessionId) { this.bootstrapSessionId = bootstrapSessionId; }
}
