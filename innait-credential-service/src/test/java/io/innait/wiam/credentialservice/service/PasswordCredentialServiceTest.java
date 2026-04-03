package io.innait.wiam.credentialservice.service;

import io.innait.wiam.common.constant.CredentialStatus;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.exception.ResourceNotFoundException;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.credentialservice.entity.HashAlgorithm;
import io.innait.wiam.credentialservice.entity.PasswordCredential;
import io.innait.wiam.credentialservice.entity.PasswordHistory;
import io.innait.wiam.credentialservice.entity.PasswordPolicy;
import io.innait.wiam.credentialservice.repository.PasswordCredentialRepository;
import io.innait.wiam.credentialservice.repository.PasswordHistoryRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PasswordCredentialServiceTest {

    @Mock private PasswordCredentialRepository credentialRepository;
    @Mock private PasswordHistoryRepository historyRepository;
    @Mock private PasswordPolicyService policyService;
    @Mock private EventPublisher eventPublisher;

    @InjectMocks
    private PasswordCredentialService service;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID accountId = UUID.randomUUID();
    private final Argon2PasswordEncoder argon2 = new Argon2PasswordEncoder(16, 32, 4, 65536, 3);
    private final BCryptPasswordEncoder bcrypt = new BCryptPasswordEncoder();

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(tenantId);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    // ---- Enroll ----

    @Nested
    class Enroll {

        @Test
        void shouldEnrollPasswordWithArgon2() {
            when(policyService.getEffectivePolicy()).thenReturn(defaultPolicy());
            when(policyService.validate(anyString(), any())).thenReturn(Collections.emptyList());
            when(credentialRepository.findByAccountIdAndActiveTrue(accountId)).thenReturn(Optional.empty());
            when(credentialRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(historyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventPublisher.publish(anyString(), any())).thenReturn(CompletableFuture.completedFuture(null));

            service.enrollPassword(accountId, "StrongP@ss1");

            ArgumentCaptor<PasswordCredential> captor = ArgumentCaptor.forClass(PasswordCredential.class);
            verify(credentialRepository).save(captor.capture());
            PasswordCredential saved = captor.getValue();

            assertThat(saved.getAccountId()).isEqualTo(accountId);
            assertThat(saved.getHashAlgorithm()).isEqualTo(HashAlgorithm.ARGON2ID);
            assertThat(saved.isActive()).isTrue();
            assertThat(saved.isMustChange()).isFalse();
            assertThat(saved.getCredentialStatus()).isEqualTo(CredentialStatus.ACTIVE);
            assertThat(saved.getExpiresAt()).isAfter(Instant.now());
        }

        @Test
        void shouldDeactivateExistingCredentialOnEnroll() {
            PasswordCredential existing = new PasswordCredential();
            existing.setActive(true);
            existing.setCredentialStatus(CredentialStatus.ACTIVE);

            when(policyService.getEffectivePolicy()).thenReturn(defaultPolicy());
            when(policyService.validate(anyString(), any())).thenReturn(Collections.emptyList());
            when(credentialRepository.findByAccountIdAndActiveTrue(accountId)).thenReturn(Optional.of(existing));
            when(credentialRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(historyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventPublisher.publish(anyString(), any())).thenReturn(CompletableFuture.completedFuture(null));

            service.enrollPassword(accountId, "StrongP@ss1");

            assertThat(existing.isActive()).isFalse();
            assertThat(existing.getCredentialStatus()).isEqualTo(CredentialStatus.REVOKED);
        }

        @Test
        void shouldRejectWeakPassword() {
            when(policyService.getEffectivePolicy()).thenReturn(defaultPolicy());
            when(policyService.validate(anyString(), any())).thenReturn(List.of("Password too short"));

            assertThatThrownBy(() -> service.enrollPassword(accountId, "weak"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Password policy violation");
        }

        @Test
        void shouldAddToHistoryOnEnroll() {
            when(policyService.getEffectivePolicy()).thenReturn(defaultPolicy());
            when(policyService.validate(anyString(), any())).thenReturn(Collections.emptyList());
            when(credentialRepository.findByAccountIdAndActiveTrue(accountId)).thenReturn(Optional.empty());
            when(credentialRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(historyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventPublisher.publish(anyString(), any())).thenReturn(CompletableFuture.completedFuture(null));

            service.enrollPassword(accountId, "StrongP@ss1");

            verify(historyRepository).save(any(PasswordHistory.class));
        }
    }

    // ---- Verify ----

    @Nested
    class Verify {

        @Test
        void shouldVerifyCorrectPassword() {
            String hash = argon2.encode("StrongP@ss1");
            PasswordCredential cred = createCredential(hash, HashAlgorithm.ARGON2ID);
            when(credentialRepository.findByAccountIdAndActiveTrue(accountId)).thenReturn(Optional.of(cred));

            boolean result = service.verifyPassword(accountId, "StrongP@ss1");

            assertThat(result).isTrue();
        }

        @Test
        void shouldRejectIncorrectPassword() {
            String hash = argon2.encode("StrongP@ss1");
            PasswordCredential cred = createCredential(hash, HashAlgorithm.ARGON2ID);
            when(credentialRepository.findByAccountIdAndActiveTrue(accountId)).thenReturn(Optional.of(cred));

            boolean result = service.verifyPassword(accountId, "WrongPassword1!");

            assertThat(result).isFalse();
        }

        @Test
        void shouldThrowWhenNoActiveCredential() {
            when(credentialRepository.findByAccountIdAndActiveTrue(accountId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.verifyPassword(accountId, "test"))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        void shouldMigrateBcryptToArgon2OnVerify() {
            String bcryptHash = bcrypt.encode("StrongP@ss1");
            PasswordCredential cred = createCredential(bcryptHash, HashAlgorithm.BCRYPT);
            when(credentialRepository.findByAccountIdAndActiveTrue(accountId)).thenReturn(Optional.of(cred));
            when(credentialRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            boolean result = service.verifyPassword(accountId, "StrongP@ss1");

            assertThat(result).isTrue();
            assertThat(cred.getHashAlgorithm()).isEqualTo(HashAlgorithm.ARGON2ID);
            // The hash should have been updated to Argon2id format
            assertThat(cred.getPasswordHash()).startsWith("$argon2id$");
            verify(credentialRepository).save(cred);
        }
    }

    // ---- Change ----

    @Nested
    class Change {

        @Test
        void shouldChangePassword() {
            String oldHash = argon2.encode("OldP@ss123");
            PasswordCredential cred = createCredential(oldHash, HashAlgorithm.ARGON2ID);
            when(credentialRepository.findByAccountIdAndActiveTrue(accountId)).thenReturn(Optional.of(cred));
            when(policyService.getEffectivePolicy()).thenReturn(defaultPolicy());
            when(policyService.validate(eq("NewP@ss456"), any())).thenReturn(Collections.emptyList());
            when(historyRepository.findTop10ByAccountIdOrderByCreatedAtDesc(accountId))
                    .thenReturn(Collections.emptyList());
            when(credentialRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(historyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventPublisher.publish(anyString(), any())).thenReturn(CompletableFuture.completedFuture(null));

            service.changePassword(accountId, "OldP@ss123", "NewP@ss456");

            // Old credential deactivated
            assertThat(cred.isActive()).isFalse();
            assertThat(cred.getCredentialStatus()).isEqualTo(CredentialStatus.EXPIRED);

            // Old credential deactivated + new credential saved
            verify(credentialRepository, times(2)).save(any(PasswordCredential.class));
        }

        @Test
        void shouldRejectWrongOldPassword() {
            String hash = argon2.encode("CorrectP@ss1");
            PasswordCredential cred = createCredential(hash, HashAlgorithm.ARGON2ID);
            when(credentialRepository.findByAccountIdAndActiveTrue(accountId)).thenReturn(Optional.of(cred));

            assertThatThrownBy(() -> service.changePassword(accountId, "WrongOld1!", "NewP@ss456"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("incorrect");
        }

        @Test
        void shouldRejectPasswordFromHistory() {
            String oldHash = argon2.encode("OldP@ss123");
            PasswordCredential cred = createCredential(oldHash, HashAlgorithm.ARGON2ID);
            when(credentialRepository.findByAccountIdAndActiveTrue(accountId)).thenReturn(Optional.of(cred));
            when(policyService.getEffectivePolicy()).thenReturn(defaultPolicy());
            when(policyService.validate(eq("ReusedP@ss1"), any())).thenReturn(Collections.emptyList());

            // History contains the reused password
            String reusedHash = argon2.encode("ReusedP@ss1");
            PasswordHistory histEntry = new PasswordHistory();
            histEntry.setPasswordHash(reusedHash);
            histEntry.setHashAlgorithm(HashAlgorithm.ARGON2ID);
            when(historyRepository.findTop10ByAccountIdOrderByCreatedAtDesc(accountId))
                    .thenReturn(List.of(histEntry));

            assertThatThrownBy(() -> service.changePassword(accountId, "OldP@ss123", "ReusedP@ss1"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("used recently");
        }
    }

    // ---- Reset ----

    @Nested
    class Reset {

        @Test
        void shouldResetPasswordWithMustChange() {
            when(policyService.getEffectivePolicy()).thenReturn(defaultPolicy());
            when(policyService.validate(anyString(), any())).thenReturn(Collections.emptyList());
            when(credentialRepository.findByAccountIdAndActiveTrue(accountId)).thenReturn(Optional.empty());
            when(credentialRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(historyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventPublisher.publish(anyString(), any())).thenReturn(CompletableFuture.completedFuture(null));

            UUID adminId = UUID.randomUUID();
            service.resetPassword(accountId, "TempP@ss789", adminId);

            ArgumentCaptor<PasswordCredential> captor = ArgumentCaptor.forClass(PasswordCredential.class);
            verify(credentialRepository).save(captor.capture());
            PasswordCredential saved = captor.getValue();

            assertThat(saved.isMustChange()).isTrue();
            assertThat(saved.isActive()).isTrue();
        }
    }

    // ---- Password Age ----

    @Test
    void shouldCalculatePasswordAge() {
        PasswordCredential cred = createCredential("hash", HashAlgorithm.ARGON2ID);
        cred.setCreatedAt(Instant.now().minusSeconds(86400 * 10)); // 10 days ago
        when(credentialRepository.findByAccountIdAndActiveTrue(accountId)).thenReturn(Optional.of(cred));

        long age = service.getPasswordAgeDays(accountId);

        assertThat(age).isEqualTo(10);
    }

    // ---- Kafka events ----

    @Test
    void shouldPublishEventOnEnroll() {
        when(policyService.getEffectivePolicy()).thenReturn(defaultPolicy());
        when(policyService.validate(anyString(), any())).thenReturn(Collections.emptyList());
        when(credentialRepository.findByAccountIdAndActiveTrue(accountId)).thenReturn(Optional.empty());
        when(credentialRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(historyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(eventPublisher.publish(anyString(), any())).thenReturn(CompletableFuture.completedFuture(null));

        service.enrollPassword(accountId, "StrongP@ss1");

        verify(eventPublisher).publish(anyString(), any(EventEnvelope.class));
    }

    // ---- Helpers ----

    private PasswordCredential createCredential(String hash, HashAlgorithm algorithm) {
        PasswordCredential cred = new PasswordCredential();
        cred.setId(UUID.randomUUID());
        cred.setTenantId(tenantId);
        cred.setAccountId(accountId);
        cred.setPasswordHash(hash);
        cred.setHashAlgorithm(algorithm);
        cred.setActive(true);
        cred.setCredentialStatus(CredentialStatus.ACTIVE);
        cred.setCreatedAt(Instant.now());
        return cred;
    }

    private PasswordPolicy defaultPolicy() {
        PasswordPolicy policy = new PasswordPolicy();
        policy.setMinLength(8);
        policy.setMaxLength(128);
        policy.setRequireUppercase(true);
        policy.setRequireLowercase(true);
        policy.setRequireDigit(true);
        policy.setRequireSpecial(true);
        policy.setHistoryCount(5);
        policy.setMaxAgeDays(90);
        return policy;
    }
}
