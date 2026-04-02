package io.innait.wiam.identityservice.service;

import io.innait.wiam.common.constant.AccountStatus;
import io.innait.wiam.common.constant.UserType;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.exception.ResourceNotFoundException;
import io.innait.wiam.identityservice.dto.BulkOperationResponse;
import io.innait.wiam.identityservice.dto.CreateUserRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BulkOperationServiceTest {

    @Mock
    private UserService userService;

    private BulkOperationService bulkOperationService;

    private final UUID tenantId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(tenantId);
        bulkOperationService = new BulkOperationService(userService);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    // ---- CSV Parsing ----

    @Test
    void shouldParseCsv() throws IOException {
        String csv = "firstname,lastname,email,department,designation,employeeno,usertype\n" +
                "John,Doe,john@innait.io,Engineering,Developer,EMP-001,EMPLOYEE\n" +
                "Jane,Smith,jane@innait.io,HR,Manager,EMP-002,EMPLOYEE\n";

        InputStream input = new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8));
        List<CreateUserRequest> requests = bulkOperationService.parseCsv(input);

        assertThat(requests).hasSize(2);
        assertThat(requests.get(0).firstName()).isEqualTo("John");
        assertThat(requests.get(0).email()).isEqualTo("john@innait.io");
        assertThat(requests.get(0).department()).isEqualTo("Engineering");
        assertThat(requests.get(0).employeeNo()).isEqualTo("EMP-001");
        assertThat(requests.get(0).userType()).isEqualTo(UserType.EMPLOYEE);
        assertThat(requests.get(1).firstName()).isEqualTo("Jane");
    }

    @Test
    void shouldHandleEmptyCsv() throws IOException {
        String csv = "";
        InputStream input = new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8));
        List<CreateUserRequest> requests = bulkOperationService.parseCsv(input);

        assertThat(requests).isEmpty();
    }

    @Test
    void shouldHandleCsvWithOnlyHeader() throws IOException {
        String csv = "firstname,lastname,email\n";
        InputStream input = new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8));
        List<CreateUserRequest> requests = bulkOperationService.parseCsv(input);

        assertThat(requests).isEmpty();
    }

    @Test
    void shouldHandleMissingColumns() throws IOException {
        String csv = "firstname,email\n" +
                "John,john@innait.io\n";
        InputStream input = new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8));
        List<CreateUserRequest> requests = bulkOperationService.parseCsv(input);

        assertThat(requests).hasSize(1);
        assertThat(requests.get(0).firstName()).isEqualTo("John");
        assertThat(requests.get(0).email()).isEqualTo("john@innait.io");
        assertThat(requests.get(0).lastName()).isNull();
        assertThat(requests.get(0).userType()).isEqualTo(UserType.EMPLOYEE); // default
    }

    @Test
    void shouldSkipBlankLines() throws IOException {
        String csv = "firstname,lastname,email\n" +
                "John,Doe,john@innait.io\n" +
                "\n" +
                "Jane,Smith,jane@innait.io\n";
        InputStream input = new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8));
        List<CreateUserRequest> requests = bulkOperationService.parseCsv(input);

        assertThat(requests).hasSize(2);
    }

    @Test
    void shouldDefaultToEmployeeForInvalidUserType() throws IOException {
        String csv = "firstname,email,usertype\n" +
                "John,john@innait.io,UNKNOWN_TYPE\n";
        InputStream input = new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8));
        List<CreateUserRequest> requests = bulkOperationService.parseCsv(input);

        assertThat(requests.get(0).userType()).isEqualTo(UserType.EMPLOYEE);
    }

    // ---- Job tracking ----

    @Test
    void shouldTrackJobStatus() {
        String csv = "firstname,lastname,email\n" +
                "John,Doe,john@innait.io\n";
        InputStream input = new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8));

        when(userService.createUser(any())).thenReturn(null);

        UUID jobId = bulkOperationService.startBulkCreateUsers(input);

        BulkOperationResponse response = bulkOperationService.getJobStatus(jobId);

        assertThat(response.jobId()).isEqualTo(jobId);
        assertThat(response.operationType()).isEqualTo("BULK_CREATE_USERS");
    }

    @Test
    void shouldThrowForUnknownJobId() {
        assertThatThrownBy(() -> bulkOperationService.getJobStatus(UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void shouldCountSuccessAndFailure() {
        String csv = "firstname,lastname,email\n" +
                "John,Doe,john@innait.io\n" +
                "Jane,Smith,jane@innait.io\n";
        InputStream input = new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8));

        when(userService.createUser(any()))
                .thenReturn(null)
                .thenThrow(new IllegalArgumentException("Duplicate email"));

        UUID jobId = bulkOperationService.startBulkCreateUsers(input);

        BulkOperationResponse response = bulkOperationService.getJobStatus(jobId);

        assertThat(response.totalRecords()).isEqualTo(2);
        assertThat(response.successCount()).isEqualTo(1);
        assertThat(response.failureCount()).isEqualTo(1);
        assertThat(response.status()).isEqualTo("COMPLETED");
    }

    // ---- Bulk status change ----

    @Test
    void shouldBulkStatusChange() {
        UUID account1 = UUID.randomUUID();
        UUID account2 = UUID.randomUUID();

        doNothing().when(userService).suspendAccount(any(), anyString());

        UUID jobId = bulkOperationService.startBulkStatusChange(
                List.of(account1, account2), AccountStatus.SUSPENDED);

        BulkOperationResponse response = bulkOperationService.getJobStatus(jobId);

        assertThat(response.operationType()).isEqualTo("BULK_STATUS_CHANGE");
        assertThat(response.totalRecords()).isEqualTo(2);
        assertThat(response.successCount()).isEqualTo(2);
        assertThat(response.status()).isEqualTo("COMPLETED");
    }

    @Test
    void shouldHandlePartialFailureInBulkStatusChange() {
        UUID account1 = UUID.randomUUID();
        UUID account2 = UUID.randomUUID();

        doNothing().when(userService).activateAccount(account1);
        doThrow(new IllegalStateException("Invalid transition")).when(userService).activateAccount(account2);

        UUID jobId = bulkOperationService.startBulkStatusChange(
                List.of(account1, account2), AccountStatus.ACTIVE);

        BulkOperationResponse response = bulkOperationService.getJobStatus(jobId);

        assertThat(response.successCount()).isEqualTo(1);
        assertThat(response.failureCount()).isEqualTo(1);
        assertThat(response.status()).isEqualTo("COMPLETED");
    }
}
