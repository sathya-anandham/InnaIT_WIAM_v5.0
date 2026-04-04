package io.innait.wiam.adminbff.client;

import io.innait.wiam.adminbff.config.BffProperties;
import io.innait.wiam.common.dto.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * REST client for credential-service device registry and assignment APIs.
 */
@Component
public class DeviceServiceClient {

    private static final Logger log = LoggerFactory.getLogger(DeviceServiceClient.class);

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public DeviceServiceClient(RestTemplate restTemplate, BffProperties props) {
        this.restTemplate = restTemplate;
        this.baseUrl = props.getCredentialUrl();
    }

    // ---- Device Inventory ----

    public Map<String, Object> registerDevice(Map<String, Object> request) {
        ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/device-registry",
                HttpMethod.POST, new HttpEntity<>(request),
                new ParameterizedTypeReference<>() {});
        return extractData(resp);
    }

    public List<Map<String, Object>> bulkImportDevices(Map<String, Object> request) {
        ResponseEntity<ApiResponse<List<Map<String, Object>>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/device-registry/bulk-import",
                HttpMethod.POST, new HttpEntity<>(request),
                new ParameterizedTypeReference<>() {});
        return extractData(resp);
    }

    public Map<String, Object> getDevice(UUID deviceId) {
        ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/device-registry/{deviceId}",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {}, deviceId);
        return extractData(resp);
    }

    public List<Map<String, Object>> listDevices(String status, String type, String vendor, String model) {
        StringBuilder url = new StringBuilder(baseUrl + "/api/v1/device-registry?");
        if (status != null) url.append("status=").append(status).append("&");
        if (type != null) url.append("type=").append(type).append("&");
        if (vendor != null) url.append("vendor=").append(vendor).append("&");
        if (model != null) url.append("model=").append(model).append("&");

        ResponseEntity<ApiResponse<List<Map<String, Object>>>> resp = restTemplate.exchange(
                url.toString(), HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {});
        return extractData(resp);
    }

    public Map<String, Object> updateDeviceMetadata(UUID deviceId, Map<String, Object> request) {
        ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/device-registry/{deviceId}",
                HttpMethod.PATCH, new HttpEntity<>(request),
                new ParameterizedTypeReference<>() {}, deviceId);
        return extractData(resp);
    }

    public void retireDevice(UUID deviceId) {
        restTemplate.postForEntity(
                baseUrl + "/api/v1/device-registry/{deviceId}/retire",
                null, Void.class, deviceId);
    }

    public void decommissionDevice(UUID deviceId) {
        restTemplate.postForEntity(
                baseUrl + "/api/v1/device-registry/{deviceId}/decommission",
                null, Void.class, deviceId);
    }

    // ---- Device Assignments ----

    public Map<String, Object> createAssignment(Map<String, Object> request) {
        ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/device-assignments",
                HttpMethod.POST, new HttpEntity<>(request),
                new ParameterizedTypeReference<>() {});
        return extractData(resp);
    }

    public void activateAssignment(UUID assignmentId) {
        restTemplate.exchange(
                baseUrl + "/api/v1/device-assignments/{id}/activate",
                HttpMethod.PATCH, null, Void.class, assignmentId);
    }

    public void revokeAssignment(UUID assignmentId, Map<String, Object> request) {
        restTemplate.exchange(
                baseUrl + "/api/v1/device-assignments/{id}/revoke",
                HttpMethod.PATCH, new HttpEntity<>(request),
                Void.class, assignmentId);
    }

    public void returnDevice(UUID assignmentId) {
        restTemplate.exchange(
                baseUrl + "/api/v1/device-assignments/{id}/return",
                HttpMethod.PATCH, null, Void.class, assignmentId);
    }

    public Map<String, Object> reassignDevice(UUID assignmentId, Map<String, Object> request) {
        ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/device-assignments/{id}/reassign",
                HttpMethod.POST, new HttpEntity<>(request),
                new ParameterizedTypeReference<>() {}, assignmentId);
        return extractData(resp);
    }

    public List<Map<String, Object>> listAssignmentsByUser(UUID userId) {
        ResponseEntity<ApiResponse<List<Map<String, Object>>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/device-assignments/user/{userId}",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {}, userId);
        return extractData(resp);
    }

    public List<Map<String, Object>> listAssignmentsByAccount(UUID accountId) {
        ResponseEntity<ApiResponse<List<Map<String, Object>>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/device-assignments/account/{accountId}",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {}, accountId);
        return extractData(resp);
    }

    public List<Map<String, Object>> getAvailableDevices() {
        ResponseEntity<ApiResponse<List<Map<String, Object>>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/device-assignments/available",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {});
        return extractData(resp);
    }

    // ---- Delivery Tracking ----

    public Map<String, Object> addDeliveryEvent(UUID deviceId, Map<String, Object> request) {
        ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/device-registry/{deviceId}/delivery-events",
                HttpMethod.POST, new HttpEntity<>(request),
                new ParameterizedTypeReference<>() {}, deviceId);
        return extractData(resp);
    }

    public List<Map<String, Object>> getDeliveryEvents(UUID deviceId) {
        ResponseEntity<ApiResponse<List<Map<String, Object>>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/device-registry/{deviceId}/delivery-events",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {}, deviceId);
        return extractData(resp);
    }

    // ---- Enrollment Validation ----

    public Map<String, Object> validateEnrollment(Map<String, Object> request) {
        ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/device-registry/validate-enrollment",
                HttpMethod.POST, new HttpEntity<>(request),
                new ParameterizedTypeReference<>() {});
        return extractData(resp);
    }

    public List<Map<String, Object>> getEligibleDevices(UUID accountId) {
        ResponseEntity<ApiResponse<List<Map<String, Object>>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/device-registry/account/{accountId}/eligible-devices",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {}, accountId);
        return extractData(resp);
    }

    // ---- Lifecycle History ----

    public List<Map<String, Object>> getDeviceLifecycleHistory(UUID deviceId) {
        ResponseEntity<ApiResponse<List<Map<String, Object>>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/device-registry/{deviceId}/lifecycle-history",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {}, deviceId);
        return extractData(resp);
    }

    // ---- Bootstrap State ----

    public Map<String, Object> getBootstrapState(UUID accountId) {
        ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/device-registry/account/{accountId}/bootstrap-state",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {}, accountId);
        return extractData(resp);
    }

    private <T> T extractData(ResponseEntity<ApiResponse<T>> resp) {
        if (resp.getBody() != null) {
            return resp.getBody().data();
        }
        return null;
    }
}
