package io.innait.wiam.credentialservice.service;

import io.innait.wiam.common.constant.CredentialStatus;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.exception.ResourceNotFoundException;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.kafka.InnaITTopics;
import io.innait.wiam.credentialservice.entity.HashAlgorithm;
import io.innait.wiam.credentialservice.entity.PasswordCredential;
import io.innait.wiam.credentialservice.entity.PasswordHistory;
import io.innait.wiam.credentialservice.entity.PasswordPolicy;
import io.innait.wiam.credentialservice.repository.PasswordCredentialRepository;
import io.innait.wiam.credentialservice.repository.PasswordHistoryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional
public class PasswordCredentialService {

    private static final Logger log = LoggerFactory.getLogger(PasswordCredentialService.class);

    private final PasswordCredentialRepository credentialRepository;
    private final PasswordHistoryRepository historyRepository;
    private final PasswordPolicyService policyService;
    private final EventPublisher eventPublisher;

    // Argon2id: memory=65536KB (64MB), iterations=3, parallelism=4, hashLength=32, saltLength=16
    private final Argon2PasswordEncoder argon2Encoder = new Argon2PasswordEncoder(16, 32, 4, 65536, 3);
    private final BCryptPasswordEncoder bcryptEncoder = new BCryptPasswordEncoder();

    public PasswordCredentialService(PasswordCredentialRepository credentialRepository,
                                     PasswordHistoryRepository historyRepository,
                                     PasswordPolicyService policyService,
                                     EventPublisher eventPublisher) {
        this.credentialRepository = credentialRepository;
        this.historyRepository = historyRepository;
        this.policyService = policyService;
        this.eventPublisher = eventPublisher;
    }

    public void enrollPassword(UUID accountId, String rawPassword) {
        UUID tenantId = TenantContext.requireTenantId();

        // Validate against policy
        PasswordPolicy policy = policyService.getEffectivePolicy();
        List<String> violations = policyService.validate(rawPassword, policy);
        if (!violations.isEmpty()) {
            throw new IllegalArgumentException("Password policy violation: " + String.join("; ", violations));
        }

        // Deactivate any existing active credential
        credentialRepository.findByAccountIdAndActiveTrue(accountId)
                .ifPresent(existing -> {
                    existing.setActive(false);
                    existing.setCredentialStatus(CredentialStatus.REVOKED);
                    credentialRepository.save(existing);
                });

        // Hash and store
        String hash = argon2Encoder.encode(rawPassword);

        PasswordCredential credential = new PasswordCredential();
        credential.setAccountId(accountId);
        credential.setPasswordHash(hash);
        credential.setHashAlgorithm(HashAlgorithm.ARGON2ID);
        credential.setActive(true);
        credential.setMustChange(false);
        credential.setCredentialStatus(CredentialStatus.ACTIVE);
        credential.setExpiresAt(Instant.now().plus(Duration.ofDays(policy.getMaxAgeDays())));
        credentialRepository.save(credential);

        // Add to history
        addToHistory(accountId, hash);

        publishCredentialEvent(accountId, "credential.enrolled", tenantId);
        log.info("Enrolled password for account [{}]", accountId);
    }

    public boolean verifyPassword(UUID accountId, String rawPassword) {
        PasswordCredential credential = credentialRepository.findByAccountIdAndActiveTrue(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("PasswordCredential", accountId.toString()));

        boolean matches = matchPassword(rawPassword, credential.getPasswordHash(), credential.getHashAlgorithm());

        // Handle version migration: if using old algorithm, re-hash with Argon2id
        if (matches && credential.getHashAlgorithm() != HashAlgorithm.ARGON2ID) {
            String newHash = argon2Encoder.encode(rawPassword);
            credential.setPasswordHash(newHash);
            credential.setHashAlgorithm(HashAlgorithm.ARGON2ID);
            credentialRepository.save(credential);
            log.info("Migrated password hash to ARGON2ID for account [{}]", accountId);
        }

        return matches;
    }

