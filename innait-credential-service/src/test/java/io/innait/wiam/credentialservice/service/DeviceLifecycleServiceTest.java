package io.innait.wiam.credentialservice.service;

import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.exception.ResourceNotFoundException;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.kafka.InnaITTopics;
import io.innait.wiam.credentialservice.entity.*;
import io.innait.wiam.credentialservice.repository.DeviceLifecycleEventRepository;
import io.innait.wiam.credentialservice.repository.DeviceRegistryRepository;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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
class DeviceLifecycleServiceTest {

    @Mock private DeviceRegistryRepository deviceRepo;
    @Mock private DeviceLifecycleEventRepository eventRepo;
    @Mock private EventPublisher eventPublisher;

    @InjectMocks
    private DeviceLifecycleService service;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID deviceId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(tenantId);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    // ---- transitionDeviceStatus ----

    @Nested
    @DisplayName("transitionDeviceStatus")
    class TransitionDeviceStatus {

        @Test
        @DisplayName("should transition device and log lifecycle event")
        void shouldTransition() {
            DeviceRegistry device = createDevice(DeviceStatus.IN_STOCK);
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.of(device));
            when(deviceRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventPublisher.publish(anyString(), any()))
                    .thenReturn(CompletableFuture.completedFuture(null));

            UUID actorId = UUID.randomUUID();
            service.transitionDeviceStatus(deviceId, DeviceStatus.ALLOCATED, actorId, "Assigned to user");

            assertThat(device.getDeviceStatus()).isEqualTo(DeviceStatus.ALLOCATED);
            verify(deviceRepo).save(device);

            ArgumentCaptor<DeviceLifecycleEvent> eventCaptor =
                    ArgumentCaptor.forClass(DeviceLifecycleEvent.class);
            verify(eventRepo).save(eventCaptor.capture());
            DeviceLifecycleEvent savedEvent = eventCaptor.getValue();
            assertThat(savedEvent.getDeviceId()).isEqualTo(deviceId);
            assertThat(savedEvent.getOldStatus()).isEqualTo("IN_STOCK");
            assertThat(savedEvent.getNewStatus()).isEqualTo("ALLOCATED");
            assertThat(savedEvent.getActorId()).isEqualTo(actorId);
        }

        @Test
        @DisplayName("should publish DEVICE_ACTIVATED event when transitioning to ACTIVE")
        void shouldPublishActivatedEvent() {
            DeviceRegistry device = createDevice(DeviceStatus.ALLOCATED);
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.of(device));
            when(deviceRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventPublisher.publish(anyString(), any()))
                    .thenReturn(CompletableFuture.completedFuture(null));

            service.transitionDeviceStatus(deviceId, DeviceStatus.ACTIVE, null, "FIDO enrolled");

