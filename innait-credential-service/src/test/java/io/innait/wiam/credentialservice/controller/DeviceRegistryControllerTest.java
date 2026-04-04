package io.innait.wiam.credentialservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.common.exception.GlobalExceptionHandler;
import io.innait.wiam.credentialservice.dto.*;
import io.innait.wiam.credentialservice.entity.*;
import io.innait.wiam.credentialservice.repository.AccountBootstrapStateRepository;
import io.innait.wiam.credentialservice.repository.DeviceAssignmentRepository;
import io.innait.wiam.credentialservice.repository.DeviceDeliveryLogRepository;
import io.innait.wiam.credentialservice.repository.DeviceRegistryRepository;
import io.innait.wiam.credentialservice.service.DeviceInventoryService;
import io.innait.wiam.credentialservice.service.DeviceLifecycleService;
import io.innait.wiam.credentialservice.service.DeviceValidationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(DeviceRegistryController.class)
@Import(GlobalExceptionHandler.class)
@AutoConfigureMockMvc(addFilters = false)
class DeviceRegistryControllerTest {

    private static final String BASE = "/api/v1/device-registry";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private DeviceInventoryService inventoryService;
    @MockBean private DeviceValidationService validationService;
    @MockBean private DeviceLifecycleService lifecycleService;
    @MockBean private DeviceRegistryRepository deviceRepo;
    @MockBean private DeviceAssignmentRepository assignmentRepo;
    @MockBean private DeviceDeliveryLogRepository deliveryLogRepo;
    @MockBean private AccountBootstrapStateRepository bootstrapStateRepo;

    private final UUID deviceId = UUID.randomUUID();
    private final UUID accountId = UUID.randomUUID();

    // ---- POST /api/v1/device-registry ----

    @Nested
    @DisplayName("POST /api/v1/device-registry")
    class RegisterDevice {

        @Test
        @DisplayName("should register device and return success")
        void shouldRegister() throws Exception {
            DeviceRegistry device = createDevice();
            when(inventoryService.registerDevice(any(), anyString(), any(), any(), any(), any(), any(), any(), any()))
                    .thenReturn(device);

            RegisterDeviceRequest request = new RegisterDeviceRequest(
                    "FIDO_KEY", "FIDO-REF-001", "SN-001",
                    "Yubico", "YubiKey 5", "USB-A",
                    null, null, null);

            mockMvc.perform(post(BASE)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.deviceId").value(deviceId.toString()))
                    .andExpect(jsonPath("$.data.deviceType").value("FIDO_KEY"))
                    .andExpect(jsonPath("$.data.deviceStatus").value("IN_STOCK"));
        }

        @Test
        @DisplayName("should reject missing deviceType")
        void shouldRejectMissingType() throws Exception {
            String body = """
                    {"deviceUniqueRef": "REF-001"}
                    """;

            mockMvc.perform(post(BASE)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isBadRequest());
        }
    }

    // ---- GET /api/v1/device-registry/{deviceId} ----

    @Nested
    @DisplayName("GET /api/v1/device-registry/{deviceId}")
    class GetDevice {

        @Test
        @DisplayName("should return device details")
        void shouldReturnDevice() throws Exception {
            DeviceRegistry device = createDevice();
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.of(device));

            mockMvc.perform(get(BASE + "/" + deviceId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.deviceId").value(deviceId.toString()))
                    .andExpect(jsonPath("$.data.deviceVendor").value("Yubico"));
        }

        @Test
        @DisplayName("should return 404 for unknown device")
        void shouldReturn404() throws Exception {
            when(deviceRepo.findById(any())).thenReturn(Optional.empty());

            mockMvc.perform(get(BASE + "/" + UUID.randomUUID()))
                    .andExpect(status().isNotFound());
        }
    }

    // ---- GET /api/v1/device-registry ----

    @Nested
    @DisplayName("GET /api/v1/device-registry (list)")
    class ListDevices {

        @Test
        @DisplayName("should return device list")
        void shouldList() throws Exception {
            DeviceRegistry device = createDevice();
            when(inventoryService.searchDevices(any(), any(), any(), any()))
                    .thenReturn(List.of(device));

            mockMvc.perform(get(BASE))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data").isArray())
                    .andExpect(jsonPath("$.data[0].deviceId").value(deviceId.toString()));
        }

