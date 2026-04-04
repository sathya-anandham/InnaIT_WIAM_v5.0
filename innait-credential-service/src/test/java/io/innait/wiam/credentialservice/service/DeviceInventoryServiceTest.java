package io.innait.wiam.credentialservice.service;

import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.exception.ResourceNotFoundException;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.credentialservice.entity.*;
import io.innait.wiam.credentialservice.repository.DeviceRegistryRepository;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DeviceInventoryServiceTest {

    @Mock private DeviceRegistryRepository deviceRepo;
    @Mock private DeviceLifecycleService lifecycleService;
    @Mock private EventPublisher eventPublisher;

    @InjectMocks
    private DeviceInventoryService service;

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

    // ---- registerDevice ----

    @Nested
    @DisplayName("registerDevice")
    class RegisterDevice {

        @Test
        @DisplayName("should register a new FIDO device with IN_STOCK status")
        void shouldRegisterDevice() {
            when(deviceRepo.findByTenantIdAndDeviceUniqueRef(tenantId, "FIDO-REF-001"))
                    .thenReturn(Optional.empty());
            when(deviceRepo.findByTenantIdAndDeviceSerialNo(tenantId, "SN-001"))
                    .thenReturn(Optional.empty());
            when(deviceRepo.save(any())).thenAnswer(inv -> {
                DeviceRegistry d = inv.getArgument(0);
                d.setId(deviceId);
                return d;
            });
            when(eventPublisher.publish(anyString(), any()))
                    .thenReturn(CompletableFuture.completedFuture(null));

            DeviceRegistry result = service.registerDevice(
                    DeviceType.FIDO_KEY, "FIDO-REF-001", "SN-001",
                    "Yubico", "YubiKey 5", "USB-A",
                    null, Instant.now(), null);

            assertThat(result.getDeviceStatus()).isEqualTo(DeviceStatus.IN_STOCK);
            assertThat(result.getOwnershipMode()).isEqualTo(OwnershipMode.DEDICATED);
            assertThat(result.isActive()).isTrue();

            verify(lifecycleService).logLifecycleEvent(eq(deviceId), eq("DEVICE_REGISTERED"),
                    isNull(), eq("IN_STOCK"), isNull(), isNull());
            verify(eventPublisher).publish(anyString(), any(EventEnvelope.class));
        }

        @Test
        @DisplayName("should reject duplicate unique ref within tenant")
        void shouldRejectDuplicateUniqueRef() {
            when(deviceRepo.findByTenantIdAndDeviceUniqueRef(tenantId, "FIDO-REF-001"))
                    .thenReturn(Optional.of(new DeviceRegistry()));

            assertThatThrownBy(() -> service.registerDevice(
                    DeviceType.FIDO_KEY, "FIDO-REF-001", null,
                    "Yubico", "YubiKey 5", null, null, null, null))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("already exists");
        }

        @Test
        @DisplayName("should reject duplicate serial number within tenant")
        void shouldRejectDuplicateSerialNo() {
            when(deviceRepo.findByTenantIdAndDeviceUniqueRef(tenantId, "FIDO-REF-002"))
                    .thenReturn(Optional.empty());
            when(deviceRepo.findByTenantIdAndDeviceSerialNo(tenantId, "SN-DUP"))
                    .thenReturn(Optional.of(new DeviceRegistry()));

            assertThatThrownBy(() -> service.registerDevice(
                    DeviceType.FIDO_KEY, "FIDO-REF-002", "SN-DUP",
                    "Yubico", "YubiKey 5", null, null, null, null))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("serial number already exists");
        }
    }

    // ---- bulkImportDevices ----

    @Nested
    @DisplayName("bulkImportDevices")
    class BulkImport {

        @Test
        @DisplayName("should import multiple devices and set defaults")
        void shouldBulkImport() {
            DeviceRegistry d1 = new DeviceRegistry();
            d1.setDeviceUniqueRef("REF-1");
            DeviceRegistry d2 = new DeviceRegistry();
            d2.setDeviceUniqueRef("REF-2");

            when(deviceRepo.save(any())).thenAnswer(inv -> {
                DeviceRegistry d = inv.getArgument(0);
                d.setId(UUID.randomUUID());
                return d;
            });

            List<DeviceRegistry> result = service.bulkImportDevices(List.of(d1, d2));

            assertThat(result).hasSize(2);
            result.forEach(d -> {
                assertThat(d.getDeviceStatus()).isEqualTo(DeviceStatus.IN_STOCK);
                assertThat(d.getOwnershipMode()).isEqualTo(OwnershipMode.DEDICATED);
                assertThat(d.isActive()).isTrue();
            });
            verify(lifecycleService, times(2)).logLifecycleEvent(
                    any(UUID.class), eq("DEVICE_IMPORTED"),
                    isNull(), eq("IN_STOCK"), isNull(), eq("Bulk import"));
        }
    }

    // ---- updateDeviceMetadata ----

    @Nested
    @DisplayName("updateDeviceMetadata")
    class UpdateMetadata {

        @Test
        @DisplayName("should update only non-null fields")
        void shouldUpdateMetadata() {
            DeviceRegistry device = createDevice();
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.of(device));
            when(deviceRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventPublisher.publish(anyString(), any()))
                    .thenReturn(CompletableFuture.completedFuture(null));

            DeviceRegistry result = service.updateDeviceMetadata(deviceId, "NewVendor", null, null, null);

            assertThat(result.getDeviceVendor()).isEqualTo("NewVendor");
            assertThat(result.getDeviceModel()).isEqualTo("YubiKey 5"); // unchanged
        }

        @Test
        @DisplayName("should fail when device not found")
        void shouldFailNotFound() {
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.updateDeviceMetadata(deviceId, null, null, null, null))
                    .isInstanceOf(ResourceNotFoundException.class);
        }
    }

    // ---- retireDevice ----

    @Nested
    @DisplayName("retireDevice")
    class RetireDevice {

        @Test
        @DisplayName("should deactivate and transition to RETIRED")
        void shouldRetire() {
            DeviceRegistry device = createDevice();
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.of(device));
            when(deviceRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventPublisher.publish(anyString(), any()))
                    .thenReturn(CompletableFuture.completedFuture(null));

            service.retireDevice(deviceId, UUID.randomUUID());

            assertThat(device.isActive()).isFalse();
            verify(lifecycleService).transitionDeviceStatus(eq(deviceId), eq(DeviceStatus.RETIRED), any(), anyString());
            verify(eventPublisher).publish(anyString(), any(EventEnvelope.class));
        }
    }

    // ---- decommissionDevice ----

    @Nested
    @DisplayName("decommissionDevice")
    class DecommissionDevice {

        @Test
        @DisplayName("should deactivate and transition to DECOMMISSIONED")
        void shouldDecommission() {
            DeviceRegistry device = createDevice();
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.of(device));
            when(deviceRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventPublisher.publish(anyString(), any()))
                    .thenReturn(CompletableFuture.completedFuture(null));

            service.decommissionDevice(deviceId, UUID.randomUUID());

            assertThat(device.isActive()).isFalse();
            verify(lifecycleService).transitionDeviceStatus(eq(deviceId), eq(DeviceStatus.DECOMMISSIONED), any(), anyString());
            verify(eventPublisher).publish(anyString(), any(EventEnvelope.class));
        }
    }

    // ---- Helpers ----

    private DeviceRegistry createDevice() {
        DeviceRegistry device = new DeviceRegistry();
        device.setId(deviceId);
        device.setTenantId(tenantId);
        device.setDeviceType(DeviceType.FIDO_KEY);
        device.setDeviceUniqueRef("FIDO-REF-001");
        device.setDeviceSerialNo("SN-001");
        device.setDeviceVendor("Yubico");
        device.setDeviceModel("YubiKey 5");
        device.setDeviceStatus(DeviceStatus.IN_STOCK);
        device.setOwnershipMode(OwnershipMode.DEDICATED);
        device.setActive(true);
        return device;
    }
}
