package io.innait.wiam.credentialservice.service;

import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.exception.ResourceNotFoundException;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.kafka.InnaITTopics;
import io.innait.wiam.credentialservice.dto.SoftTokenChallengeResponse;
import io.innait.wiam.credentialservice.dto.SoftTokenCredentialResponse;
import io.innait.wiam.credentialservice.dto.SoftTokenProvisionResponse;
import io.innait.wiam.credentialservice.entity.ActivationStatus;
import io.innait.wiam.credentialservice.entity.DevicePlatform;
import io.innait.wiam.credentialservice.entity.SoftTokenCredential;
import io.innait.wiam.credentialservice.repository.SoftTokenCredentialRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.security.*;
import java.security.spec.ECGenParameterSpec;
import java.util.*;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SoftTokenCredentialServiceTest {

    @Mock
    private SoftTokenCredentialRepository softTokenRepo;

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @Mock
    private EventPublisher eventPublisher;

    private SoftTokenCredentialService service;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID accountId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(tenantId);
        service = new SoftTokenCredentialService(softTokenRepo, redisTemplate, eventPublisher);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    // ---- Provision ----

    @Nested
    class Provision {

        @Test
        void shouldProvisionSoftTokenSuccessfully() {
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(softTokenRepo.save(any(SoftTokenCredential.class))).thenAnswer(inv -> {
                SoftTokenCredential c = inv.getArgument(0);
                setId(c, UUID.randomUUID());
                return c;
            });

            SoftTokenProvisionResponse response = service.provision(accountId, "ANDROID", "My Phone");

            assertThat(response).isNotNull();
            assertThat(response.deviceId()).isNotBlank();
            assertThat(response.activationUrl()).contains(response.deviceId());
            assertThat(response.publicKey()).isNotBlank();
            assertThat(response.credentialId()).isNotNull();
        }

        @Test
        void shouldStorePendingCredential() {
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            ArgumentCaptor<SoftTokenCredential> captor = ArgumentCaptor.forClass(SoftTokenCredential.class);
            when(softTokenRepo.save(captor.capture())).thenAnswer(inv -> {
                SoftTokenCredential c = inv.getArgument(0);
                setId(c, UUID.randomUUID());
                return c;
            });

            service.provision(accountId, "IOS", "iPhone");

            SoftTokenCredential saved = captor.getValue();
            assertThat(saved.getAccountId()).isEqualTo(accountId);
            assertThat(saved.getDevicePlatform()).isEqualTo(DevicePlatform.IOS);
            assertThat(saved.getDeviceName()).isEqualTo("iPhone");
            assertThat(saved.getActivationStatus()).isEqualTo(ActivationStatus.PENDING);
            assertThat(saved.getPublicKey()).isNotEmpty();
        }

        @Test
        void shouldStoreActivationCodeInRedis() {
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(softTokenRepo.save(any(SoftTokenCredential.class))).thenAnswer(inv -> {
                SoftTokenCredential c = inv.getArgument(0);
                setId(c, UUID.randomUUID());
                return c;
            });

            service.provision(accountId, "ANDROID", null);

            verify(valueOperations).set(
                    argThat(key -> key.startsWith("softtoken:challenge:activate:")),
                    anyString(),
                    eq(300L),
                    eq(TimeUnit.SECONDS)
            );
        }

        @Test
        void shouldUseDefaultDeviceName() {
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            ArgumentCaptor<SoftTokenCredential> captor = ArgumentCaptor.forClass(SoftTokenCredential.class);
            when(softTokenRepo.save(captor.capture())).thenAnswer(inv -> {
                SoftTokenCredential c = inv.getArgument(0);
                setId(c, UUID.randomUUID());
                return c;
            });

            service.provision(accountId, "WINDOWS", null);

            assertThat(captor.getValue().getDeviceName()).isEqualTo("WINDOWS Device");
        }

        @Test
        void shouldGenerateValidPublicKey() {
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(softTokenRepo.save(any(SoftTokenCredential.class))).thenAnswer(inv -> {
                SoftTokenCredential c = inv.getArgument(0);
                setId(c, UUID.randomUUID());
                return c;
            });

            SoftTokenProvisionResponse response = service.provision(accountId, "ANDROID", "Test");

            // Verify the public key is valid Base64
            byte[] decoded = Base64.getDecoder().decode(response.publicKey());
            assertThat(decoded.length).isGreaterThan(0);
        }

        @Test
        void shouldThrowOnInvalidPlatform() {
            assertThatThrownBy(() -> service.provision(accountId, "INVALID_PLATFORM", "Test"))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ---- Activate ----

    @Nested
    class Activate {

        @Test
        void shouldActivateSuccessfully() {
            String deviceId = "device-123";
            SoftTokenCredential cred = buildSoftToken(accountId, deviceId, ActivationStatus.PENDING);

            when(softTokenRepo.findByDeviceId(deviceId)).thenReturn(Optional.of(cred));
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.get("softtoken:challenge:activate:" + deviceId)).thenReturn("123456");
            when(softTokenRepo.save(any(SoftTokenCredential.class))).thenAnswer(inv -> inv.getArgument(0));

            boolean result = service.activate(deviceId, "123456", "fcm-push-token");

            assertThat(result).isTrue();
            assertThat(cred.getActivationStatus()).isEqualTo(ActivationStatus.ACTIVE);
            assertThat(cred.getPushToken()).isEqualTo("fcm-push-token");
            verify(eventPublisher).publish(eq(InnaITTopics.CREDENTIAL_ENROLLED), any(EventEnvelope.class));
        }

        @Test
        void shouldFailWithInvalidActivationCode() {
            String deviceId = "device-123";
            SoftTokenCredential cred = buildSoftToken(accountId, deviceId, ActivationStatus.PENDING);

            when(softTokenRepo.findByDeviceId(deviceId)).thenReturn(Optional.of(cred));
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.get("softtoken:challenge:activate:" + deviceId)).thenReturn("123456");

            boolean result = service.activate(deviceId, "wrong-code", null);

            assertThat(result).isFalse();
            assertThat(cred.getActivationStatus()).isEqualTo(ActivationStatus.PENDING);
        }

        @Test
        void shouldFailWithExpiredActivationCode() {
            String deviceId = "device-123";
            SoftTokenCredential cred = buildSoftToken(accountId, deviceId, ActivationStatus.PENDING);

            when(softTokenRepo.findByDeviceId(deviceId)).thenReturn(Optional.of(cred));
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.get("softtoken:challenge:activate:" + deviceId)).thenReturn(null);

            boolean result = service.activate(deviceId, "123456", null);

            assertThat(result).isFalse();
        }

        @Test
        void shouldThrowWhenDeviceNotFound() {
            when(softTokenRepo.findByDeviceId("unknown")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.activate("unknown", "code", null))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        void shouldThrowWhenNotInPendingState() {
            String deviceId = "device-123";
            SoftTokenCredential cred = buildSoftToken(accountId, deviceId, ActivationStatus.ACTIVE);

            when(softTokenRepo.findByDeviceId(deviceId)).thenReturn(Optional.of(cred));

            assertThatThrownBy(() -> service.activate(deviceId, "code", null))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("not in PENDING state");
        }

        @Test
        void shouldNotSetPushTokenWhenNull() {
            String deviceId = "device-123";
            SoftTokenCredential cred = buildSoftToken(accountId, deviceId, ActivationStatus.PENDING);

            when(softTokenRepo.findByDeviceId(deviceId)).thenReturn(Optional.of(cred));
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.get("softtoken:challenge:activate:" + deviceId)).thenReturn("123456");
            when(softTokenRepo.save(any(SoftTokenCredential.class))).thenAnswer(inv -> inv.getArgument(0));

            service.activate(deviceId, "123456", null);

            assertThat(cred.getPushToken()).isNull();
        }

        @Test
        void shouldDeleteActivationCodeFromRedisOnSuccess() {
            String deviceId = "device-123";
            SoftTokenCredential cred = buildSoftToken(accountId, deviceId, ActivationStatus.PENDING);

            when(softTokenRepo.findByDeviceId(deviceId)).thenReturn(Optional.of(cred));
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.get("softtoken:challenge:activate:" + deviceId)).thenReturn("123456");
            when(softTokenRepo.save(any(SoftTokenCredential.class))).thenAnswer(inv -> inv.getArgument(0));

            service.activate(deviceId, "123456", null);

            verify(redisTemplate).delete("softtoken:challenge:activate:" + deviceId);
        }
    }

    // ---- sendPushChallenge ----

    @Nested
    class SendPushChallenge {

        @Test
        void shouldGenerateChallengeAndStoreInRedis() {
            SoftTokenCredential cred = buildSoftToken(accountId, "dev-1", ActivationStatus.ACTIVE);
            cred.setPushToken("fcm-token");

            when(softTokenRepo.findByAccountIdAndActivationStatus(accountId, ActivationStatus.ACTIVE))
                    .thenReturn(List.of(cred));
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);

            SoftTokenChallengeResponse response = service.sendPushChallenge(accountId);

            assertThat(response.challengeId()).isNotBlank();
            assertThat(response.status()).isEqualTo("CHALLENGE_SENT");

            verify(valueOperations).set(
                    argThat(key -> key.startsWith("softtoken:challenge:")),
                    argThat(data -> data.contains("dev-1:")),
                    eq(60L),
                    eq(TimeUnit.SECONDS)
            );
        }

        @Test
        void shouldThrowWhenNoActiveTokens() {
            when(softTokenRepo.findByAccountIdAndActivationStatus(accountId, ActivationStatus.ACTIVE))
                    .thenReturn(Collections.emptyList());

            assertThatThrownBy(() -> service.sendPushChallenge(accountId))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        void shouldSelectFirstActiveToken() {
            SoftTokenCredential cred1 = buildSoftToken(accountId, "dev-1", ActivationStatus.ACTIVE);
            SoftTokenCredential cred2 = buildSoftToken(accountId, "dev-2", ActivationStatus.ACTIVE);

            when(softTokenRepo.findByAccountIdAndActivationStatus(accountId, ActivationStatus.ACTIVE))
                    .thenReturn(List.of(cred1, cred2));
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);

            service.sendPushChallenge(accountId);

            verify(valueOperations).set(
                    anyString(),
                    argThat(data -> data.startsWith("dev-1:")),
                    anyLong(),
                    any(TimeUnit.class)
            );
        }
    }

    // ---- verifyPushResponse ----

    @Nested
    class VerifyPushResponse {

        @Test
        void shouldVerifyValidSignature() throws Exception {
            // Generate a real ECDSA key pair for this test
            KeyPairGenerator keyGen = KeyPairGenerator.getInstance("EC");
            keyGen.initialize(new ECGenParameterSpec("secp256r1"));
            KeyPair keyPair = keyGen.generateKeyPair();

            byte[] nonce = new byte[32];
            new SecureRandom().nextBytes(nonce);
            String nonceB64 = Base64.getUrlEncoder().withoutPadding().encodeToString(nonce);

            // Sign the nonce
            Signature sig = Signature.getInstance("SHA256withECDSA");
            sig.initSign(keyPair.getPrivate());
            sig.update(nonce);
            byte[] signature = sig.sign();
            String signatureB64 = Base64.getUrlEncoder().withoutPadding().encodeToString(signature);

            String deviceId = "dev-1";
            String challengeId = "challenge-123";
            SoftTokenCredential cred = buildSoftToken(accountId, deviceId, ActivationStatus.ACTIVE);
            cred.setPublicKey(keyPair.getPublic().getEncoded());

            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.get("softtoken:challenge:" + challengeId))
                    .thenReturn(deviceId + ":" + nonceB64);
            when(softTokenRepo.findByDeviceId(deviceId)).thenReturn(Optional.of(cred));
            when(softTokenRepo.save(any(SoftTokenCredential.class))).thenAnswer(inv -> inv.getArgument(0));

            boolean result = service.verifyPushResponse(challengeId, signatureB64);

            assertThat(result).isTrue();
            assertThat(cred.getLastUsedAt()).isNotNull();
            verify(softTokenRepo).save(cred);
        }

        @Test
        void shouldRejectInvalidSignature() throws Exception {
            KeyPairGenerator keyGen = KeyPairGenerator.getInstance("EC");
            keyGen.initialize(new ECGenParameterSpec("secp256r1"));
            KeyPair keyPair = keyGen.generateKeyPair();

            byte[] nonce = new byte[32];
            new SecureRandom().nextBytes(nonce);
            String nonceB64 = Base64.getUrlEncoder().withoutPadding().encodeToString(nonce);

            // Use a random (wrong) signature
            String wrongSigB64 = Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[64]);

            String deviceId = "dev-1";
            String challengeId = "challenge-456";
            SoftTokenCredential cred = buildSoftToken(accountId, deviceId, ActivationStatus.ACTIVE);
            cred.setPublicKey(keyPair.getPublic().getEncoded());

            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.get("softtoken:challenge:" + challengeId))
                    .thenReturn(deviceId + ":" + nonceB64);
            when(softTokenRepo.findByDeviceId(deviceId)).thenReturn(Optional.of(cred));

            boolean result = service.verifyPushResponse(challengeId, wrongSigB64);

            assertThat(result).isFalse();
            verify(softTokenRepo, never()).save(any());
        }

        @Test
        void shouldReturnFalseWhenChallengeExpired() {
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.get("softtoken:challenge:expired-challenge")).thenReturn(null);

            boolean result = service.verifyPushResponse("expired-challenge", "sig");

            assertThat(result).isFalse();
        }

        @Test
        void shouldDeleteChallengeFromRedisAfterRetrieval() throws Exception {
            KeyPairGenerator keyGen = KeyPairGenerator.getInstance("EC");
            keyGen.initialize(new ECGenParameterSpec("secp256r1"));
            KeyPair keyPair = keyGen.generateKeyPair();

            byte[] nonce = new byte[32];
            new SecureRandom().nextBytes(nonce);
            String nonceB64 = Base64.getUrlEncoder().withoutPadding().encodeToString(nonce);

            Signature sig = Signature.getInstance("SHA256withECDSA");
            sig.initSign(keyPair.getPrivate());
            sig.update(nonce);
            String sigB64 = Base64.getUrlEncoder().withoutPadding().encodeToString(sig.sign());

            String deviceId = "dev-1";
            String challengeId = "challenge-789";
            SoftTokenCredential cred = buildSoftToken(accountId, deviceId, ActivationStatus.ACTIVE);
            cred.setPublicKey(keyPair.getPublic().getEncoded());

            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.get("softtoken:challenge:" + challengeId))
                    .thenReturn(deviceId + ":" + nonceB64);
            when(softTokenRepo.findByDeviceId(deviceId)).thenReturn(Optional.of(cred));
            when(softTokenRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.verifyPushResponse(challengeId, sigB64);

            verify(redisTemplate).delete("softtoken:challenge:" + challengeId);
        }

        @Test
        void shouldRejectWhenDeviceNotActive() throws Exception {
            byte[] nonce = new byte[32];
            String nonceB64 = Base64.getUrlEncoder().withoutPadding().encodeToString(nonce);

            String deviceId = "dev-1";
            String challengeId = "challenge-susp";
            SoftTokenCredential cred = buildSoftToken(accountId, deviceId, ActivationStatus.SUSPENDED);

            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.get("softtoken:challenge:" + challengeId))
                    .thenReturn(deviceId + ":" + nonceB64);
            when(softTokenRepo.findByDeviceId(deviceId)).thenReturn(Optional.of(cred));

            boolean result = service.verifyPushResponse(challengeId, "sig");

            assertThat(result).isFalse();
        }
    }

    // ---- Suspend/Revoke ----

    @Nested
    class SuspendAndRevoke {

        @Test
        void shouldSuspendCredential() {
            UUID credId = UUID.randomUUID();
            SoftTokenCredential cred = buildSoftToken(accountId, "dev-1", ActivationStatus.ACTIVE);
            setId(cred, credId);

            when(softTokenRepo.findById(credId)).thenReturn(Optional.of(cred));
            when(softTokenRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.suspendCredential(accountId, credId);

            assertThat(cred.getActivationStatus()).isEqualTo(ActivationStatus.SUSPENDED);
        }

        @Test
        void shouldNotSuspendRevokedCredential() {
            UUID credId = UUID.randomUUID();
            SoftTokenCredential cred = buildSoftToken(accountId, "dev-1", ActivationStatus.REVOKED);
            setId(cred, credId);

            when(softTokenRepo.findById(credId)).thenReturn(Optional.of(cred));

            assertThatThrownBy(() -> service.suspendCredential(accountId, credId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Cannot suspend a revoked credential");
        }

        @Test
        void shouldRevokeCredential() {
            UUID credId = UUID.randomUUID();
            SoftTokenCredential cred = buildSoftToken(accountId, "dev-1", ActivationStatus.ACTIVE);
            setId(cred, credId);

            when(softTokenRepo.findById(credId)).thenReturn(Optional.of(cred));
            when(softTokenRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.revokeCredential(accountId, credId);

            assertThat(cred.getActivationStatus()).isEqualTo(ActivationStatus.REVOKED);
            verify(eventPublisher).publish(eq(InnaITTopics.CREDENTIAL_REVOKED), any(EventEnvelope.class));
        }

        @Test
        void shouldThrowWhenCredentialNotFound() {
            UUID credId = UUID.randomUUID();
            when(softTokenRepo.findById(credId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.revokeCredential(accountId, credId))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        void shouldThrowWhenCredentialBelongsToDifferentAccount() {
            UUID credId = UUID.randomUUID();
            UUID otherAccountId = UUID.randomUUID();
            SoftTokenCredential cred = buildSoftToken(otherAccountId, "dev-1", ActivationStatus.ACTIVE);
            setId(cred, credId);

            when(softTokenRepo.findById(credId)).thenReturn(Optional.of(cred));

            assertThatThrownBy(() -> service.revokeCredential(accountId, credId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("does not belong");
        }
    }

    // ---- Bulk Revoke ----

    @Nested
    class BulkRevoke {

        @Test
        void shouldRevokeAllNonRevokedCredentials() {
            SoftTokenCredential cred1 = buildSoftToken(accountId, "dev-1", ActivationStatus.ACTIVE);
            SoftTokenCredential cred2 = buildSoftToken(accountId, "dev-2", ActivationStatus.PENDING);
            SoftTokenCredential cred3 = buildSoftToken(accountId, "dev-3", ActivationStatus.REVOKED);

            when(softTokenRepo.findByAccountId(accountId)).thenReturn(List.of(cred1, cred2, cred3));

            int count = service.bulkRevoke(accountId);

            assertThat(count).isEqualTo(2);
            assertThat(cred1.getActivationStatus()).isEqualTo(ActivationStatus.REVOKED);
            assertThat(cred2.getActivationStatus()).isEqualTo(ActivationStatus.REVOKED);
            assertThat(cred3.getActivationStatus()).isEqualTo(ActivationStatus.REVOKED);
            verify(eventPublisher).publish(eq(InnaITTopics.CREDENTIAL_REVOKED), any(EventEnvelope.class));
        }

        @Test
        void shouldReturnZeroWhenNoCredentials() {
            when(softTokenRepo.findByAccountId(accountId)).thenReturn(Collections.emptyList());

            int count = service.bulkRevoke(accountId);

            assertThat(count).isEqualTo(0);
            verify(eventPublisher, never()).publish(anyString(), any(EventEnvelope.class));
        }
    }

    // ---- List Credentials ----

    @Nested
    class ListCredentials {

        @Test
        void shouldReturnAllCredentials() {
            SoftTokenCredential cred1 = buildSoftToken(accountId, "dev-1", ActivationStatus.ACTIVE);
            setId(cred1, UUID.randomUUID());
            SoftTokenCredential cred2 = buildSoftToken(accountId, "dev-2", ActivationStatus.REVOKED);
            setId(cred2, UUID.randomUUID());

            when(softTokenRepo.findByAccountId(accountId)).thenReturn(List.of(cred1, cred2));

            List<SoftTokenCredentialResponse> responses = service.listCredentials(accountId);

            assertThat(responses).hasSize(2);
            assertThat(responses.get(0).deviceId()).isEqualTo("dev-1");
            assertThat(responses.get(0).activationStatus()).isEqualTo("ACTIVE");
            assertThat(responses.get(1).deviceId()).isEqualTo("dev-2");
            assertThat(responses.get(1).activationStatus()).isEqualTo("REVOKED");
        }

        @Test
        void shouldReturnEmptyList() {
            when(softTokenRepo.findByAccountId(accountId)).thenReturn(Collections.emptyList());

            List<SoftTokenCredentialResponse> responses = service.listCredentials(accountId);

            assertThat(responses).isEmpty();
        }
    }

    // ---- ECDSA Key Pair Generation ----

    @Nested
    class EcdsaKeyPairGeneration {

        @Test
        void shouldGenerateValidKeyPair() {
            KeyPair keyPair = service.generateEcdsaKeyPair();

            assertThat(keyPair).isNotNull();
            assertThat(keyPair.getPublic()).isNotNull();
            assertThat(keyPair.getPrivate()).isNotNull();
            assertThat(keyPair.getPublic().getAlgorithm()).isEqualTo("EC");
        }

        @Test
        void shouldGenerateUniqueKeyPairs() {
            KeyPair kp1 = service.generateEcdsaKeyPair();
            KeyPair kp2 = service.generateEcdsaKeyPair();

            assertThat(kp1.getPublic().getEncoded())
                    .isNotEqualTo(kp2.getPublic().getEncoded());
        }

        @Test
        void shouldProduceSignableKeyPair() throws Exception {
            KeyPair keyPair = service.generateEcdsaKeyPair();
            byte[] data = "test data".getBytes();

            Signature sig = Signature.getInstance("SHA256withECDSA");
            sig.initSign(keyPair.getPrivate());
            sig.update(data);
            byte[] signature = sig.sign();

            boolean verified = service.verifyEcdsaSignature(
                    keyPair.getPublic().getEncoded(), data, signature);

            assertThat(verified).isTrue();
        }
    }

    // ---- ECDSA Signature Verification ----

    @Nested
    class EcdsaSignatureVerification {

        @Test
        void shouldVerifyValidSignature() throws Exception {
            KeyPairGenerator keyGen = KeyPairGenerator.getInstance("EC");
            keyGen.initialize(new ECGenParameterSpec("secp256r1"));
            KeyPair keyPair = keyGen.generateKeyPair();

            byte[] data = "challenge nonce".getBytes();
            Signature sig = Signature.getInstance("SHA256withECDSA");
            sig.initSign(keyPair.getPrivate());
            sig.update(data);
            byte[] signature = sig.sign();

            boolean result = service.verifyEcdsaSignature(
                    keyPair.getPublic().getEncoded(), data, signature);

            assertThat(result).isTrue();
        }

        @Test
        void shouldRejectTamperedData() throws Exception {
            KeyPairGenerator keyGen = KeyPairGenerator.getInstance("EC");
            keyGen.initialize(new ECGenParameterSpec("secp256r1"));
            KeyPair keyPair = keyGen.generateKeyPair();

            byte[] data = "original data".getBytes();
            Signature sig = Signature.getInstance("SHA256withECDSA");
            sig.initSign(keyPair.getPrivate());
            sig.update(data);
            byte[] signature = sig.sign();

            boolean result = service.verifyEcdsaSignature(
                    keyPair.getPublic().getEncoded(), "tampered data".getBytes(), signature);

            assertThat(result).isFalse();
        }

        @Test
        void shouldRejectSignatureFromDifferentKey() throws Exception {
            KeyPairGenerator keyGen = KeyPairGenerator.getInstance("EC");
            keyGen.initialize(new ECGenParameterSpec("secp256r1"));
            KeyPair keyPair1 = keyGen.generateKeyPair();
            KeyPair keyPair2 = keyGen.generateKeyPair();

            byte[] data = "test data".getBytes();
            Signature sig = Signature.getInstance("SHA256withECDSA");
            sig.initSign(keyPair1.getPrivate());
            sig.update(data);
            byte[] signature = sig.sign();

            boolean result = service.verifyEcdsaSignature(
                    keyPair2.getPublic().getEncoded(), data, signature);

            assertThat(result).isFalse();
        }

        @Test
        void shouldReturnFalseForInvalidPublicKey() {
            boolean result = service.verifyEcdsaSignature(
                    new byte[]{1, 2, 3}, "data".getBytes(), new byte[]{4, 5, 6});

            assertThat(result).isFalse();
        }
    }

    // ---- Helpers ----

    private SoftTokenCredential buildSoftToken(UUID accountId, String deviceId, ActivationStatus status) {
        SoftTokenCredential cred = new SoftTokenCredential();
        cred.setAccountId(accountId);
        cred.setDeviceId(deviceId);
        cred.setDeviceName("Test Device");
        cred.setDevicePlatform(DevicePlatform.ANDROID);
        cred.setPublicKey(new byte[64]);
        cred.setActivationStatus(status);
        return cred;
    }

    private void setId(SoftTokenCredential credential, UUID id) {
        try {
            var field = credential.getClass().getSuperclass().getDeclaredField("id");
            field.setAccessible(true);
            field.set(credential, id);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
