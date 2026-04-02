package io.innait.wiam.identityservice.service;

import io.innait.wiam.common.constant.AccountStatus;
import io.innait.wiam.common.constant.UserType;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.identityservice.dto.BulkOperationResponse;
import io.innait.wiam.identityservice.dto.CreateUserRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class BulkOperationService {

    private static final Logger log = LoggerFactory.getLogger(BulkOperationService.class);

    private final UserService userService;
    private final ConcurrentHashMap<UUID, BulkOperationResponse> jobTracker = new ConcurrentHashMap<>();

    public BulkOperationService(UserService userService) {
        this.userService = userService;
    }

    @Async
    public void bulkCreateUsers(UUID jobId, InputStream csv, UUID tenantId) {
        TenantContext.setTenantId(tenantId);
        try {
            List<CreateUserRequest> requests = parseCsv(csv);
            int total = requests.size();
            int success = 0;
            int failure = 0;

            updateJob(jobId, "BULK_CREATE_USERS", "IN_PROGRESS", total, 0, 0, Instant.now(), null);

            for (CreateUserRequest request : requests) {
                try {
                    userService.createUser(request);
                    success++;
                } catch (Exception e) {
                    failure++;
                    log.warn("Bulk create failed for email [{}]: {}", request.email(), e.getMessage());
                }
                updateJob(jobId, "BULK_CREATE_USERS", "IN_PROGRESS", total, success, failure, null, null);
            }

            updateJob(jobId, "BULK_CREATE_USERS", "COMPLETED", total, success, failure, null, Instant.now());
            log.info("Bulk create completed. Job [{}] total={} success={} failure={}", jobId, total, success, failure);
        } catch (Exception e) {
            updateJob(jobId, "BULK_CREATE_USERS", "FAILED", 0, 0, 0, null, Instant.now());
            log.error("Bulk create job [{}] failed: {}", jobId, e.getMessage());
        } finally {
            TenantContext.clear();
        }
    }

    @Async
    public void bulkStatusChange(UUID jobId, List<UUID> accountIds, AccountStatus targetStatus, UUID tenantId) {
        TenantContext.setTenantId(tenantId);
        try {
            int total = accountIds.size();
            int success = 0;
            int failure = 0;

            updateJob(jobId, "BULK_STATUS_CHANGE", "IN_PROGRESS", total, 0, 0, Instant.now(), null);

            for (UUID accountId : accountIds) {
                try {
                    switch (targetStatus) {
                        case ACTIVE -> userService.activateAccount(accountId);
                        case SUSPENDED -> userService.suspendAccount(accountId, "Bulk operation");
                        case LOCKED -> userService.lockAccount(accountId);
                        case INACTIVE -> userService.disableAccount(accountId);
                        case DEPROVISIONED -> userService.terminateAccount(accountId, "Bulk operation");
                        default -> throw new IllegalArgumentException("Unsupported target status: " + targetStatus);
                    }
                    success++;
                } catch (Exception e) {
                    failure++;
                    log.warn("Bulk status change failed for account [{}]: {}", accountId, e.getMessage());
                }
                updateJob(jobId, "BULK_STATUS_CHANGE", "IN_PROGRESS", total, success, failure, null, null);
            }

            updateJob(jobId, "BULK_STATUS_CHANGE", "COMPLETED", total, success, failure, null, Instant.now());
            log.info("Bulk status change completed. Job [{}] total={} success={} failure={}",
                    jobId, total, success, failure);
        } catch (Exception e) {
            updateJob(jobId, "BULK_STATUS_CHANGE", "FAILED", 0, 0, 0, null, Instant.now());
            log.error("Bulk status change job [{}] failed: {}", jobId, e.getMessage());
        } finally {
            TenantContext.clear();
        }
    }

    public UUID startBulkCreateUsers(InputStream csv) {
        UUID jobId = UUID.randomUUID();
        UUID tenantId = TenantContext.requireTenantId();
        updateJob(jobId, "BULK_CREATE_USERS", "QUEUED", 0, 0, 0, null, null);
        bulkCreateUsers(jobId, csv, tenantId);
        return jobId;
    }

    public UUID startBulkStatusChange(List<UUID> accountIds, AccountStatus targetStatus) {
        UUID jobId = UUID.randomUUID();
        UUID tenantId = TenantContext.requireTenantId();
        updateJob(jobId, "BULK_STATUS_CHANGE", "QUEUED", 0, 0, 0, null, null);
        bulkStatusChange(jobId, accountIds, targetStatus, tenantId);
        return jobId;
    }

    public BulkOperationResponse getJobStatus(UUID jobId) {
        BulkOperationResponse response = jobTracker.get(jobId);
        if (response == null) {
            throw new io.innait.wiam.common.exception.ResourceNotFoundException("BulkJob", jobId.toString());
        }
        return response;
    }

    List<CreateUserRequest> parseCsv(InputStream csv) throws IOException {
        List<CreateUserRequest> requests = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(csv, StandardCharsets.UTF_8))) {
            String header = reader.readLine();
            if (header == null) return requests;

            String[] columns = header.split(",");
            Map<String, Integer> columnIndex = new HashMap<>();
            for (int i = 0; i < columns.length; i++) {
                columnIndex.put(columns[i].trim().toLowerCase(), i);
            }

            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) continue;
                String[] values = line.split(",", -1);
                requests.add(new CreateUserRequest(
                        getField(values, columnIndex, "firstname"),
                        getField(values, columnIndex, "lastname"),
                        getField(values, columnIndex, "displayname"),
                        getField(values, columnIndex, "email"),
                        getField(values, columnIndex, "employeeno"),
                        null, null,
                        getField(values, columnIndex, "department"),
                        getField(values, columnIndex, "designation"),
                        null, null,
                        parseUserType(getField(values, columnIndex, "usertype")),
                        null, null,
                        true, "CSV_IMPORT",
                        null, null
                ));
            }
        }
        return requests;
    }

    private String getField(String[] values, Map<String, Integer> columnIndex, String name) {
        Integer idx = columnIndex.get(name);
        if (idx == null || idx >= values.length) return null;
        String val = values[idx].trim();
        return val.isEmpty() ? null : val;
    }

    private UserType parseUserType(String value) {
        if (value == null || value.isBlank()) return UserType.EMPLOYEE;
        try {
            return UserType.valueOf(value.toUpperCase());
        } catch (IllegalArgumentException e) {
            return UserType.EMPLOYEE;
        }
    }

    private void updateJob(UUID jobId, String operationType, String status,
                           int total, int success, int failure,
                           Instant startedAt, Instant completedAt) {
        BulkOperationResponse existing = jobTracker.get(jobId);
        jobTracker.put(jobId, new BulkOperationResponse(
                jobId, operationType, status, total, success, failure,
                startedAt != null ? startedAt : (existing != null ? existing.startedAt() : null),
                completedAt
        ));
    }
}
