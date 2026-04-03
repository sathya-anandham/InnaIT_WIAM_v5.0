package io.innait.wiam.identityservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.common.constant.UserType;
import io.innait.wiam.common.exception.GlobalExceptionHandler;
import io.innait.wiam.common.exception.ResourceNotFoundException;
import io.innait.wiam.identityservice.dto.*;
import io.innait.wiam.identityservice.entity.UserStatus;
import io.innait.wiam.identityservice.service.BulkOperationService;
import io.innait.wiam.identityservice.service.UserService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(UserController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
@DisplayName("UserController WebMvc Tests")
class UserControllerTest {

    private static final String BASE_URL = "/api/v1/identity/users";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private UserService userService;

    @MockBean
    private BulkOperationService bulkOperationService;

    // ──────────────────────────── Test Data Builders ────────────────────────────

    private static final UUID TEST_USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID TEST_TENANT_ID = UUID.fromString("00000000-0000-0000-0000-000000000099");
    private static final UUID TEST_ACCOUNT_ID = UUID.fromString("00000000-0000-0000-0000-000000000010");

    private UserResponse buildUserResponse() {
        return new UserResponse(
                TEST_USER_ID, TEST_TENANT_ID,
                "EMP001", "John", "Doe", "John Doe",
                "john.doe@innait.io", "+91", "9876543210",
                "Engineering", "Senior Engineer",
                null, null,
                UserType.EMPLOYEE, UserStatus.ACTIVE,
                "en", "Asia/Kolkata",
                List.of(new UserResponse.AccountSummary(TEST_ACCOUNT_ID, "john.doe@innait.io", "ACTIVE")),
                Instant.parse("2026-01-15T10:00:00Z"),
                Instant.parse("2026-01-15T10:00:00Z")
        );
    }

    private CreateUserRequest buildValidCreateRequest() {
        return new CreateUserRequest(
                "John", "Doe", "John Doe", "john.doe@innait.io",
                "EMP001", "+91", "9876543210",
                "Engineering", "Senior Engineer",
                null, null, UserType.EMPLOYEE,
                "en", "Asia/Kolkata", true, "ADMIN_CREATED",
                null, null
        );
    }

    // ──────────────────────────── Create User ────────────────────────────

    @Nested
    @DisplayName("POST /api/v1/identity/users")
    class CreateUser {

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldCreateUserAndReturnSuccess")
        void shouldCreateUserAndReturnSuccess() throws Exception {
            UserResponse response = buildUserResponse();
            when(userService.createUser(any(CreateUserRequest.class))).thenReturn(response);

            mockMvc.perform(post(BASE_URL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(buildValidCreateRequest())))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.userId").value(TEST_USER_ID.toString()))
                    .andExpect(jsonPath("$.data.firstName").value("John"))
                    .andExpect(jsonPath("$.data.lastName").value("Doe"))
                    .andExpect(jsonPath("$.data.email").value("john.doe@innait.io"))
                    .andExpect(jsonPath("$.data.userType").value("EMPLOYEE"))
                    .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                    .andExpect(jsonPath("$.data.accounts").isArray())
                    .andExpect(jsonPath("$.data.accounts", hasSize(1)));

            verify(userService).createUser(any(CreateUserRequest.class));
        }

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldRejectCreateUserWithMissingFields - 400")
        void shouldRejectCreateUserWithMissingFields() throws Exception {
            // Empty body: firstName, lastName, email, and userType are all @NotBlank/@NotNull
            String emptyBody = "{}";

            mockMvc.perform(post(BASE_URL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(emptyBody))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value("ERROR"))
                    .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));

            verifyNoInteractions(userService);
        }

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldRejectCreateUserWithInvalidEmail")
        void shouldRejectCreateUserWithInvalidEmail() throws Exception {
            CreateUserRequest invalid = new CreateUserRequest(
                    "John", "Doe", null, "not-an-email",
                    null, null, null, null, null,
                    null, null, UserType.EMPLOYEE,
                    null, null, false, null, null, null
            );

            mockMvc.perform(post(BASE_URL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(invalid)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value("ERROR"))
                    .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));

            verifyNoInteractions(userService);
        }

        @Test
        @WithMockUser(roles = "TENANT_ADMIN")
        @DisplayName("shouldAllowTenantAdminToCreateUser")
        void shouldAllowTenantAdminToCreateUser() throws Exception {
            when(userService.createUser(any())).thenReturn(buildUserResponse());

            mockMvc.perform(post(BASE_URL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(buildValidCreateRequest())))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"));
        }
    }

    // ──────────────────────────── Get User by ID ────────────────────────────

    @Nested
    @DisplayName("GET /api/v1/identity/users/{userId}")
    class GetUserById {

        @Test
        @WithMockUser
        @DisplayName("shouldGetUserById")
        void shouldGetUserById() throws Exception {
            UserResponse response = buildUserResponse();
            when(userService.getUserById(TEST_USER_ID)).thenReturn(response);

            mockMvc.perform(get(BASE_URL + "/{userId}", TEST_USER_ID))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.userId").value(TEST_USER_ID.toString()))
                    .andExpect(jsonPath("$.data.firstName").value("John"))
                    .andExpect(jsonPath("$.data.email").value("john.doe@innait.io"));

            verify(userService).getUserById(TEST_USER_ID);
        }

        @Test
        @WithMockUser
        @DisplayName("shouldReturn404ForNonExistentUser")
        void shouldReturn404ForNonExistentUser() throws Exception {
            UUID nonExistentId = UUID.randomUUID();
            when(userService.getUserById(nonExistentId))
                    .thenThrow(new ResourceNotFoundException("User", nonExistentId.toString()));

            mockMvc.perform(get(BASE_URL + "/{userId}", nonExistentId))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value("ERROR"))
                    .andExpect(jsonPath("$.error.code").value("NOT_FOUND"))
                    .andExpect(jsonPath("$.error.message", containsString("User not found")));
        }
    }

    // ──────────────────────────── Update User ────────────────────────────

    @Nested
    @DisplayName("PATCH /api/v1/identity/users/{userId}")
    class UpdateUser {

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldUpdateUser")
        void shouldUpdateUser() throws Exception {
            UpdateUserRequest updateReq = new UpdateUserRequest(
                    "Updated", null, "Updated Doe",
                    null, null, null, null,
                    "Product", null, null, null, null, null
            );

            UserResponse updatedResponse = new UserResponse(
                    TEST_USER_ID, TEST_TENANT_ID,
                    "EMP001", "Updated", "Doe", "Updated Doe",
                    "john.doe@innait.io", "+91", "9876543210",
                    "Product", "Senior Engineer",
                    null, null,
                    UserType.EMPLOYEE, UserStatus.ACTIVE,
                    "en", "Asia/Kolkata",
                    Collections.emptyList(),
                    Instant.parse("2026-01-15T10:00:00Z"),
                    Instant.parse("2026-03-01T12:00:00Z")
            );

            when(userService.updateUser(eq(TEST_USER_ID), any(UpdateUserRequest.class)))
                    .thenReturn(updatedResponse);

            mockMvc.perform(patch(BASE_URL + "/{userId}", TEST_USER_ID)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(updateReq)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.firstName").value("Updated"))
                    .andExpect(jsonPath("$.data.department").value("Product"))
                    .andExpect(jsonPath("$.data.displayName").value("Updated Doe"));

            verify(userService).updateUser(eq(TEST_USER_ID), any(UpdateUserRequest.class));
        }
    }

    // ──────────────────────────── Delete User ────────────────────────────

    @Nested
    @DisplayName("DELETE /api/v1/identity/users/{userId}")
    class DeleteUser {

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldSoftDeleteUser")
        void shouldSoftDeleteUser() throws Exception {
            doNothing().when(userService).softDeleteUser(TEST_USER_ID);

            mockMvc.perform(delete(BASE_URL + "/{userId}", TEST_USER_ID))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data").doesNotExist());

            verify(userService).softDeleteUser(TEST_USER_ID);
        }

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldSoftDeleteUserWithHardFlagFalse")
        void shouldSoftDeleteUserWithHardFlagFalse() throws Exception {
            doNothing().when(userService).softDeleteUser(TEST_USER_ID);

            mockMvc.perform(delete(BASE_URL + "/{userId}", TEST_USER_ID)
                            .param("hard", "false"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"));

            verify(userService).softDeleteUser(TEST_USER_ID);
        }
    }

    // ──────────────────────────── Restore User ────────────────────────────

    @Nested
    @DisplayName("POST /api/v1/identity/users/{userId}/restore")
    class RestoreUser {

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldRestoreUser")
        void shouldRestoreUser() throws Exception {
            doNothing().when(userService).restoreUser(TEST_USER_ID);

            mockMvc.perform(post(BASE_URL + "/{userId}/restore", TEST_USER_ID))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"));

            verify(userService).restoreUser(TEST_USER_ID);
        }
    }

    // ──────────────────────────── Search Users ────────────────────────────

    @Nested
    @DisplayName("GET /api/v1/identity/users")
    class SearchUsers {

        @Test
        @WithMockUser
        @DisplayName("shouldSearchUsersWithPagination")
        void shouldSearchUsersWithPagination() throws Exception {
            UserResponse user1 = buildUserResponse();
            UserResponse user2 = new UserResponse(
                    UUID.randomUUID(), TEST_TENANT_ID,
                    "EMP002", "Jane", "Smith", "Jane Smith",
                    "jane.smith@innait.io", null, null,
                    "Engineering", "Engineer",
                    null, null,
                    UserType.EMPLOYEE, UserStatus.ACTIVE,
                    "en", "UTC",
                    Collections.emptyList(),
                    Instant.now(), Instant.now()
            );

            Page<UserResponse> page = new PageImpl<>(List.of(user1, user2));
            when(userService.searchUsers(any(UserSearchCriteria.class), any(Pageable.class)))
                    .thenReturn(page);

            mockMvc.perform(get(BASE_URL)
                            .param("search", "Engineering")
                            .param("page", "0")
                            .param("size", "10"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.content").isArray())
                    .andExpect(jsonPath("$.data.content", hasSize(2)))
                    .andExpect(jsonPath("$.data.content[0].firstName").value("John"))
                    .andExpect(jsonPath("$.data.content[1].firstName").value("Jane"));

            verify(userService).searchUsers(any(UserSearchCriteria.class), any(Pageable.class));
        }

        @Test
        @WithMockUser
        @DisplayName("shouldReturnEmptyPageWhenNoUsersMatch")
        void shouldReturnEmptyPageWhenNoUsersMatch() throws Exception {
            Page<UserResponse> emptyPage = new PageImpl<>(Collections.emptyList());
            when(userService.searchUsers(any(UserSearchCriteria.class), any(Pageable.class)))
                    .thenReturn(emptyPage);

            mockMvc.perform(get(BASE_URL)
                            .param("page", "0")
                            .param("size", "10"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.content").isArray())
                    .andExpect(jsonPath("$.data.content", hasSize(0)));
        }

        @Test
        @WithMockUser
        @DisplayName("shouldSearchUsersByDepartmentFilter")
        void shouldSearchUsersByDepartmentFilter() throws Exception {
            Page<UserResponse> page = new PageImpl<>(List.of(buildUserResponse()));
            when(userService.searchUsers(any(UserSearchCriteria.class), any(Pageable.class)))
                    .thenReturn(page);

            mockMvc.perform(get(BASE_URL)
                            .param("department", "Engineering")
                            .param("page", "0")
                            .param("size", "5"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.content").isArray());
        }
    }

    // ──────────────────────────── Bulk Create ────────────────────────────

    @Nested
    @DisplayName("POST /api/v1/identity/users/bulk")
    class BulkCreate {

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldAcceptBulkCsvUpload")
        void shouldAcceptBulkCsvUpload() throws Exception {
            UUID jobId = UUID.randomUUID();
            BulkOperationResponse jobResponse = new BulkOperationResponse(
                    jobId, "BULK_CREATE_USERS", "QUEUED",
                    0, 0, 0, null, null
            );

            when(bulkOperationService.startBulkCreateUsers(any())).thenReturn(jobId);
            when(bulkOperationService.getJobStatus(jobId)).thenReturn(jobResponse);

            String csvContent = "firstName,lastName,email,employeeNo,userType\n" +
                    "Alice,Wonder,alice@innait.io,EMP100,EMPLOYEE\n";

            MockMultipartFile file = new MockMultipartFile(
                    "file", "users.csv", "text/csv",
                    csvContent.getBytes(StandardCharsets.UTF_8));

            mockMvc.perform(multipart(BASE_URL + "/bulk").file(file))
                    .andExpect(status().isAccepted())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.jobId").value(jobId.toString()))
                    .andExpect(jsonPath("$.data.operationType").value("BULK_CREATE_USERS"));
        }
    }

    // ──────────────────────────── Export CSV ────────────────────────────

    @Nested
    @DisplayName("GET /api/v1/identity/users/export")
    class ExportUsers {

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldExportUsersCsv")
        void shouldExportUsersCsv() throws Exception {
            Page<UserResponse> page = new PageImpl<>(List.of(buildUserResponse()));
            when(userService.searchUsers(any(UserSearchCriteria.class), any(Pageable.class)))
                    .thenReturn(page);

            mockMvc.perform(get(BASE_URL + "/export")
                            .param("format", "csv"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Content-Disposition", containsString("users.csv")))
                    .andExpect(content().contentTypeCompatibleWith("text/csv"));
        }
    }

    // ──────────────────────────── ApiResponse Envelope ────────────────────────────

    @Nested
    @DisplayName("ApiResponse envelope format")
    class ApiResponseEnvelope {

        @Test
        @WithMockUser
        @DisplayName("shouldReturnApiResponseEnvelope")
        void shouldReturnApiResponseEnvelope() throws Exception {
            when(userService.getUserById(TEST_USER_ID)).thenReturn(buildUserResponse());

            mockMvc.perform(get(BASE_URL + "/{userId}", TEST_USER_ID))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").exists())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data").exists())
                    .andExpect(jsonPath("$.data.userId").exists())
                    // error should not be present on success
                    .andExpect(jsonPath("$.error").doesNotExist());
        }

        @Test
        @WithMockUser
        @DisplayName("shouldReturnErrorEnvelopeOnNotFound")
        void shouldReturnErrorEnvelopeOnNotFound() throws Exception {
            UUID id = UUID.randomUUID();
            when(userService.getUserById(id))
                    .thenThrow(new ResourceNotFoundException("User", id.toString()));

            mockMvc.perform(get(BASE_URL + "/{userId}", id))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value("ERROR"))
                    .andExpect(jsonPath("$.error").exists())
                    .andExpect(jsonPath("$.error.code").value("NOT_FOUND"))
                    .andExpect(jsonPath("$.error.message").isNotEmpty())
                    // data should not be present on error
                    .andExpect(jsonPath("$.data").doesNotExist());
        }
    }
}
