package io.innait.wiam.credentialservice.service;

import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.exception.ResourceNotFoundException;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.credentialservice.entity.*;
import io.innait.wiam.credentialservice.repository.DeviceAssignmentRepository;
import io.innait.wiam.credentialservice.repository.DeviceRegistryRepository;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DeviceValidationServiceTest {

    @Mock private DeviceRegistryRepository deviceRepo;
    @Mock private DeviceAssignmentRepository assignmentRepo;
    @Mock private EventPublisher eventPublisher;

    @InjectMocks
    private DeviceValidationService service;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID deviceId = UUID.randomUUID();
    private final UUID accountId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(tenantId);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    // ---- validateDeviceAssignable ----

    @Nested
    @DisplayName("validateDeviceAssignable")
    class ValidateDeviceAssignable {

        @Test
        @DisplayName("should pass when device is active and IN_STOCK")
        void shouldPassForActiveInStockDevice() {
            DeviceRegistry device = createDevice(DeviceStatus.IN_STOCK, true);
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.of(device));

            service.validateDeviceAssignable(deviceId);
        }

        @Test
        @DisplayName("should fail when device not found")
        void shouldFailWhenDeviceNotFound() {
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.validateDeviceAssignable(deviceId))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("should fail when device is inactive")
        void shouldFailWhenDeviceInactive() {
            DeviceRegistry device = createDevice(DeviceStatus.IN_STOCK, false);
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.of(device));

            assertThatThrownBy(() -> service.validateDeviceAssignable(deviceId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("not active");
        }

        @Test
        @DisplayName("should fail when device is RETIRED")
        void shouldFailWhenDeviceRetired() {
            DeviceRegistry device = createDevice(DeviceStatus.RETIRED, true);
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.of(device));

            assertThatThrownBy(() -> service.validateDeviceAssignable(deviceId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("not available for assignment");
        }

        @Test
        @DisplayName("should fail when device is REVOKED")
        void shouldFailWhenDeviceRevoked() {
            DeviceRegistry device = createDevice(DeviceStatus.REVOKED, true);
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.of(device));

            assertThatThrownBy(() -> service.validateDeviceAssignable(deviceId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("not available for assignment");
        }

        @Test
        @DisplayName("should fail when device is LOST")
        void shouldFailWhenDeviceLost() {
            DeviceRegistry device = createDevice(DeviceStatus.LOST, true);
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.of(device));

            assertThatThrownBy(() -> service.validateDeviceAssignable(deviceId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("not available for assignment");
        }

        @Test
        @DisplayName("should fail when device is DAMAGED")
        void shouldFailWhenDeviceDamaged() {
            DeviceRegistry device = createDevice(DeviceStatus.DAMAGED, true);
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.of(device));

            assertThatThrownBy(() -> service.validateDeviceAssignable(deviceId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("not available for assignment");
        }

        @Test
        @DisplayName("should fail when device is DECOMMISSIONED")
        void shouldFailWhenDeviceDecommissioned() {
            DeviceRegistry device = createDevice(DeviceStatus.DECOMMISSIONED, true);
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.of(device));

            assertThatThrownBy(() -> service.validateDeviceAssignable(deviceId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("not available for assignment");
        }

        @Test
        @DisplayName("should fail when device is already ALLOCATED")
        void shouldFailWhenDeviceAllocated() {
            DeviceRegistry device = createDevice(DeviceStatus.ALLOCATED, true);
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.of(device));

            assertThatThrownBy(() -> service.validateDeviceAssignable(deviceId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("not available for assignment");
        }
    }

    // ---- validateDeviceNotAlreadyAssigned ----

    @Nested
    @DisplayName("validateDeviceNotAlreadyAssigned")
    class ValidateDeviceNotAlreadyAssigned {

        @Test
        @DisplayName("should pass when no active assignment exists")
        void shouldPassNoActiveAssignment() {
            when(assignmentRepo.countByDeviceIdAndActiveTrue(deviceId)).thenReturn(0L);

            service.validateDeviceNotAlreadyAssigned(deviceId);
        }

        @Test
        @DisplayName("dedicated device cannot have more than one active assignment")
        void shouldFailWhenActiveAssignmentExists() {
            when(assignmentRepo.countByDeviceIdAndActiveTrue(deviceId)).thenReturn(1L);

            assertThatThrownBy(() -> service.validateDeviceNotAlreadyAssigned(deviceId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("already has an active assignment");
        }
    }

    // ---- validateUserAccountBelongsToSameTenant ----

    @Nested
    @DisplayName("validateUserAccountBelongsToSameTenant")
    class ValidateTenant {

        @Test
        @DisplayName("should pass when tenant matches context")
        void shouldPassMatchingTenant() {
            service.validateUserAccountBelongsToSameTenant(tenantId, accountId, userId);
        }

        @Test
        @DisplayName("cross-tenant assignment should fail")
        void shouldFailCrossTenant() {
            UUID otherTenant = UUID.randomUUID();

            assertThatThrownBy(() ->
                    service.validateUserAccountBelongsToSameTenant(otherTenant, accountId, userId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Cross-tenant assignment is not allowed");
        }
    }

    // ---- validateEnrollmentAllowed ----

    @Nested
    @DisplayName("validateEnrollmentAllowed")
    class ValidateEnrollmentAllowed {

        @Test
        @DisplayName("should pass for ALLOCATED assignment and ALLOCATED device")
        void shouldPassAllocatedAssignmentAllocatedDevice() {
            DeviceAssignment assignment = createAssignment(AssignmentStatus.ALLOCATED);
            DeviceRegistry device = createDevice(DeviceStatus.ALLOCATED, true);
            when(assignmentRepo.findActiveByDeviceAndAccount(deviceId, accountId))
                    .thenReturn(Optional.of(assignment));
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.of(device));

            service.validateEnrollmentAllowed(accountId, deviceId);
        }

        @Test
        @DisplayName("should pass for PENDING assignment and PENDING_ACTIVATION device")
        void shouldPassPendingAssignmentPendingDevice() {
            DeviceAssignment assignment = createAssignment(AssignmentStatus.PENDING);
            DeviceRegistry device = createDevice(DeviceStatus.PENDING_ACTIVATION, true);
            when(assignmentRepo.findActiveByDeviceAndAccount(deviceId, accountId))
                    .thenReturn(Optional.of(assignment));
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.of(device));

            service.validateEnrollmentAllowed(accountId, deviceId);
        }

        @Test
        @DisplayName("should fail without assignment and publish ENROLLMENT_BLOCKED event")
        void shouldFailWithoutAssignment() {
            when(assignmentRepo.findActiveByDeviceAndAccount(deviceId, accountId))
                    .thenReturn(Optional.empty());
            when(eventPublisher.publish(anyString(), any()))
                    .thenReturn(CompletableFuture.completedFuture(null));

            assertThatThrownBy(() -> service.validateEnrollmentAllowed(accountId, deviceId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("No active assignment found");

            verify(eventPublisher).publish(anyString(), any());
        }

        @Test
        @DisplayName("should fail for REVOKED assignment status")
        void shouldFailRevokedAssignment() {
            DeviceAssignment assignment = createAssignment(AssignmentStatus.REVOKED);
            when(assignmentRepo.findActiveByDeviceAndAccount(deviceId, accountId))
                    .thenReturn(Optional.of(assignment));
            when(eventPublisher.publish(anyString(), any()))
                    .thenReturn(CompletableFuture.completedFuture(null));

            assertThatThrownBy(() -> service.validateEnrollmentAllowed(accountId, deviceId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("not in a state that allows enrollment");
        }

        @Test
        @DisplayName("should fail for ACTIVE device status (already enrolled)")
        void shouldFailActiveDevice() {
            DeviceAssignment assignment = createAssignment(AssignmentStatus.ALLOCATED);
            DeviceRegistry device = createDevice(DeviceStatus.ACTIVE, true);
            when(assignmentRepo.findActiveByDeviceAndAccount(deviceId, accountId))
                    .thenReturn(Optional.of(assignment));
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.of(device));
            when(eventPublisher.publish(anyString(), any()))
                    .thenReturn(CompletableFuture.completedFuture(null));

            assertThatThrownBy(() -> service.validateEnrollmentAllowed(accountId, deviceId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Device is not in a state that allows enrollment");
        }

        @Test
        @DisplayName("should fail for REVOKED device and publish ENROLLMENT_BLOCKED event")
        void shouldFailRevokedDevice() {
            DeviceAssignment assignment = createAssignment(AssignmentStatus.ALLOCATED);
            DeviceRegistry device = createDevice(DeviceStatus.REVOKED, true);
            when(assignmentRepo.findActiveByDeviceAndAccount(deviceId, accountId))
                    .thenReturn(Optional.of(assignment));
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.of(device));
            when(eventPublisher.publish(anyString(), any()))
                    .thenReturn(CompletableFuture.completedFuture(null));

            assertThatThrownBy(() -> service.validateEnrollmentAllowed(accountId, deviceId))
                    .isInstanceOf(IllegalStateException.class);

            verify(eventPublisher).publish(anyString(), any());
        }
    }

    // ---- validateAuthenticatedUserCanUseAssignedDevice ----

    @Nested
    @DisplayName("validateAuthenticatedUserCanUseAssignedDevice")
    class ValidateAuthenticatedUser {

        @Test
        @DisplayName("should pass when user matches assignment")
        void shouldPassMatchingUser() {
            DeviceAssignment assignment = createAssignment(AssignmentStatus.ACTIVE);
            assignment.setUserId(userId);
            when(assignmentRepo.findActiveByDeviceAndAccount(deviceId, accountId))
                    .thenReturn(Optional.of(assignment));

            service.validateAuthenticatedUserCanUseAssignedDevice(userId, accountId, deviceId);
        }

        @Test
        @DisplayName("should pass when assignment has no userId (account-only)")
        void shouldPassNoUserId() {
            DeviceAssignment assignment = createAssignment(AssignmentStatus.ACTIVE);
            assignment.setUserId(null);
            when(assignmentRepo.findActiveByDeviceAndAccount(deviceId, accountId))
                    .thenReturn(Optional.of(assignment));

            service.validateAuthenticatedUserCanUseAssignedDevice(userId, accountId, deviceId);
        }

        @Test
        @DisplayName("user cannot access another user's assigned device")
        void shouldFailDifferentUser() {
            UUID otherUserId = UUID.randomUUID();
            DeviceAssignment assignment = createAssignment(AssignmentStatus.ACTIVE);
            assignment.setUserId(otherUserId);
            when(assignmentRepo.findActiveByDeviceAndAccount(deviceId, accountId))
                    .thenReturn(Optional.of(assignment));

            assertThatThrownBy(() ->
                    service.validateAuthenticatedUserCanUseAssignedDevice(userId, accountId, deviceId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("not assigned to user");
        }

        @Test
        @DisplayName("should fail when assignment is inactive")
        void shouldFailInactiveAssignment() {
            DeviceAssignment assignment = createAssignment(AssignmentStatus.ACTIVE);
            assignment.setUserId(userId);
            assignment.setActive(false);
            when(assignmentRepo.findActiveByDeviceAndAccount(deviceId, accountId))
                    .thenReturn(Optional.of(assignment));

            assertThatThrownBy(() ->
                    service.validateAuthenticatedUserCanUseAssignedDevice(userId, accountId, deviceId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("not active");
        }
    }

    // ---- Helpers ----

    private DeviceRegistry createDevice(DeviceStatus status, boolean active) {
        DeviceRegistry device = new DeviceRegistry();
        device.setId(deviceId);
        device.setTenantId(tenantId);
        device.setDeviceType(DeviceType.FIDO_KEY);
        device.setDeviceUniqueRef("FIDO-" + UUID.randomUUID().toString().substring(0, 8));
        device.setDeviceStatus(status);
        device.setOwnershipMode(OwnershipMode.DEDICATED);
        device.setActive(active);
        return device;
    }

    private DeviceAssignment createAssignment(AssignmentStatus status) {
        DeviceAssignment assignment = new DeviceAssignment();
        assignment.setId(UUID.randomUUID());
        assignment.setTenantId(tenantId);
        assignment.setDeviceId(deviceId);
        assignment.setAccountId(accountId);
        assignment.setAssignmentType(AssignmentType.PRIMARY);
        assignment.setAssignmentStatus(status);
        assignment.setActive(true);
        return assignment;
    }
}
