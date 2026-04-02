package io.innait.wiam.adminbff.service;

import io.innait.wiam.adminbff.client.CredentialServiceClient;
import io.innait.wiam.adminbff.client.IdentityServiceClient;
import io.innait.wiam.adminbff.client.NotificationServiceClient;
import io.innait.wiam.adminbff.client.SessionServiceClient;
import io.innait.wiam.adminbff.dto.ForgotPasswordRequest;
import io.innait.wiam.adminbff.dto.ResetPasswordRequest;
import io.innait.wiam.adminbff.dto.VerifyOtpRequest;
import io.innait.wiam.common.redis.RedisCacheKeys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
public class ForgotPasswordService {

    private static final Logger log = LoggerFactory.getLogger(ForgotPasswordService.class);
    private static final UUID SYSTEM_ACTOR = UUID.fromString("00000000-0000-0000-0000-000000000000");

    private final StringRedisTemplate redisTemplate;
    private final IdentityServiceClient identityClient;
    private final CredentialServiceClient credentialClient;
    private final NotificationServiceClient notificationClient;
    private final SessionServiceClient sessionClient;
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${wiam.recovery.otp-length:6}")
    private int otpLength;

    @Value("${wiam.recovery.otp-ttl-seconds:300}")
    private long otpTtlSeconds;

    @Value("${wiam.recovery.reset-token-ttl-seconds:900}")
    private long resetTokenTtlSeconds;

    @Value("${wiam.recovery.max-forgot-attempts:3}")
    private int maxForgotAttempts;

    @Value("${wiam.recovery.forgot-rate-window-seconds:900}")
    private long forgotRateWindowSeconds;

    public ForgotPasswordService(StringRedisTemplate redisTemplate,
                                  IdentityServiceClient identityClient,
                                  CredentialServiceClient credentialClient,
                                  NotificationServiceClient notificationClient,
                                  SessionServiceClient sessionClient) {
        this.redisTemplate = redisTemplate;
        this.identityClient = identityClient;
        this.credentialClient = credentialClient;
        this.notificationClient = notificationClient;
        this.sessionClient = sessionClient;
    }