            // Should publish both STATUS_CHANGED and ACTIVATED
            verify(eventPublisher).publish(eq(InnaITTopics.DEVICE_STATUS_CHANGED), any(EventEnvelope.class));
            verify(eventPublisher).publish(eq(InnaITTopics.DEVICE_ACTIVATED), any(EventEnvelope.class));
        }

        @Test
        @DisplayName("should NOT publish DEVICE_ACTIVATED for non-ACTIVE transitions")
        void shouldNotPublishActivatedForOtherTransitions() {
            DeviceRegistry device = createDevice(DeviceStatus.ACTIVE);
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.of(device));
            when(deviceRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventPublisher.publish(anyString(), any()))
                    .thenReturn(CompletableFuture.completedFuture(null));

            service.transitionDeviceStatus(deviceId, DeviceStatus.REVOKED, null, "Revoked");

            verify(eventPublisher).publish(eq(InnaITTopics.DEVICE_STATUS_CHANGED), any(EventEnvelope.class));
            verify(eventPublisher, never()).publish(eq(InnaITTopics.DEVICE_ACTIVATED), any());
        }

        @Test
        @DisplayName("should fail when device not found")
        void shouldFailNotFound() {
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.empty());

            assertThatThrownBy(() ->
                    service.transitionDeviceStatus(deviceId, DeviceStatus.ALLOCATED, null, null))
                    .isInstanceOf(ResourceNotFoundException.class);
        }
    }

    // ---- syncDeviceStatusWithAssignmentStatus ----

    @Nested
    @DisplayName("syncDeviceStatusWithAssignmentStatus")
    class SyncStatus {

        @Test
        @DisplayName("ALLOCATED assignment should sync to ALLOCATED device status")
        void shouldSyncAllocated() {
            DeviceRegistry device = createDevice(DeviceStatus.IN_STOCK);
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.of(device));
            when(deviceRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.syncDeviceStatusWithAssignmentStatus(deviceId, AssignmentStatus.ALLOCATED);

            assertThat(device.getDeviceStatus()).isEqualTo(DeviceStatus.ALLOCATED);
        }

        @Test
        @DisplayName("ACTIVE assignment should sync to ACTIVE device status")
        void shouldSyncActive() {
            DeviceRegistry device = createDevice(DeviceStatus.ALLOCATED);
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.of(device));
            when(deviceRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.syncDeviceStatusWithAssignmentStatus(deviceId, AssignmentStatus.ACTIVE);

            assertThat(device.getDeviceStatus()).isEqualTo(DeviceStatus.ACTIVE);
        }

        @Test
        @DisplayName("REVOKED assignment should sync to REVOKED device status")
        void shouldSyncRevoked() {
            DeviceRegistry device = createDevice(DeviceStatus.ACTIVE);
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.of(device));
            when(deviceRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.syncDeviceStatusWithAssignmentStatus(deviceId, AssignmentStatus.REVOKED);

            assertThat(device.getDeviceStatus()).isEqualTo(DeviceStatus.REVOKED);
        }

        @Test
        @DisplayName("should skip sync when status already matches target")
        void shouldSkipWhenAlreadyMatched() {
            DeviceRegistry device = createDevice(DeviceStatus.ALLOCATED);
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.of(device));

            service.syncDeviceStatusWithAssignmentStatus(deviceId, AssignmentStatus.ALLOCATED);

            verify(deviceRepo, never()).save(any());
        }

        @Test
        @DisplayName("EXPIRED assignment should not change device status")
        void shouldNotChangeForExpired() {
            DeviceRegistry device = createDevice(DeviceStatus.ACTIVE);
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.of(device));

            service.syncDeviceStatusWithAssignmentStatus(deviceId, AssignmentStatus.EXPIRED);

            verify(deviceRepo, never()).save(any());
            assertThat(device.getDeviceStatus()).isEqualTo(DeviceStatus.ACTIVE);
        }
    }

    // ---- logLifecycleEvent ----

    @Test
    @DisplayName("should persist lifecycle event")
    void shouldLogEvent() {
        when(eventRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.logLifecycleEvent(deviceId, "STATUS_TRANSITION", "IN_STOCK", "ALLOCATED", null, "test");

        ArgumentCaptor<DeviceLifecycleEvent> captor = ArgumentCaptor.forClass(DeviceLifecycleEvent.class);
        verify(eventRepo).save(captor.capture());
        DeviceLifecycleEvent event = captor.getValue();
        assertThat(event.getDeviceId()).isEqualTo(deviceId);
        assertThat(event.getEventType()).isEqualTo("STATUS_TRANSITION");
        assertThat(event.getOldStatus()).isEqualTo("IN_STOCK");
        assertThat(event.getNewStatus()).isEqualTo("ALLOCATED");
    }

    // ---- getDeviceHistory ----

    @Test
    @DisplayName("should return lifecycle history for device")
    void shouldReturnHistory() {
        when(eventRepo.findByDeviceIdOrderByEventTimeDesc(deviceId)).thenReturn(List.of());
        List<DeviceLifecycleEvent> history = service.getDeviceHistory(deviceId);
        assertThat(history).isEmpty();
    }

    // ---- Helpers ----

    private DeviceRegistry createDevice(DeviceStatus status) {
        DeviceRegistry device = new DeviceRegistry();
        device.setId(deviceId);
        device.setTenantId(tenantId);
        device.setDeviceType(DeviceType.FIDO_KEY);
        device.setDeviceUniqueRef("FIDO-REF-001");
        device.setDeviceStatus(status);
        device.setOwnershipMode(OwnershipMode.DEDICATED);
        device.setActive(true);
        return device;
    }
}
