package io.innait.wiam.credentialservice.service;

import io.innait.wiam.common.constant.CredentialStatus;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.exception.ResourceNotFoundException;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.kafka.InnaITTopics;
import io.innait.wiam.credentialservice.dto.TotpEnrollmentResponse;
import io.innait.wiam.credentialservice.entity.TotpAlgorithm;
import io.innait.wiam.credentialservice.entity.TotpCredential;
import io.innait.wiam.credentialservice.repository.TotpCredentialRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional
public class TotpCredentialService {

    private static final Logger log = LoggerFactory.getLogger(TotpCredentialService.class);
    private static final int SECRET_LENGTH = 20; // 160 bits for HMAC-SHA1
    private static final String ISSUER = "InnaIT WIAM";

    private final TotpCredentialRepository credentialRepository;
    private final KekService kekService;
    private final EventPublisher eventPublisher;
    private final SecureRandom secureRandom = new SecureRandom();

    public TotpCredentialService(TotpCredentialRepository credentialRepository,
                                  KekService kekService,
                                  EventPublisher eventPublisher) {
        this.credentialRepository = credentialRepository;
        this.kekService = kekService;
        this.eventPublisher = eventPublisher;
    }

    public TotpEnrollmentResponse beginEnrollment(UUID accountId) {
        // Generate random secret
        byte[] secret = new byte[SECRET_LENGTH];
        secureRandom.nextBytes(secret);

        // Encrypt with KEK
        int kekVersion = kekService.getCurrentKekVersion();
        byte[] iv = kekService.generateIv();
        byte[] encrypted = kekService.encrypt(secret, iv, kekVersion);

        // Store with status PENDING (not yet verified)
        TotpCredential credential = new TotpCredential();
        credential.setAccountId(accountId);
        credential.setEncryptedSecret(encrypted);
        credential.setSecretIv(iv);
        credential.setSecretKekVersion(kekVersion);
        credential.setAlgorithm(TotpAlgorithm.SHA1);
        credential.setDigits(6);
        credential.setPeriodSeconds(30);
        credential.setCredentialStatus(CredentialStatus.ACTIVE);
        credential.setVerified(false);
        credential = credentialRepository.save(credential);

        // Build otpauth URI for QR code
        String base32Secret = base32Encode(secret);
        String secretUri = buildOtpAuthUri(accountId.toString(), base32Secret, ISSUER, 6, 30, "SHA1");

        log.info("TOTP enrollment started for account [{}], credentialId [{}]", accountId, credential.getId());

        return new TotpEnrollmentResponse(credential.getId(), secretUri, base32Secret);
    }

    public boolean confirmEnrollment(UUID accountId, String totpCode) {
        TotpCredential credential = credentialRepository
                .findByAccountIdAndCredentialStatus(accountId, CredentialStatus.ACTIVE)
                .stream()
                .filter(c -> !c.isVerified())
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("TotpCredential", accountId.toString()));

        byte[] secret = decryptSecret(credential);
        boolean valid = verifyCode(secret, totpCode, credential.getDigits(), credential.getPeriodSeconds(),
                credential.getAlgorithm());

        if (valid) {
            credential.setVerified(true);
            credential.setLastUsedAt(Instant.now());
            credentialRepository.save(credential);

            publishCredentialEvent(accountId, "credential.totp.enrolled");
            log.info("TOTP enrollment confirmed for account [{}]", accountId);
        }

