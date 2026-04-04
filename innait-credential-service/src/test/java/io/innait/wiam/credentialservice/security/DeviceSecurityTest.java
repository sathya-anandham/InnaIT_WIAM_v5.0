package io.innait.wiam.credentialservice.security;

import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.redis.RedisCacheKeys;
import io.innait.wiam.credentialservice.entity.*;
import io.innait.wiam.credentialservice.repository.*;
import io.innait.wiam.credentialservice.service.*;
import org.junit.jupiter.api.*;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.context.ActiveProfiles;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SpringBootTest
@ActiveProfiles("test")
@MockitoSettings(strictness = Strictness.LENIENT)
class DeviceSecurityTest {

    @Autowired private DeviceValidationService validationService;
    @Autowired private DeviceInventoryService inventoryService;
    @Autowired private DeviceAssignmentService assignmentService;
    @Autowired private MagicLinkBootstrapService magicLinkService;
    @Autowired private BootstrapSessionService bootstrapSessionService;

    @Autowired private DeviceRegistryRepository deviceRepo;
    @Autowired private DeviceAssignmentRepository assignmentRepo;
    @Autowired private AccountBootstrapStateRepository bootstrapStateRepo;
    @Autowired private AuthMagicLinkEventRepository magicLinkEventRepo;
    @Autowired private DeviceLifecycleEventRepository lifecycleEventRepo;

    @MockBean private EventPublisher eventPublisher;
    @MockBean private StringRedisTemplate redisTemplate;

    private ValueOperations<String, String> valueOperations;

    private final UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private final UUID adminId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(tenantId);
        when(eventPublisher.publish(anyString(), any()))
                .thenReturn(CompletableFuture.completedFuture(null));