    public void changePassword(UUID accountId, String oldPassword, String newPassword) {
        UUID tenantId = TenantContext.requireTenantId();

        // Verify old password
        if (!verifyPassword(accountId, oldPassword)) {
            throw new IllegalArgumentException("Current password is incorrect");
        }

        // Validate new password against policy
        PasswordPolicy policy = policyService.getEffectivePolicy();
        List<String> violations = policyService.validate(newPassword, policy);
        if (!violations.isEmpty()) {
            throw new IllegalArgumentException("Password policy violation: " + String.join("; ", violations));
        }

        // Check password history
        checkPasswordHistory(accountId, newPassword, policy.getHistoryCount());

        // Deactivate old credential
        PasswordCredential oldCredential = credentialRepository.findByAccountIdAndActiveTrue(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("PasswordCredential", accountId.toString()));
        oldCredential.setActive(false);
        oldCredential.setCredentialStatus(CredentialStatus.EXPIRED);
        credentialRepository.save(oldCredential);

        // Create new credential
        String newHash = argon2Encoder.encode(newPassword);
        PasswordCredential newCredential = new PasswordCredential();
        newCredential.setAccountId(accountId);
        newCredential.setPasswordHash(newHash);
        newCredential.setHashAlgorithm(HashAlgorithm.ARGON2ID);
        newCredential.setActive(true);
        newCredential.setMustChange(false);
        newCredential.setCredentialStatus(CredentialStatus.ACTIVE);
        newCredential.setExpiresAt(Instant.now().plus(Duration.ofDays(policy.getMaxAgeDays())));
        credentialRepository.save(newCredential);

        // Add to history
        addToHistory(accountId, newHash);

        publishCredentialEvent(accountId, "credential.password.changed", tenantId);
        log.info("Changed password for account [{}]", accountId);
    }

    public void resetPassword(UUID accountId, String newPassword, UUID forcedBy) {
        UUID tenantId = TenantContext.requireTenantId();

        // Validate against policy
        PasswordPolicy policy = policyService.getEffectivePolicy();
        List<String> violations = policyService.validate(newPassword, policy);
        if (!violations.isEmpty()) {
            throw new IllegalArgumentException("Password policy violation: " + String.join("; ", violations));
        }

        // Deactivate existing credential if present
        credentialRepository.findByAccountIdAndActiveTrue(accountId)
                .ifPresent(existing -> {
                    existing.setActive(false);
                    existing.setCredentialStatus(CredentialStatus.EXPIRED);
                    credentialRepository.save(existing);
                });

        // Create new credential with mustChange=true
        String hash = argon2Encoder.encode(newPassword);
        PasswordCredential credential = new PasswordCredential();
        credential.setAccountId(accountId);
        credential.setPasswordHash(hash);
        credential.setHashAlgorithm(HashAlgorithm.ARGON2ID);
        credential.setActive(true);
        credential.setMustChange(true);
        credential.setCredentialStatus(CredentialStatus.ACTIVE);
        credential.setExpiresAt(Instant.now().plus(Duration.ofDays(policy.getMaxAgeDays())));
        credentialRepository.save(credential);

        addToHistory(accountId, hash);

        publishCredentialEvent(accountId, "credential.password.reset", tenantId);
        log.info("Reset password for account [{}] by admin [{}]", accountId, forcedBy);
    }

    @Transactional(readOnly = true)
    public long getPasswordAgeDays(UUID accountId) {
        PasswordCredential credential = credentialRepository.findByAccountIdAndActiveTrue(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("PasswordCredential", accountId.toString()));
        return Duration.between(credential.getCreatedAt(), Instant.now()).toDays();
    }

    // ---- Private helpers ----

    boolean matchPassword(String rawPassword, String hash, HashAlgorithm algorithm) {
        return switch (algorithm) {
            case ARGON2ID -> argon2Encoder.matches(rawPassword, hash);
            case BCRYPT -> bcryptEncoder.matches(rawPassword, hash);
            default -> throw new UnsupportedOperationException("Unsupported hash algorithm: " + algorithm);
        };
    }

    void checkPasswordHistory(UUID accountId, String newPassword, int historyCount) {
        List<PasswordHistory> history = historyRepository.findTop10ByAccountIdOrderByCreatedAtDesc(accountId);

        int checkCount = Math.min(historyCount, history.size());
        for (int i = 0; i < checkCount; i++) {
            PasswordHistory entry = history.get(i);
            if (matchPassword(newPassword, entry.getPasswordHash(), entry.getHashAlgorithm())) {
                throw new IllegalArgumentException(
                        "Password was used recently. Cannot reuse the last " + historyCount + " passwords.");
            }
        }
    }

    private void addToHistory(UUID accountId, String hash) {
        PasswordHistory entry = new PasswordHistory();
        entry.setAccountId(accountId);
        entry.setPasswordHash(hash);
        entry.setHashAlgorithm(HashAlgorithm.ARGON2ID);
        historyRepository.save(entry);
    }

    private void publishCredentialEvent(UUID accountId, String eventType, UUID tenantId) {
        var envelope = EventEnvelope.<Map<String, Object>>builder()
                .eventType(eventType)
                .tenantId(tenantId)
                .payload(Map.of("account_id", accountId))
                .build();
        eventPublisher.publish(InnaITTopics.CREDENTIAL_ENROLLED, envelope);
    }
}