        return valid;
    }

    @Transactional(readOnly = true)
    public boolean verifyTotp(UUID accountId, String code) {
        TotpCredential credential = credentialRepository
                .findByAccountIdAndVerifiedTrueAndCredentialStatus(accountId, CredentialStatus.ACTIVE)
                .orElseThrow(() -> new ResourceNotFoundException("TotpCredential", accountId.toString()));

        byte[] secret = decryptSecret(credential);
        boolean valid = verifyCode(secret, code, credential.getDigits(), credential.getPeriodSeconds(),
                credential.getAlgorithm());

        if (valid) {
            credential.setLastUsedAt(Instant.now());
            credentialRepository.save(credential);
        }

        return valid;
    }

    public void revokeTotp(UUID accountId, UUID credentialId) {
        TotpCredential credential = credentialRepository.findById(credentialId)
                .filter(c -> c.getAccountId().equals(accountId))
                .orElseThrow(() -> new ResourceNotFoundException("TotpCredential", credentialId.toString()));

        credential.setCredentialStatus(CredentialStatus.REVOKED);
        credentialRepository.save(credential);

        publishCredentialEvent(accountId, "credential.totp.revoked");
        log.info("Revoked TOTP credential [{}] for account [{}]", credentialId, accountId);
    }

    // ---- TOTP Core (RFC 6238) ----

    boolean verifyCode(byte[] secret, String code, int digits, int periodSeconds, TotpAlgorithm algorithm) {
        long currentTime = Instant.now().getEpochSecond() / periodSeconds;
        // Allow ±1 time step for clock drift
        for (int i = -1; i <= 1; i++) {
            String generated = generateTotpCode(secret, currentTime + i, digits, algorithm);
            if (generated.equals(code)) {
                return true;
            }
        }
        return false;
    }

    String generateTotpCode(byte[] secret, long timeCounter, int digits, TotpAlgorithm algorithm) {
        byte[] timeBytes = ByteBuffer.allocate(8).putLong(timeCounter).array();

        String hmacAlgo = switch (algorithm) {
            case SHA1 -> "HmacSHA1";
            case SHA256 -> "HmacSHA256";
            case SHA512 -> "HmacSHA512";
        };

        try {
            Mac mac = Mac.getInstance(hmacAlgo);
            mac.init(new SecretKeySpec(secret, hmacAlgo));
            byte[] hash = mac.doFinal(timeBytes);

            int offset = hash[hash.length - 1] & 0x0F;
            int binary = ((hash[offset] & 0x7F) << 24)
                    | ((hash[offset + 1] & 0xFF) << 16)
                    | ((hash[offset + 2] & 0xFF) << 8)
                    | (hash[offset + 3] & 0xFF);

            int otp = binary % (int) Math.pow(10, digits);
            return String.format("%0" + digits + "d", otp);
        } catch (Exception e) {
            throw new IllegalStateException("TOTP generation failed", e);
        }
    }

    byte[] decryptSecret(TotpCredential credential) {
        return kekService.decrypt(
                credential.getEncryptedSecret(),
                credential.getSecretIv(),
                credential.getSecretKekVersion()
        );
    }

    // ---- Helpers ----

    private String buildOtpAuthUri(String account, String secret, String issuer,
                                   int digits, int period, String algorithm) {
        return String.format("otpauth://totp/%s:%s?secret=%s&issuer=%s&algorithm=%s&digits=%d&period=%d",
                URLEncoder.encode(issuer, StandardCharsets.UTF_8),
                URLEncoder.encode(account, StandardCharsets.UTF_8),
                secret,
                URLEncoder.encode(issuer, StandardCharsets.UTF_8),
                algorithm, digits, period);
    }

    static String base32Encode(byte[] data) {
        String base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        StringBuilder result = new StringBuilder();
        int buffer = 0;
        int bitsLeft = 0;

        for (byte b : data) {
            buffer = (buffer << 8) | (b & 0xFF);
            bitsLeft += 8;
            while (bitsLeft >= 5) {
                bitsLeft -= 5;
                result.append(base32Chars.charAt((buffer >> bitsLeft) & 0x1F));
            }
        }
        if (bitsLeft > 0) {
            result.append(base32Chars.charAt((buffer << (5 - bitsLeft)) & 0x1F));
        }

        return result.toString();
    }

    private void publishCredentialEvent(UUID accountId, String eventType) {
        UUID tenantId = TenantContext.requireTenantId();
        var envelope = EventEnvelope.<Map<String, Object>>builder()
                .eventType(eventType)
                .tenantId(tenantId)
                .payload(Map.of("account_id", accountId))
                .build();
        eventPublisher.publish(InnaITTopics.CREDENTIAL_ENROLLED, envelope);
    }
}