        @SuppressWarnings("unchecked")
        ValueOperations<String, String> ops = mock(ValueOperations.class);
        valueOperations = ops;
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(redisTemplate.delete(anyString())).thenReturn(true);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        magicLinkEventRepo.deleteAll();
        bootstrapStateRepo.deleteAll();
        assignmentRepo.deleteAll();
        lifecycleEventRepo.deleteAll();
        deviceRepo.deleteAll();
    }

    // ---- Security Test 1: Cross-user device access ----

    @Test
    @DisplayName("user cannot access another user's assigned device")
    void crossUserDeviceAccess() {
        UUID userA = UUID.randomUUID();
        UUID userB = UUID.randomUUID();
        UUID accountA = UUID.randomUUID();
        DeviceRegistry device = inventoryService.registerDevice(
                DeviceType.FIDO_KEY, "SEC-CROSS-USER-" + UUID.randomUUID().toString().substring(0, 8),
                null, "Yubico", "YubiKey 5", null, null, null, null);

        // Assign to user A
        assignmentService.assignDeviceToUser(device.getId(), userA, accountA, adminId);

        // User B should not be able to use this device
        assertThatThrownBy(() ->
                validationService.validateAuthenticatedUserCanUseAssignedDevice(userB, accountA, device.getId()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not assigned to user");
    }

    // ---- Security Test 2: Cross-tenant assignment ----

    @Test
    @DisplayName("tenant A admin cannot assign tenant B device")
    void crossTenantAssignment() {
        UUID tenantB = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        // Tenant context is tenantA, but trying to assign with tenantB
        assertThatThrownBy(() ->
                validationService.validateUserAccountBelongsToSameTenant(tenantB, accountId, userId))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Cross-tenant");
    }

    // ---- Security Test 3: Revoked device blocked in enrollment ----

    @Test
    @DisplayName("revoked device blocked in enrollment")
    void revokedDeviceBlockedInEnrollment() {
        UUID accountId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        DeviceRegistry device = inventoryService.registerDevice(
                DeviceType.FIDO_KEY, "SEC-REVOKED-" + UUID.randomUUID().toString().substring(0, 8),
                null, "Yubico", "YubiKey 5", null, null, null, null);

        // Assign and then revoke
        DeviceAssignment assignment = assignmentService.assignDeviceToUser(
                device.getId(), userId, accountId, adminId);
        assignmentService.revokeAssignment(assignment.getId(), adminId, "Security incident");

        // Enrollment should be blocked
        assertThatThrownBy(() -> validationService.validateEnrollmentAllowed(accountId, device.getId()))
                .isInstanceOf(IllegalStateException.class);
    }

    // ---- Security Test 4: Bootstrap session validation ----

    @Test
    @DisplayName("bootstrap session blocked from non-onboarding APIs (invalid type)")
    void bootstrapSessionBlockedNonOnboarding() {
        com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();

        // Create a non-bootstrap session
        UUID sessionId = UUID.randomUUID();
        String key = RedisCacheKeys.bootstrapSessionKey(sessionId);

        try {
            String json = objectMapper.writeValueAsString(
                    java.util.Map.of("type", "INTERACTIVE", "restricted", "true"));
            when(valueOperations.get(key)).thenReturn(json);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        assertThatThrownBy(() -> bootstrapSessionService.validateBootstrapSessionForOnboarding(sessionId))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Invalid session type");
    }

    // ---- Security Test 5: No user enumeration on magic link verify ----

    @Test
    @DisplayName("public magic-link verify endpoint does not leak user existence")
    void noUserEnumeration() {
        UUID txnId = UUID.randomUUID();

        // Non-existent txn -> returns false, not exception with user info
        when(valueOperations.get(RedisCacheKeys.magicLinkKey(txnId))).thenReturn(null);

        boolean result = magicLinkService.verifyMagicLink("any-token", txnId);

        // Should return false, not throw revealing exception
        assertThat(result).isFalse();
    }

    // ---- Security Test 6: Token tampering ----

    @Test
    @DisplayName("magic link token tampering fails")
    void tokenTampering() {
        UUID accountId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID txnId = UUID.randomUUID();

        // Set up bootstrap state
        AccountBootstrapState state = new AccountBootstrapState();
        state.setTenantId(tenantId);
        state.setAccountId(accountId);
        state.setUserId(userId);
        state.setBootstrapMethod(BootstrapMethod.MAGIC_LINK);
        state.setBootstrapEnabled(true);
        state.setFirstLoginPending(true);
        state.setFidoEnrolled(false);
        bootstrapStateRepo.save(state);

        // Redis has correct token
        String correctToken = "correct-secret-token";
        String redisValue = accountId + ":" + correctToken;
        when(valueOperations.get(RedisCacheKeys.magicLinkKey(txnId))).thenReturn(redisValue);

        // Try with tampered token
        boolean result = magicLinkService.verifyMagicLink("tampered-token", txnId);
        assertThat(result).isFalse();

        // Verify FAILED event was logged
        var failedEvents = magicLinkEventRepo.findByAccountIdAndEventStatus(
                accountId, MagicLinkEventStatus.FAILED);
        assertThat(failedEvents).isNotEmpty();
        assertThat(failedEvents.get(0).getDetail()).isEqualTo("Token mismatch");
    }

    // ---- Security Test 7: Expired magic link token ----

    @Test
    @DisplayName("expired magic link token fails verification")
    void expiredMagicLinkToken() {
        UUID txnId = UUID.randomUUID();

        // Redis returns null (expired)
        when(valueOperations.get(RedisCacheKeys.magicLinkKey(txnId))).thenReturn(null);

        boolean result = magicLinkService.verifyMagicLink("any-token", txnId);
        assertThat(result).isFalse();

        // Verify expired event was published
        verify(eventPublisher).publish(
                eq(io.innait.wiam.common.kafka.InnaITTopics.MAGIC_LINK_EXPIRED),
                any(EventEnvelope.class));
    }

    // ---- Security Test 8: Reused magic link token ----

    @Test
    @DisplayName("reused magic link token fails (single-use enforcement)")
    void reusedMagicLinkToken() {
        UUID accountId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID txnId = UUID.randomUUID();

        AccountBootstrapState state = new AccountBootstrapState();
        state.setTenantId(tenantId);
        state.setAccountId(accountId);
        state.setUserId(userId);
        state.setBootstrapMethod(BootstrapMethod.MAGIC_LINK);
        state.setBootstrapEnabled(true);
        state.setFirstLoginPending(true);
        state.setFidoEnrolled(false);
        bootstrapStateRepo.save(state);

        String token = "one-time-token";
        String redisValue = accountId + ":" + token;
        String redisKey = RedisCacheKeys.magicLinkKey(txnId);

        // First use: token present
        when(valueOperations.get(redisKey)).thenReturn(redisValue);
        boolean firstResult = magicLinkService.verifyMagicLink(token, txnId);
        assertThat(firstResult).isTrue();
        verify(redisTemplate).delete(redisKey);

        // Second use: token deleted from Redis
        when(valueOperations.get(redisKey)).thenReturn(null);
        boolean secondResult = magicLinkService.verifyMagicLink(token, txnId);
        assertThat(secondResult).isFalse();
    }
}
