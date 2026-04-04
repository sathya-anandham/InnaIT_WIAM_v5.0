package io.innait.wiam.credentialservice.integration;

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
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SpringBootTest
@ActiveProfiles("test")
@MockitoSettings(strictness = Strictness.LENIENT)
class DeviceBootstrapIntegrationTest {

    @Autowired private DeviceInventoryService inventoryService;
    @Autowired private DeviceAssignmentService assignmentService;
    @Autowired private DeviceValidationService validationService;
    @Autowired private MagicLinkBootstrapService magicLinkService;

    @Autowired private DeviceRegistryRepository deviceRepo;
    @Autowired private DeviceAssignmentRepository assignmentRepo;
    @Autowired private DeviceLifecycleEventRepository lifecycleEventRepo;
    @Autowired private AccountBootstrapStateRepository bootstrapStateRepo;
    @Autowired private AuthMagicLinkEventRepository magicLinkEventRepo;

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
        // Cleanup test data
        magicLinkEventRepo.deleteAll();
        bootstrapStateRepo.deleteAll();
        assignmentRepo.deleteAll();
        lifecycleEventRepo.deleteAll();
        deviceRepo.deleteAll();
    }

    // ---- Scenario 1: Full lifecycle ----

    @Test
    @DisplayName("1. Full lifecycle: register -> assign -> magic link -> verify -> FIDO -> activate")
    void fullLifecycle() {
        UUID accountId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        // 1. Register device
        DeviceRegistry device = inventoryService.registerDevice(
                DeviceType.FIDO_KEY, "FULL-LC-" + UUID.randomUUID().toString().substring(0, 8),
                "SN-FULL-001", "Yubico", "YubiKey 5", "USB-A",
                null, Instant.now(), null);
        assertThat(device.getDeviceStatus()).isEqualTo(DeviceStatus.IN_STOCK);
        assertThat(device.isActive()).isTrue();

        // 2. Assign device
        DeviceAssignment assignment = assignmentService.assignDeviceToUser(
                device.getId(), userId, accountId, adminId);
        assertThat(assignment.getAssignmentStatus()).isEqualTo(AssignmentStatus.ALLOCATED);

        // Verify device status synced
        DeviceRegistry updatedDevice = deviceRepo.findById(device.getId()).orElseThrow();
        assertThat(updatedDevice.getDeviceStatus()).isEqualTo(DeviceStatus.ALLOCATED);

        // 3. Create bootstrap state
        AccountBootstrapState bootstrapState = new AccountBootstrapState();
        bootstrapState.setTenantId(tenantId);
        bootstrapState.setAccountId(accountId);
        bootstrapState.setUserId(userId);
        bootstrapState.setBootstrapMethod(BootstrapMethod.MAGIC_LINK);
        bootstrapState.setBootstrapEnabled(true);
        bootstrapState.setFirstLoginPending(true);
        bootstrapState.setFidoEnrolled(false);
        bootstrapStateRepo.save(bootstrapState);

        // 4. Magic link eligibility check
        boolean allowed = magicLinkService.determineIfMagicLinkAllowed(accountId);
        assertThat(allowed).isTrue();

        // 5. Generate magic link
        UUID txnId = UUID.randomUUID();
        ReflectionTestUtils.setField(magicLinkService, "magicLinkTtlSeconds", 300L);
        ReflectionTestUtils.setField(magicLinkService, "maxResendLimit", 5);
        ReflectionTestUtils.setField(magicLinkService, "resendWindowSeconds", 3600L);

        String token = magicLinkService.generateMagicLink(accountId, txnId);
        assertThat(token).isNotBlank();

        // 6. Verify magic link
        String redisKey = RedisCacheKeys.magicLinkKey(txnId);
        when(valueOperations.get(redisKey)).thenReturn(accountId + ":" + token);

        boolean verified = magicLinkService.verifyMagicLink(token, txnId);
        assertThat(verified).isTrue();

        // Verify bootstrap state updated
        AccountBootstrapState verifiedState = bootstrapStateRepo.findByAccountId(accountId).orElseThrow();
        assertThat(verifiedState.getMagicLinkLastVerifiedAt()).isNotNull();
        assertThat(verifiedState.getMagicLinkUsedAt()).isNotNull();

        // 7. Validate enrollment allowed
        validationService.validateEnrollmentAllowed(accountId, device.getId());

        // 8. Activate assignment (simulating FIDO enrollment complete)
        assignmentService.activateAssignment(assignment.getId());
        DeviceAssignment activatedAssignment = assignmentRepo.findById(assignment.getId()).orElseThrow();
        assertThat(activatedAssignment.getAssignmentStatus()).isEqualTo(AssignmentStatus.ACTIVE);

        // 9. Disable bootstrap after FIDO
        magicLinkService.disableBootstrapAfterFidoActivation(accountId);
        AccountBootstrapState finalState = bootstrapStateRepo.findByAccountId(accountId).orElseThrow();
        assertThat(finalState.isBootstrapEnabled()).isFalse();
        assertThat(finalState.isFirstLoginPending()).isFalse();
        assertThat(finalState.isFidoEnrolled()).isTrue();

        // 10. Verify lifecycle events were logged
        List<DeviceLifecycleEvent> events = lifecycleEventRepo.findByDeviceIdOrderByEventTimeDesc(device.getId());
        assertThat(events).isNotEmpty();

        // 11. Verify Kafka events were published
        verify(eventPublisher, atLeast(3)).publish(anyString(), any(EventEnvelope.class));
    }

    // ---- Scenario 2: Enrollment without assignment ----

    @Test
    @DisplayName("2. FIDO enrollment without assignment should fail")
    void enrollmentWithoutAssignment() {
        UUID accountId = UUID.randomUUID();

        // Register device but don't assign
        DeviceRegistry device = inventoryService.registerDevice(
                DeviceType.FIDO_KEY, "NO-ASSIGN-" + UUID.randomUUID().toString().substring(0, 8),
                null, "Yubico", "YubiKey 5", null, null, null, null);

        assertThatThrownBy(() -> validationService.validateEnrollmentAllowed(accountId, device.getId()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("No active assignment found");
    }

    // ---- Scenario 3: Cross-tenant assignment ----

    @Test
    @DisplayName("3. Cross-tenant assignment should fail")
    void crossTenantAssignment() {
        UUID otherTenantId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        assertThatThrownBy(() ->
                validationService.validateUserAccountBelongsToSameTenant(otherTenantId, accountId, userId))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Cross-tenant assignment is not allowed");
    }

    // ---- Scenario 4: Reassign device ----

    @Test
    @DisplayName("4. Reassign device should close old assignment first")
    void reassignDevice() {
        UUID accountId1 = UUID.randomUUID();
        UUID accountId2 = UUID.randomUUID();
        UUID userId1 = UUID.randomUUID();
        UUID userId2 = UUID.randomUUID();

        // Register and assign
        DeviceRegistry device = inventoryService.registerDevice(
                DeviceType.FIDO_KEY, "REASSIGN-" + UUID.randomUUID().toString().substring(0, 8),
                null, "Yubico", "YubiKey 5", null, null, null, null);

        DeviceAssignment original = assignmentService.assignDeviceToUser(
                device.getId(), userId1, accountId1, adminId);

        // Reassign
        DeviceAssignment newAssignment = assignmentService.reassignDevice(
                device.getId(), userId2, accountId2, adminId);

        // Old assignment should be revoked
        DeviceAssignment oldAssignment = assignmentRepo.findById(original.getId()).orElseThrow();
        assertThat(oldAssignment.getAssignmentStatus()).isEqualTo(AssignmentStatus.REVOKED);
        assertThat(oldAssignment.isActive()).isFalse();
        assertThat(oldAssignment.getRevocationReason()).isEqualTo("Reassigned");

        // New assignment should be active
        assertThat(newAssignment.getAccountId()).isEqualTo(accountId2);
        assertThat(newAssignment.getUserId()).isEqualTo(userId2);
        assertThat(newAssignment.getAssignmentStatus()).isEqualTo(AssignmentStatus.ALLOCATED);
    }

    // ---- Scenario 5: Return device ----

    @Test
    @DisplayName("5. Return device should transition back to IN_STOCK")
    void returnDevice() {
        UUID accountId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        DeviceRegistry device = inventoryService.registerDevice(
                DeviceType.FIDO_KEY, "RETURN-" + UUID.randomUUID().toString().substring(0, 8),
                null, "Yubico", "YubiKey 5", null, null, null, null);

        DeviceAssignment assignment = assignmentService.assignDeviceToUser(
                device.getId(), userId, accountId, adminId);

        assignmentService.returnDevice(assignment.getId(), adminId);

        // Assignment should be returned
        DeviceAssignment returned = assignmentRepo.findById(assignment.getId()).orElseThrow();
        assertThat(returned.getAssignmentStatus()).isEqualTo(AssignmentStatus.RETURNED);
        assertThat(returned.isActive()).isFalse();

        // Device should be back in stock
        DeviceRegistry stockDevice = deviceRepo.findById(device.getId()).orElseThrow();
        assertThat(stockDevice.getDeviceStatus()).isEqualTo(DeviceStatus.IN_STOCK);
    }

    // ---- Scenario 6: Expired magic link ----

    @Test
    @DisplayName("6. Expired magic link should fail verification")
    void expiredMagicLink() {
        UUID accountId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID txnId = UUID.randomUUID();

        // Create bootstrap state
        AccountBootstrapState state = new AccountBootstrapState();
        state.setTenantId(tenantId);
        state.setAccountId(accountId);
        state.setUserId(userId);
        state.setBootstrapMethod(BootstrapMethod.MAGIC_LINK);
        state.setBootstrapEnabled(true);
        state.setFirstLoginPending(true);
        state.setFidoEnrolled(false);
        bootstrapStateRepo.save(state);

        // Simulate expired: Redis returns null
        when(valueOperations.get(RedisCacheKeys.magicLinkKey(txnId))).thenReturn(null);

        boolean result = magicLinkService.verifyMagicLink("any-token", txnId);
        assertThat(result).isFalse();
    }

    // ---- Scenario 7: Reused magic link ----

    @Test
    @DisplayName("7. Reused magic link should fail (already consumed)")
    void reusedMagicLink() {
        UUID txnId = UUID.randomUUID();

        // After first use, Redis key is deleted -> returns null
        when(valueOperations.get(RedisCacheKeys.magicLinkKey(txnId))).thenReturn(null);

        boolean result = magicLinkService.verifyMagicLink("previously-used-token", txnId);
        assertThat(result).isFalse();
    }

    // ---- Scenario 8: Magic link after FIDO activation ----

    @Test
    @DisplayName("8. Magic link should be blocked after FIDO activation")
    void magicLinkBlockedAfterFido() {
        UUID accountId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        // Create bootstrap state with FIDO already enrolled
        AccountBootstrapState state = new AccountBootstrapState();
        state.setTenantId(tenantId);
        state.setAccountId(accountId);
        state.setUserId(userId);
        state.setBootstrapMethod(BootstrapMethod.MAGIC_LINK);
        state.setBootstrapEnabled(false);
        state.setFirstLoginPending(false);
        state.setFidoEnrolled(true);
        bootstrapStateRepo.save(state);

        boolean allowed = magicLinkService.determineIfMagicLinkAllowed(accountId);
        assertThat(allowed).isFalse();

        // Attempting to generate should also fail
        assertThatThrownBy(() -> magicLinkService.generateMagicLink(accountId, UUID.randomUUID()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not allowed");
    }
}