        @Test
        @DisplayName("should accept filter parameters")
        void shouldFilter() throws Exception {
            when(inventoryService.searchDevices(eq(DeviceStatus.IN_STOCK), eq(DeviceType.FIDO_KEY), any(), any()))
                    .thenReturn(List.of());

            mockMvc.perform(get(BASE)
                            .param("status", "IN_STOCK")
                            .param("type", "FIDO_KEY"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data").isArray());
        }
    }

    // ---- POST /{deviceId}/retire ----

    @Nested
    @DisplayName("POST /{deviceId}/retire")
    class RetireDevice {

        @Test
        @DisplayName("should retire device and return success with no data")
        void shouldRetire() throws Exception {
            doNothing().when(inventoryService).retireDevice(eq(deviceId), any());

            mockMvc.perform(post(BASE + "/" + deviceId + "/retire"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data").doesNotExist());
        }
    }

    // ---- POST /{deviceId}/decommission ----

    @Nested
    @DisplayName("POST /{deviceId}/decommission")
    class DecommissionDevice {

        @Test
        @DisplayName("should decommission device and return success with no data")
        void shouldDecommission() throws Exception {
            doNothing().when(inventoryService).decommissionDevice(eq(deviceId), any());

            mockMvc.perform(post(BASE + "/" + deviceId + "/decommission"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data").doesNotExist());
        }
    }

    // ---- POST /validate-enrollment ----

    @Nested
    @DisplayName("POST /validate-enrollment")
    class ValidateEnrollment {

        @Test
        @DisplayName("should return allowed=true when validation passes")
        void shouldReturnAllowed() throws Exception {
            doNothing().when(validationService).validateEnrollmentAllowed(accountId, deviceId);

            ValidateEnrollmentRequest request = new ValidateEnrollmentRequest(accountId, deviceId);

            mockMvc.perform(post(BASE + "/validate-enrollment")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.allowed").value(true));
        }

        @Test
        @DisplayName("should return allowed=false with reason when validation fails")
        void shouldReturnNotAllowed() throws Exception {
            doThrow(new IllegalStateException("No active assignment found"))
                    .when(validationService).validateEnrollmentAllowed(accountId, deviceId);

            ValidateEnrollmentRequest request = new ValidateEnrollmentRequest(accountId, deviceId);

            mockMvc.perform(post(BASE + "/validate-enrollment")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.allowed").value(false))
                    .andExpect(jsonPath("$.data.reason").value("No active assignment found"));
        }
    }

    // ---- GET /account/{accountId}/eligible-devices ----

    @Nested
    @DisplayName("GET /account/{accountId}/eligible-devices")
    class EligibleDevices {

        @Test
        @DisplayName("should return eligible devices for account")
        void shouldReturnEligible() throws Exception {
            DeviceAssignment assignment = new DeviceAssignment();
            assignment.setDeviceId(deviceId);
            when(assignmentRepo.findEligibleAssignmentsByAccount(accountId))
                    .thenReturn(List.of(assignment));
            when(deviceRepo.findById(deviceId)).thenReturn(Optional.of(createDevice()));

            mockMvc.perform(get(BASE + "/account/" + accountId + "/eligible-devices"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data").isArray())
                    .andExpect(jsonPath("$.data[0].deviceId").value(deviceId.toString()));
        }
    }

    // ---- GET /account/{accountId}/bootstrap-state ----

    @Nested
    @DisplayName("GET /account/{accountId}/bootstrap-state")
    class BootstrapState {

        @Test
        @DisplayName("should return bootstrap state for account")
        void shouldReturnState() throws Exception {
            AccountBootstrapState state = new AccountBootstrapState();
            state.setId(UUID.randomUUID());
            state.setAccountId(accountId);
            state.setUserId(UUID.randomUUID());
            state.setBootstrapMethod(BootstrapMethod.MAGIC_LINK);
            state.setBootstrapEnabled(true);
            state.setFirstLoginPending(true);
            state.setFidoEnrolled(false);

            when(bootstrapStateRepo.findByAccountId(accountId)).thenReturn(Optional.of(state));

            mockMvc.perform(get(BASE + "/account/" + accountId + "/bootstrap-state"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.bootstrapEnabled").value(true))
                    .andExpect(jsonPath("$.data.firstLoginPending").value(true))
                    .andExpect(jsonPath("$.data.fidoEnrolled").value(false));
        }

        @Test
        @DisplayName("should return 404 when no bootstrap state exists")
        void shouldReturn404() throws Exception {
            when(bootstrapStateRepo.findByAccountId(any())).thenReturn(Optional.empty());

            mockMvc.perform(get(BASE + "/account/" + UUID.randomUUID() + "/bootstrap-state"))
                    .andExpect(status().isNotFound());
        }
    }

    // ---- GET /{deviceId}/lifecycle-history ----

    @Nested
    @DisplayName("GET /{deviceId}/lifecycle-history")
    class LifecycleHistory {

        @Test
        @DisplayName("should return lifecycle events for device")
        void shouldReturnHistory() throws Exception {
            DeviceLifecycleEvent event = new DeviceLifecycleEvent();
            event.setId(UUID.randomUUID());
            event.setDeviceId(deviceId);
            event.setEventType("STATUS_TRANSITION");
            event.setOldStatus("IN_STOCK");
            event.setNewStatus("ALLOCATED");
            event.setEventTime(Instant.now());

            when(lifecycleService.getDeviceHistory(deviceId)).thenReturn(List.of(event));

            mockMvc.perform(get(BASE + "/" + deviceId + "/lifecycle-history"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data").isArray())
                    .andExpect(jsonPath("$.data[0].eventType").value("STATUS_TRANSITION"));
        }
    }

    // ---- Helpers ----

    private DeviceRegistry createDevice() {
        DeviceRegistry device = new DeviceRegistry();
        device.setId(deviceId);
        device.setTenantId(UUID.randomUUID());
        device.setDeviceType(DeviceType.FIDO_KEY);
        device.setDeviceUniqueRef("FIDO-REF-001");
        device.setDeviceSerialNo("SN-001");
        device.setDeviceVendor("Yubico");
        device.setDeviceModel("YubiKey 5");
        device.setDeviceCategory("USB-A");
        device.setDeviceStatus(DeviceStatus.IN_STOCK);
        device.setOwnershipMode(OwnershipMode.DEDICATED);
        device.setActive(true);
        device.setCreatedAt(Instant.now());
        device.setUpdatedAt(Instant.now());
        return device;
    }
}