    /**
     * Initiates forgot password flow. Always returns the same response regardless of
     * whether the email exists to prevent account enumeration.
     */
    public Map<String, String> initiateForgotPassword(ForgotPasswordRequest request) {
        String email = request.email().toLowerCase().trim();

        // Rate limit check
        if (isRateLimited(email)) {
            log.warn("Forgot password rate limit exceeded for email [{}]", maskEmail(email));
            throw new IllegalStateException("Too many password reset requests. Please try again later.");
        }

        incrementRateLimit(email);

        // Look up user — timing-safe: always return same response
        Map<String, Object> user = null;
        try {
            user = identityClient.lookupByEmail(email);
        } catch (Exception e) {
            log.debug("User lookup failed during forgot password: {}", e.getMessage());
        }

        if (user != null) {
            String otp = generateOtp();
            UUID tenantId = extractUuid(user, "tenantId");

            // Store OTP in Redis
            String otpKey = RedisCacheKeys.otpKey("password_reset", extractUuid(user, "userId"));
            redisTemplate.opsForValue().set(otpKey, otp + ":" + email,
                    Duration.ofSeconds(otpTtlSeconds));

            // Send OTP via notification service
            if (tenantId != null) {
                notificationClient.sendEmail(tenantId, email, "password_reset_otp",
                        Map.of("otp", otp, "expiryMinutes", String.valueOf(otpTtlSeconds / 60)));
            }

            log.info("Forgot password OTP generated for email [{}]", maskEmail(email));
        } else {
            // Artificial delay to match timing of the found-user path
            try {
                Thread.sleep(150 + secureRandom.nextInt(100));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            log.debug("Forgot password request for non-existent email [{}]", maskEmail(email));
        }

        // Always return identical response
        return Map.of("message", "If an account exists with this email, you will receive a verification code.");
    }

    /**
     * Verifies the OTP and returns an opaque reset token.
     */
    public Map<String, String> verifyOtp(VerifyOtpRequest request) {
        String email = request.email().toLowerCase().trim();

        // Look up user by email to find their userId for the OTP key
        Map<String, Object> user = identityClient.lookupByEmail(email);
        if (user == null) {
            throw new IllegalArgumentException("Invalid or expired verification code.");
        }

        UUID userId = extractUuid(user, "userId");
        String otpKey = RedisCacheKeys.otpKey("password_reset", userId);
        String stored = redisTemplate.opsForValue().get(otpKey);

        if (stored == null) {
            throw new IllegalArgumentException("Invalid or expired verification code.");
        }

        // stored format: "otp:email"
        String[] parts = stored.split(":", 2);
        String storedOtp = parts[0];

        // Constant-time comparison
        if (!MessageDigest.isEqual(storedOtp.getBytes(), request.otp().getBytes())) {
            throw new IllegalArgumentException("Invalid or expired verification code.");
        }

        // OTP valid — delete it and generate reset token
        redisTemplate.delete(otpKey);

        String resetToken = UUID.randomUUID().toString();
        UUID accountId = extractUuid(user, "userId"); // userId serves as account identifier
        String resetKey = RedisCacheKeys.resetTokenKey(resetToken);
        redisTemplate.opsForValue().set(resetKey, accountId + ":" + email,
                Duration.ofSeconds(resetTokenTtlSeconds));

        log.info("OTP verified, reset token issued for email [{}]", maskEmail(email));
        return Map.of("resetToken", resetToken);
    }

    /**
     * Resets the password using the reset token. Revokes all existing sessions.
     */
    public Map<String, String> resetPassword(ResetPasswordRequest request) {
        String resetKey = RedisCacheKeys.resetTokenKey(request.resetToken());
        String stored = redisTemplate.opsForValue().get(resetKey);

        if (stored == null) {
            throw new IllegalArgumentException("Invalid or expired reset token.");
        }

        // stored format: "accountId:email"
        String[] parts = stored.split(":", 2);
        UUID accountId = UUID.fromString(parts[0]);
        String email = parts[1];

        // Reset password via credential service
        credentialClient.resetPassword(accountId, request.newPassword(), SYSTEM_ACTOR);

        // Revoke all existing sessions
        sessionClient.revokeAllAccountSessions(accountId);

        // Delete reset token
        redisTemplate.delete(resetKey);

        // Look up tenant for notification
        Map<String, Object> user = identityClient.lookupByEmail(email);
        if (user != null) {
            UUID tenantId = extractUuid(user, "tenantId");
            if (tenantId != null) {
                notificationClient.sendEmail(tenantId, email, "password_reset_success", Map.of());
            }
        }

        log.info("Password reset completed for account [{}]", accountId);
        return Map.of("message", "Password has been reset successfully.");
    }

    // ---- Private helpers ----

    boolean isRateLimited(String email) {
        String key = RedisCacheKeys.forgotRateLimitKey(email);
        String countStr = redisTemplate.opsForValue().get(key);
        if (countStr != null) {
            try {
                return Integer.parseInt(countStr) >= maxForgotAttempts;
            } catch (NumberFormatException e) {
                return false;
            }
        }
        return false;
    }

    private void incrementRateLimit(String email) {
        String key = RedisCacheKeys.forgotRateLimitKey(email);
        Long count = redisTemplate.opsForValue().increment(key);
        if (count != null && count == 1) {
            redisTemplate.expire(key, forgotRateWindowSeconds, TimeUnit.SECONDS);
        }
    }

    String generateOtp() {
        StringBuilder otp = new StringBuilder(otpLength);
        for (int i = 0; i < otpLength; i++) {
            otp.append(secureRandom.nextInt(10));
        }
        return otp.toString();
    }

    private UUID extractUuid(Map<String, Object> data, String key) {
        Object value = data.get(key);
        if (value instanceof UUID uuid) return uuid;
        if (value instanceof String str) {
            try {
                return UUID.fromString(str);
            } catch (IllegalArgumentException e) {
                return null;
            }
        }
        return null;
    }

    private String maskEmail(String email) {
        int at = email.indexOf('@');
        if (at <= 1) return "***@" + email.substring(at + 1);
        return email.charAt(0) + "***" + email.substring(at);
    }
}
