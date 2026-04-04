package io.innait.wiam.credentialservice.service;

import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
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

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DeviceAssignmentServiceTest {

    @Mock private DeviceAssignmentRepository assignmentRepo;
    @Mock private DeviceRegistryRepository deviceRepo;
    @Mock private DeviceValidationService validationService;
    @Mock private DeviceLifecycleService lifecycleService;
    @Mock private EventPublisher eventPublisher;

    @InjectMocks
    private DeviceAssignmentService service;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID deviceId = UUID.randomUUID();
    private final UUID accountId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();
    private final UUID adminId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(tenantId);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    // ---- assignDeviceToUser ----

    @Nested
    @DisplayName("assignDeviceToUser")
    class AssignDeviceToUser {

        @Test
        @DisplayName("should create assignment with ALLOCATED status")
        void shouldCreateAssignment() {
            when(assignmentRepo.save(any())).thenAnswer(inv -> {
                DeviceAssignment a = inv.getArgument(0);
                a.setId(UUID.randomUUID());
                return a;
            });
            when(eventPublisher.publish(anyString(), any()))
                    .thenReturn(CompletableFuture.completedFuture(null));

            DeviceAssignment result = service.assignDeviceToUser(deviceId, userId, accountId, adminId);

            assertThat(result.getDeviceId()).isEqualTo(deviceId);
            assertThat(result.getUserId()).isEqualTo(userId);
            assertThat(result.getAccountId()).isEqualTo(accountId);
            assertThat(result.getAssignmentStatus()).isEqualTo(AssignmentStatus.ALLOCATED);
            assertThat(result.getAssignmentType()).isEqualTo(AssignmentType.PRIMARY);
            assertThat(result.getDeliveryStatus()).isEqualTo(DeliveryStatus.PENDING_DISPATCH);
            assertThat(result.isActive()).isTrue();

            verify(validationService).validateDeviceAssignable(deviceId);
            verify(validationService).validateDeviceNotAlreadyAssigned(deviceId);
            verify(validationService).validateUserAccountBelongsToSameTenant(tenantId, accountId, userId);
            verify(lifecycleService).syncDeviceStatusWithAssignmentStatus(deviceId, AssignmentStatus.ALLOCATED);
            verify(eventPublisher).publish(anyString(), any(EventEnvelope.class));
        }

        @Test
        @DisplayName("should fail validation for non-assignable device")
        void shouldFailValidation() {
            doThrow(new IllegalStateException("Device is not active"))
                    .when(validationService).validateDeviceAssignable(deviceId);

            assertThatThrownBy(() -> service.assignDeviceToUser(deviceId, userId, accountId, adminId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("not active");
        }
    }

    // ---- assignDeviceToAccount ----

    @Nested
    @DisplayName("assignDeviceToAccount")
    class AssignDeviceToAccount {

        @Test
        @DisplayName("should create assignment without userId")
        void shouldCreateAccountOnlyAssignment() {
            when(assignmentRepo.save(any())).thenAnswer(inv -> {
                DeviceAssignment a = inv.getArgument(0);
                a.setId(UUID.randomUUID());
                return a;
            });
            when(eventPublisher.publish(anyString(), any()))
                    .thenReturn(CompletableFuture.completedFuture(null));

            DeviceAssignment result = service.assignDeviceToAccount(deviceId, accountId, adminId);

            assertThat(result.getUserId()).isNull();
            assertThat(result.getAccountId()).isEqualTo(accountId);
            verify(validationService, never())
                    .validateUserAccountBelongsToSameTenant(any(), any(), any());
        }
    }

    // ---- activateAssignment ----

    @Nested
    @DisplayName("activateAssignment")
    class ActivateAssignment {

        @Test
        @DisplayName("should transition assignment to ACTIVE")
        void shouldActivate() {
            UUID assignmentId = UUID.randomUUID();
            DeviceAssignment assignment = createAssignment(assignmentId, AssignmentStatus.ALLOCATED);
            when(assignmentRepo.findById(assignmentId)).thenReturn(Optional.of(assignment));
            when(assignmentRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventPublisher.publish(anyString(), any()))
                    .thenReturn(CompletableFuture.completedFuture(null));

            service.activateAssignment(assignmentId);

            assertThat(assignment.getAssignmentStatus()).isEqualTo(AssignmentStatus.ACTIVE);
            verify(lifecycleService).syncDeviceStatusWithAssignmentStatus(deviceId, AssignmentStatus.ACTIVE);
        }

        @Test
        @DisplayName("should fail when assignment not found")
        void shouldFailNotFound() {
            UUID assignmentId = UUID.randomUUID();
            when(assignmentRepo.findById(assignmentId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.activateAssignment(assignmentId))
                    .isInstanceOf(ResourceNotFoundException.class);
        }
    }

    // ---- revokeAssignment ----

    @Nested
    @DisplayName("revokeAssignment")
    class RevokeAssignment {

        @Test
        @DisplayName("should revoke assignment and set revocation details")
        void shouldRevoke() {
            UUID assignmentId = UUID.randomUUID();
            DeviceAssignment assignment = createAssignment(assignmentId, AssignmentStatus.ACTIVE);
            when(assignmentRepo.findById(assignmentId)).thenReturn(Optional.of(assignment));
            when(assignmentRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventPublisher.publish(anyString(), any()))
                    .thenReturn(CompletableFuture.completedFuture(null));

            service.revokeAssignment(assignmentId, adminId, "Security policy");

            assertThat(assignment.getAssignmentStatus()).isEqualTo(AssignmentStatus.REVOKED);
            assertThat(assignment.getRevokedBy()).isEqualTo(adminId);
            assertThat(assignment.getRevokedAt()).isNotNull();
            assertThat(assignment.getRevocationReason()).isEqualTo("Security policy");
            assertThat(assignment.isActive()).isFalse();
            verify(lifecycleService).syncDeviceStatusWithAssignmentStatus(deviceId, AssignmentStatus.REVOKED);
        }
    }

    // ---- returnDevice ----

    @Nested
    @DisplayName("returnDevice")
    class ReturnDevice {

        @Test
        @DisplayName("should return device and transition back to IN_STOCK")
        void shouldReturnDevice() {
            UUID assignmentId = UUID.randomUUID();
            DeviceAssignment assignment = createAssignment(assignmentId, AssignmentStatus.ACTIVE);
            when(assignmentRepo.findById(assignmentId)).thenReturn(Optional.of(assignment));
            when(assignmentRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventPublisher.publish(anyString(), any()))
                    .thenReturn(CompletableFuture.completedFuture(null));

            service.returnDevice(assignmentId, adminId);

            assertThat(assignment.getAssignmentStatus()).isEqualTo(AssignmentStatus.RETURNED);
            assertThat(assignment.isActive()).isFalse();
            verify(lifecycleService).syncDeviceStatusWithAssignmentStatus(deviceId, AssignmentStatus.RETURNED);
            verify(lifecycleService).transitionDeviceStatus(
                    eq(deviceId), eq(DeviceStatus.IN_STOCK), eq(adminId), anyString());
        }
    }

    // ---- reassignDevice ----

    @Nested
    @DisplayName("reassignDevice")
    class ReassignDevice {

        @Test
        @DisplayName("should revoke old assignment and create new one")
        void shouldReassign() {
            UUID newUserId = UUID.randomUUID();
            UUID newAccountId = UUID.randomUUID();

            DeviceAssignment oldAssignment = createAssignment(UUID.randomUUID(), AssignmentStatus.ACTIVE);
            when(assignmentRepo.findByDeviceIdAndActiveTrue(deviceId))
                    .thenReturn(Optional.of(oldAssignment));
            when(assignmentRepo.save(any())).thenAnswer(inv -> {
                DeviceAssignment a = inv.getArgument(0);
                if (a.getId() == null) a.setId(UUID.randomUUID());
                return a;
            });
            when(eventPublisher.publish(anyString(), any()))
                    .thenReturn(CompletableFuture.completedFuture(null));

            DeviceAssignment result = service.reassignDevice(deviceId, newUserId, newAccountId, adminId);

            // Old assignment should be revoked
            assertThat(oldAssignment.getAssignmentStatus()).isEqualTo(AssignmentStatus.REVOKED);
            assertThat(oldAssignment.isActive()).isFalse();
            assertThat(oldAssignment.getRevocationReason()).isEqualTo("Reassigned");

            // New assignment created
            assertThat(result.getAccountId()).isEqualTo(newAccountId);
            assertThat(result.getUserId()).isEqualTo(newUserId);
            assertThat(result.getAssignmentStatus()).isEqualTo(AssignmentStatus.ALLOCATED);
        }
    }

    // ---- Read operations ----

    @Nested
    @DisplayName("read operations")
    class ReadOperations {

        @Test
        @DisplayName("should list assigned devices for user")
        void shouldListForUser() {
            when(assignmentRepo.findByUserIdAndActiveTrue(userId)).thenReturn(List.of());
            List<DeviceAssignment> result = service.listAssignedDevicesForUser(userId);
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("should list assigned devices for account")
        void shouldListForAccount() {
            when(assignmentRepo.findByAccountIdAndActiveTrue(accountId)).thenReturn(List.of());
            List<DeviceAssignment> result = service.listAssignedDevicesForAccount(accountId);
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("should get available devices for tenant")
        void shouldGetAvailable() {
            when(deviceRepo.findAvailableDevices(tenantId)).thenReturn(List.of());
            List<DeviceRegistry> result = service.getAvailableDevices();
            assertThat(result).isEmpty();
        }
    }

    // ---- Helpers ----

    private DeviceAssignment createAssignment(UUID assignmentId, AssignmentStatus status) {
        DeviceAssignment assignment = new DeviceAssignment();
        assignment.setId(assignmentId);
        assignment.setTenantId(tenantId);
        assignment.setDeviceId(deviceId);
        assignment.setAccountId(accountId);
        assignment.setUserId(userId);
        assignment.setAssignmentType(AssignmentType.PRIMARY);
        assignment.setAssignmentStatus(status);
        assignment.setActive(true);
        return assignment;
    }
}
