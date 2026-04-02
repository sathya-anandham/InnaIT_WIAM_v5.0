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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.*;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.X509EncodedKeySpec;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
public class SoftTokenCredentialService {

    private static final Logger log = LoggerFactory.getLogger(SoftTokenCredentialService.class);
    private static final String SOFTTOKEN_CHALLENGE_PREFIX = "softtoken:challenge";
    private static final long CHALLENGE_TTL_SECONDS = 60;
    private static final String EC_ALGORITHM = "EC";
    private static final String EC_CURVE = "secp256r1";
    private static final String SIGNATURE_ALGORITHM = "SHA256withECDSA";

    private final SoftTokenCredentialRepository softTokenRepo;
    private final StringRedisTemplate redisTemplate;
    private final EventPublisher eventPublisher;
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${innait.softtoken.activation-url:https://innait.io/activate}")
    private String activationBaseUrl;

    public SoftTokenCredentialService(SoftTokenCredentialRepository softTokenRepo,
                                       StringRedisTemplate redisTemplate,
                                       EventPublisher eventPublisher) {
        this.softTokenRepo = softTokenRepo;
        this.redisTemplate = redisTemplate;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public SoftTokenProvisionResponse provision(UUID accountId, String devicePlatformStr, String deviceName) {
        DevicePlatform devicePlatform = DevicePlatform.valueOf(devicePlatformStr.toUpperCase());

        // Generate ECDSA key pair
        KeyPair keyPair = generateEcdsaKeyPair();
        byte[] publicKeyBytes = keyPair.getPublic().getEncoded();

        String deviceId = UUID.randomUUID().toString();

        // Generate activation code and store in Redis
        String activationCode = generateActivationCode();
        String activationRedisKey = SOFTTOKEN_CHALLENGE_PREFIX + ":activate:" + deviceId;
        redisTemplate.opsForValue().set(activationRedisKey, activationCode, 300, TimeUnit.SECONDS);

        SoftTokenCredential credential = new SoftTokenCredential();
        credential.setAccountId(accountId);
        credential.setDeviceId(deviceId);
        credential.setDeviceName(deviceName != null ? deviceName : devicePlatform.name() + " Device");
        credential.setDevicePlatform(devicePlatform);
        credential.setPublicKey(publicKeyBytes);
        credential.setActivationStatus(ActivationStatus.PENDING);

        SoftTokenCredential saved = softTokenRepo.save(credential);

        String activationUrl = activationBaseUrl + "?deviceId=" + deviceId + "&code=" + activationCode;
        String publicKeyB64 = Base64.getEncoder().encodeToString(publicKeyBytes);

        log.info("SoftToken provisioned for account {}, deviceId {}", accountId, deviceId);
        return new SoftTokenProvisionResponse(saved.getId(), deviceId, activationUrl, publicKeyB64);
    }

    @Transactional
    public boolean activate(String deviceId, String activationCode, String pushToken) {
        SoftTokenCredential credential = softTokenRepo.findByDeviceId(deviceId)
                .orElseThrow(() -> new ResourceNotFoundException("SoftTokenCredential", deviceId));

        if (credential.getActivationStatus() != ActivationStatus.PENDING) {
            throw new IllegalStateException("SoftToken is not in PENDING state: " + credential.getActivationStatus());
        }

        // Verify activation code from Redis
        String activationRedisKey = SOFTTOKEN_CHALLENGE_PREFIX + ":activate:" + deviceId;
        String storedCode = redisTemplate.opsForValue().get(activationRedisKey);
        if (storedCode == null || !storedCode.equals(activationCode)) {
            log.warn("Activation failed for deviceId {}: invalid or expired activation code", deviceId);
            return false;
        }
        redisTemplate.delete(activationRedisKey);

        credential.setActivationStatus(ActivationStatus.ACTIVE);
        if (pushToken != null && !pushToken.isBlank()) {
            credential.setPushToken(pushToken);
        }
        softTokenRepo.save(credential);

        publishCredentialEvent(InnaITTopics.CREDENTIAL_ENROLLED, "softtoken.activated",
                credential.getAccountId(), credential.getId());

        log.info("SoftToken activated for deviceId {}, account {}", deviceId, credential.getAccountId());
        return true;
    }

    @Transactional(readOnly = true)
    public SoftTokenChallengeResponse sendPushChallenge(UUID accountId) {
        List<SoftTokenCredential> activeTokens = softTokenRepo
                .findByAccountIdAndActivationStatus(accountId, ActivationStatus.ACTIVE);

        if (activeTokens.isEmpty()) {
            throw new ResourceNotFoundException("SoftTokenCredential", accountId.toString());
        }

        SoftTokenCredential token = activeTokens.get(0);

        // Generate challenge nonce
        byte[] nonceBytes = new byte[32];
        secureRandom.nextBytes(nonceBytes);
        String challengeId = UUID.randomUUID().toString();
        String nonce = Base64.getUrlEncoder().withoutPadding().encodeToString(nonceBytes);

        // Store challenge data in Redis: challengeId -> deviceId:nonce
        String challengeRedisKey = SOFTTOKEN_CHALLENGE_PREFIX + ":" + challengeId;
        String challengeData = token.getDeviceId() + ":" + nonce;
        redisTemplate.opsForValue().set(challengeRedisKey, challengeData, CHALLENGE_TTL_SECONDS, TimeUnit.SECONDS);

        // In production, push notification would be sent to device via FCM/APNs/HMS
        // using token.getPushToken(). For now, we log the intent.
        log.info("Push challenge sent for account {}, challengeId {}, deviceId {}",
                accountId, challengeId, token.getDeviceId());

        return new SoftTokenChallengeResponse(challengeId, "CHALLENGE_SENT");
    }

    @Transactional
    public boolean verifyPushResponse(String challengeId, String signedResponse) {
        String challengeRedisKey = SOFTTOKEN_CHALLENGE_PREFIX + ":" + challengeId;
        String challengeData = redisTemplate.opsForValue().get(challengeRedisKey);

        if (challengeData == null) {
            log.warn("Challenge expired or not found: {}", challengeId);
            return false;
        }
        redisTemplate.delete(challengeRedisKey);

        // Parse deviceId:nonce from stored challenge data
        String[] parts = challengeData.split(":", 2);
        if (parts.length != 2) {
            log.error("Invalid challenge data format for challengeId: {}", challengeId);
            return false;
        }

        String deviceId = parts[0];
        String nonce = parts[1];

        SoftTokenCredential credential = softTokenRepo.findByDeviceId(deviceId)
                .orElseThrow(() -> new ResourceNotFoundException("SoftTokenCredential", deviceId));

        if (credential.getActivationStatus() != ActivationStatus.ACTIVE) {
            log.warn("SoftToken not active for deviceId {}", deviceId);
            return false;
        }

        // Verify ECDSA signature
        byte[] signatureBytes = Base64.getUrlDecoder().decode(signedResponse);
        byte[] nonceBytes = Base64.getUrlDecoder().decode(nonce);

        boolean verified = verifyEcdsaSignature(credential.getPublicKey(), nonceBytes, signatureBytes);

        if (verified) {
            credential.setLastUsedAt(Instant.now());
            softTokenRepo.save(credential);
            log.info("SoftToken verification successful for deviceId {}", deviceId);
        } else {
            log.warn("SoftToken ECDSA verification failed for deviceId {}", deviceId);
        }

        return verified;
    }

    @Transactional
    public void suspendCredential(UUID accountId, UUID credentialId) {
        SoftTokenCredential credential = findAndValidateOwnership(accountId, credentialId);

        if (credential.getActivationStatus() == ActivationStatus.REVOKED) {
            throw new IllegalStateException("Cannot suspend a revoked credential");
        }

        credential.setActivationStatus(ActivationStatus.SUSPENDED);
        softTokenRepo.save(credential);
        log.info("SoftToken {} suspended for account {}", credentialId, accountId);
    }

    @Transactional
    public void revokeCredential(UUID accountId, UUID credentialId) {
        SoftTokenCredential credential = findAndValidateOwnership(accountId, credentialId);

        credential.setActivationStatus(ActivationStatus.REVOKED);
        softTokenRepo.save(credential);

        publishCredentialEvent(InnaITTopics.CREDENTIAL_REVOKED, "softtoken.revoked", accountId, credentialId);
        log.info("SoftToken {} revoked for account {}", credentialId, accountId);
    }

    @Transactional
    public int bulkRevoke(UUID accountId) {
        List<SoftTokenCredential> credentials = softTokenRepo.findByAccountId(accountId);
        int count = 0;
        for (SoftTokenCredential credential : credentials) {
            if (credential.getActivationStatus() != ActivationStatus.REVOKED) {
                credential.setActivationStatus(ActivationStatus.REVOKED);
                count++;
            }
        }
        softTokenRepo.saveAll(credentials);

        if (count > 0) {
            publishCredentialEvent(InnaITTopics.CREDENTIAL_REVOKED, "softtoken.bulk_revoked", accountId, null);
        }
        log.info("Bulk revoked {} SoftToken credentials for account {}", count, accountId);
        return count;
    }

    @Transactional(readOnly = true)
    public List<SoftTokenCredentialResponse> listCredentials(UUID accountId) {
        return softTokenRepo.findByAccountId(accountId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // visible for testing
    KeyPair generateEcdsaKeyPair() {
        try {
            KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance(EC_ALGORITHM);
            keyPairGenerator.initialize(new ECGenParameterSpec(EC_CURVE), secureRandom);
            return keyPairGenerator.generateKeyPair();
        } catch (NoSuchAlgorithmException | InvalidAlgorithmParameterException e) {
            throw new IllegalStateException("Failed to generate ECDSA key pair", e);
        }
    }

    // visible for testing
    boolean verifyEcdsaSignature(byte[] publicKeyBytes, byte[] data, byte[] signatureBytes) {
        try {
            KeyFactory keyFactory = KeyFactory.getInstance(EC_ALGORITHM);
            PublicKey publicKey = keyFactory.generatePublic(new X509EncodedKeySpec(publicKeyBytes));

            Signature signature = Signature.getInstance(SIGNATURE_ALGORITHM);
            signature.initVerify(publicKey);
            signature.update(data);
            return signature.verify(signatureBytes);
        } catch (Exception e) {
            log.warn("ECDSA signature verification error: {}", e.getMessage());
            return false;
        }
    }

    private SoftTokenCredential findAndValidateOwnership(UUID accountId, UUID credentialId) {
        SoftTokenCredential credential = softTokenRepo.findById(credentialId)
                .orElseThrow(() -> new ResourceNotFoundException("SoftTokenCredential", credentialId.toString()));

        if (!credential.getAccountId().equals(accountId)) {
            throw new IllegalStateException("Credential does not belong to the specified account");
        }
        return credential;
    }

    private String generateActivationCode() {
        int code = secureRandom.nextInt(900000) + 100000; // 6-digit code
        return String.valueOf(code);
    }

    private SoftTokenCredentialResponse toResponse(SoftTokenCredential credential) {
        return new SoftTokenCredentialResponse(
                credential.getId(),
                credential.getDeviceId(),
                credential.getDeviceName(),
                credential.getDevicePlatform().name(),
                credential.getActivationStatus().name(),
                credential.getCreatedAt(),
                credential.getLastUsedAt()
        );
    }

    private void publishCredentialEvent(String topic, String eventType, UUID accountId, UUID credentialId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("accountId", accountId.toString());
        payload.put("credentialType", "SOFTTOKEN");
        if (credentialId != null) {
            payload.put("credentialId", credentialId.toString());
        }

        EventEnvelope<Map<String, Object>> event = EventEnvelope.<Map<String, Object>>builder()
                .eventType(eventType)
                .tenantId(TenantContext.getTenantId())
                .payload(payload)
                .build();

        eventPublisher.publish(topic, event);
    }
}
