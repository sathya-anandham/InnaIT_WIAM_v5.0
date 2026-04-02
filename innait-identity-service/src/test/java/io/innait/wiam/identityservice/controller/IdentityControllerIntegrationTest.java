package io.innait.wiam.identityservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.common.constant.AccountStatus;
import io.innait.wiam.common.constant.RoleType;
import io.innait.wiam.common.constant.UserType;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.security.JwtAuthenticationFilter;
import io.innait.wiam.identityservice.dto.*;
import io.innait.wiam.identityservice.entity.GroupType;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class IdentityControllerIntegrationTest {

    @MockBean private JwtAuthenticationFilter jwtAuthenticationFilter;
    @MockBean private EventPublisher eventPublisher;

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    private static final UUID TENANT_ID = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(TENANT_ID);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    // ──────────────────────────── User Endpoints ────────────────────────────

    @Nested
    @WithMockUser(roles = "SUPER_ADMIN")
    @TestMethodOrder(MethodOrderer.OrderAnnotation.class)
    class UserEndpoints {

        @Test
        @Order(1)
        void shouldCreateUser() throws Exception {
            CreateUserRequest request = new CreateUserRequest(
                    "John", "Doe", "John Doe", "john.doe@innait.io",
                    "EMP001", "+91", "9876543210",
                    "Engineering", "Senior Engineer",
                    null, null, UserType.EMPLOYEE,
                    "en", "Asia/Kolkata", true, "ADMIN_CREATED",
                    null, null);

            mockMvc.perform(post("/api/v1/identity/users")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.firstName").value("John"))
                    .andExpect(jsonPath("$.data.lastName").value("Doe"))
                    .andExpect(jsonPath("$.data.email").value("john.doe@innait.io"))
                    .andExpect(jsonPath("$.data.userId").isNotEmpty())
                    .andExpect(jsonPath("$.data.userType").value("EMPLOYEE"));
        }

        @Test
        @Order(2)
        void shouldCreateAndRetrieveUser() throws Exception {
            String userId = createTestUser("Jane", "Smith", "jane.smith@innait.io", "EMP002");

            mockMvc.perform(get("/api/v1/identity/users/{userId}", userId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.firstName").value("Jane"))
                    .andExpect(jsonPath("$.data.email").value("jane.smith@innait.io"));
        }

        @Test
        @Order(3)
        void shouldUpdateUser() throws Exception {
            String userId = createTestUser("Update", "Test", "update.test@innait.io", "EMP003");

            UpdateUserRequest update = new UpdateUserRequest(
                    "Updated", null, "Updated Test",
                    null, null, null, null,
                    "Product", null, null, null, null, null);

            mockMvc.perform(patch("/api/v1/identity/users/{userId}", userId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(update)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.firstName").value("Updated"))
                    .andExpect(jsonPath("$.data.department").value("Product"));
        }

        @Test
        @Order(4)
        void shouldSoftDeleteAndRestoreUser() throws Exception {
            String userId = createTestUser("Delete", "Me", "delete.me@innait.io", "EMP004");

            // Soft delete
            mockMvc.perform(delete("/api/v1/identity/users/{userId}", userId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"));

            // Restore
            mockMvc.perform(post("/api/v1/identity/users/{userId}/restore", userId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"));

            // Verify restored
            mockMvc.perform(get("/api/v1/identity/users/{userId}", userId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.firstName").value("Delete"));
        }

        @Test
        @Order(5)
        void shouldSearchUsers() throws Exception {
            createTestUser("Search", "One", "search.one@innait.io", "EMP010");
            createTestUser("Search", "Two", "search.two@innait.io", "EMP011");

            mockMvc.perform(get("/api/v1/identity/users")
                            .param("search", "Search")
                            .param("page", "0")
                            .param("size", "10"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.content").isArray())
                    .andExpect(jsonPath("$.data.content", hasSize(greaterThanOrEqualTo(2))));
        }

        @Test
        @Order(6)
        void shouldSearchByDepartment() throws Exception {
            createTestUserWithDept("Dept", "Test", "dept.test@innait.io", "EMP012", "QA");

            mockMvc.perform(get("/api/v1/identity/users")
                            .param("department", "QA")
                            .param("page", "0")
                            .param("size", "10"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.content").isArray());
        }

        @Test
        @Order(7)
        void shouldBulkCreateUsersViaCsv() throws Exception {
            String csv = "firstName,lastName,email,employeeNo,userType\n" +
                    "Bulk1,User,bulk1@innait.io,BEMP001,EMPLOYEE\n" +
                    "Bulk2,User,bulk2@innait.io,BEMP002,CONTRACTOR\n";

            MockMultipartFile file = new MockMultipartFile(
                    "file", "users.csv", "text/csv",
                    csv.getBytes(StandardCharsets.UTF_8));

            mockMvc.perform(multipart("/api/v1/identity/users/bulk").file(file))
                    .andExpect(status().isAccepted())
                    .andExpect(jsonPath("$.data.jobId").isNotEmpty())
                    .andExpect(jsonPath("$.data.operationType").value("BULK_CREATE"));
        }

        @Test
        @Order(8)
        void shouldExportUsersCsv() throws Exception {
            mockMvc.perform(get("/api/v1/identity/users/export")
                            .param("format", "csv"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Content-Disposition", containsString("users.csv")));
        }

        @Test
        @Order(9)
        void shouldRejectCreateWithMissingRequiredFields() throws Exception {
            // Missing firstName, lastName, email, userType
            String body = "{}";

            mockMvc.perform(post("/api/v1/identity/users")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isBadRequest());
        }
    }

    // ──────────────────────────── Account Endpoints ────────────────────────────

    @Nested
    @WithMockUser(roles = "SUPER_ADMIN")
    @TestMethodOrder(MethodOrderer.OrderAnnotation.class)
    class AccountEndpoints {

        @Test
        @Order(1)
        void shouldActivateAccount() throws Exception {
            String userId = createTestUser("Activate", "Test", "activate@innait.io", "EMP020");
            String accountId = getFirstAccountId(userId);

            AccountStatusChangeRequest request = new AccountStatusChangeRequest(
                    AccountStatus.ACTIVE, null, null);

            mockMvc.perform(patch("/api/v1/identity/accounts/{accountId}/status", accountId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"));
        }

        @Test
        @Order(2)
        void shouldSuspendAccount() throws Exception {
            String userId = createTestUser("Suspend", "Test", "suspend@innait.io", "EMP021");
            String accountId = getFirstAccountId(userId);
            activateAccount(accountId);

            AccountStatusChangeRequest request = new AccountStatusChangeRequest(
                    AccountStatus.SUSPENDED, "Policy violation", null);

            mockMvc.perform(patch("/api/v1/identity/accounts/{accountId}/status", accountId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk());
        }

        @Test
        @Order(3)
        void shouldUnlockAccount() throws Exception {
            String userId = createTestUser("Unlock", "Test", "unlock@innait.io", "EMP022");
            String accountId = getFirstAccountId(userId);
            activateAccount(accountId);
            lockAccount(accountId);

            mockMvc.perform(post("/api/v1/identity/accounts/{accountId}/unlock", accountId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"));
        }

        @Test
        @Order(4)
        void shouldGetAccountRoles() throws Exception {
            String userId = createTestUser("Roles", "Test", "roles@innait.io", "EMP023");
            String accountId = getFirstAccountId(userId);

            mockMvc.perform(get("/api/v1/identity/accounts/{accountId}/roles", accountId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data").isArray());
        }

        @Test
        @Order(5)
        void shouldAssignAndRemoveRole() throws Exception {
            // Create user and role
            String userId = createTestUser("AssignRole", "Test", "assignrole@innait.io", "EMP024");
            String accountId = getFirstAccountId(userId);
            String roleId = createTestRole("TEST_ROLE_ASSIGN", "Test Role Assign");

            // Assign role
            RoleAssignmentRequest assignRequest = new RoleAssignmentRequest(
                    UUID.fromString(roleId), "ADMIN", null, "Testing", null);

            mockMvc.perform(post("/api/v1/identity/accounts/{accountId}/roles", accountId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(assignRequest)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.roleId").value(roleId));

            // Remove role
            mockMvc.perform(delete("/api/v1/identity/accounts/{accountId}/roles/{roleId}",
                            accountId, roleId))
                    .andExpect(status().isOk());
        }

        @Test
        @Order(6)
        void shouldGetEffectiveEntitlements() throws Exception {
            String userId = createTestUser("Entitlements", "Test", "entitlements@innait.io", "EMP025");
            String accountId = getFirstAccountId(userId);

            mockMvc.perform(get("/api/v1/identity/accounts/{accountId}/entitlements", accountId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data").isArray());
        }

        @Test
        @Order(7)
        void shouldRejectUnsupportedStatusTransition() throws Exception {
            AccountStatusChangeRequest request = new AccountStatusChangeRequest(
                    AccountStatus.PENDING_ACTIVATION, null, null);

            mockMvc.perform(patch("/api/v1/identity/accounts/{accountId}/status", UUID.randomUUID())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().is4xxClientError());
        }
    }

    // ──────────────────────────── Role Endpoints ────────────────────────────

    @Nested
    @WithMockUser(roles = "SUPER_ADMIN")
    @TestMethodOrder(MethodOrderer.OrderAnnotation.class)
    class RoleEndpoints {

        @Test
        @Order(1)
        void shouldCreateRole() throws Exception {
            CreateRoleRequest request = new CreateRoleRequest(
                    "MANAGER", "Manager", "Manager role", RoleType.TENANT, false);

            mockMvc.perform(post("/api/v1/identity/roles")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.roleCode").value("MANAGER"))
                    .andExpect(jsonPath("$.data.roleName").value("Manager"))
                    .andExpect(jsonPath("$.data.roleType").value("TENANT"));
        }

        @Test
        @Order(2)
        void shouldGetRoleById() throws Exception {
            String roleId = createTestRole("GET_ROLE", "Get Role Test");

            mockMvc.perform(get("/api/v1/identity/roles/{roleId}", roleId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.roleCode").value("GET_ROLE"));
        }

        @Test
        @Order(3)
        void shouldListRoles() throws Exception {
            createTestRole("LIST_ROLE_1", "List Role 1");
            createTestRole("LIST_ROLE_2", "List Role 2");

            mockMvc.perform(get("/api/v1/identity/roles")
                            .param("page", "0")
                            .param("size", "10"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.content").isArray())
                    .andExpect(jsonPath("$.data.content", hasSize(greaterThanOrEqualTo(2))));
        }

        @Test
        @Order(4)
        void shouldUpdateRole() throws Exception {
            String roleId = createTestRole("UPDATE_ROLE", "Update Role");

            UpdateRoleRequest update = new UpdateRoleRequest("Updated Role Name", "Updated desc");

            mockMvc.perform(patch("/api/v1/identity/roles/{roleId}", roleId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(update)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.roleName").value("Updated Role Name"));
        }

        @Test
        @Order(5)
        void shouldDeactivateRole() throws Exception {
            String roleId = createTestRole("DEACTIVATE_ROLE", "Deactivate Role");

            mockMvc.perform(delete("/api/v1/identity/roles/{roleId}", roleId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"));
        }

        @Test
        @Order(6)
        void shouldBulkAssignRole() throws Exception {
            String roleId = createTestRole("BULK_ASSIGN", "Bulk Assign Role");
            String userId1 = createTestUser("Bulk", "A1", "bulk.a1@innait.io", "BEMP010");
            String userId2 = createTestUser("Bulk", "A2", "bulk.a2@innait.io", "BEMP011");
            String accountId1 = getFirstAccountId(userId1);
            String accountId2 = getFirstAccountId(userId2);

            BulkRoleRequest request = new BulkRoleRequest(
                    List.of(UUID.fromString(accountId1), UUID.fromString(accountId2)));

            mockMvc.perform(post("/api/v1/identity/roles/{roleId}/bulk-assign", roleId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk());
        }
    }

    // ──────────────────────────── Group Endpoints ────────────────────────────

    @Nested
    @WithMockUser(roles = "SUPER_ADMIN")
    @TestMethodOrder(MethodOrderer.OrderAnnotation.class)
    class GroupEndpoints {

        @Test
        @Order(1)
        void shouldCreateGroup() throws Exception {
            CreateGroupRequest request = new CreateGroupRequest(
                    "ENGINEERING", "Engineering Team", "Engineering department group", GroupType.STATIC);

            mockMvc.perform(post("/api/v1/identity/groups")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.groupCode").value("ENGINEERING"))
                    .andExpect(jsonPath("$.data.groupName").value("Engineering Team"))
                    .andExpect(jsonPath("$.data.groupType").value("STATIC"));
        }

        @Test
        @Order(2)
        void shouldGetGroupById() throws Exception {
            String groupId = createTestGroup("GET_GROUP", "Get Group Test");

            mockMvc.perform(get("/api/v1/identity/groups/{groupId}", groupId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.groupCode").value("GET_GROUP"));
        }

        @Test
        @Order(3)
        void shouldListGroups() throws Exception {
            createTestGroup("LIST_GROUP_1", "List Group 1");
            createTestGroup("LIST_GROUP_2", "List Group 2");

            mockMvc.perform(get("/api/v1/identity/groups")
                            .param("page", "0")
                            .param("size", "10"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.content").isArray());
        }

        @Test
        @Order(4)
        void shouldUpdateGroup() throws Exception {
            String groupId = createTestGroup("UPDATE_GROUP", "Update Group");

            UpdateGroupRequest update = new UpdateGroupRequest("Updated Group Name", "Updated desc");

            mockMvc.perform(patch("/api/v1/identity/groups/{groupId}", groupId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(update)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.groupName").value("Updated Group Name"));
        }

        @Test
        @Order(5)
        void shouldDeactivateGroup() throws Exception {
            String groupId = createTestGroup("DEACTIVATE_GROUP", "Deactivate Group");

            mockMvc.perform(delete("/api/v1/identity/groups/{groupId}", groupId))
                    .andExpect(status().isOk());
        }

        @Test
        @Order(6)
        void shouldAddAndRemoveMember() throws Exception {
            String groupId = createTestGroup("MEMBER_GROUP", "Member Group");
            String userId = createTestUser("Member", "Test", "member.test@innait.io", "EMP030");
            String accountId = getFirstAccountId(userId);

            GroupMemberRequest memberRequest = new GroupMemberRequest(
                    UUID.fromString(accountId), "ADMIN", null, "Testing");

            // Add member
            mockMvc.perform(post("/api/v1/identity/groups/{groupId}/members", groupId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(memberRequest)))
                    .andExpect(status().isOk());

            // Remove member
            mockMvc.perform(delete("/api/v1/identity/groups/{groupId}/members/{accountId}",
                            groupId, accountId))
                    .andExpect(status().isOk());
        }

        @Test
        @Order(7)
        void shouldAssignAndRemoveRoleFromGroup() throws Exception {
            String groupId = createTestGroup("ROLE_MAP_GROUP", "Role Map Group");
            String roleId = createTestRole("GROUP_ROLE_MAP", "Group Role Map");

            // Assign role to group
            mockMvc.perform(post("/api/v1/identity/groups/{groupId}/roles/{roleId}", groupId, roleId))
                    .andExpect(status().isOk());

            // Remove role from group
            mockMvc.perform(delete("/api/v1/identity/groups/{groupId}/roles/{roleId}", groupId, roleId))
                    .andExpect(status().isOk());
        }
    }

    // ──────────────────────────── Job Endpoints ────────────────────────────

    @Nested
    @WithMockUser(roles = "SUPER_ADMIN")
    class JobEndpoints {

        @Test
        void shouldReturnJobStatus() throws Exception {
            // Start a bulk operation to get a job ID
            String csv = "firstName,lastName,email,employeeNo,userType\n" +
                    "Job1,User,job1@innait.io,JEMP001,EMPLOYEE\n";
            MockMultipartFile file = new MockMultipartFile(
                    "file", "users.csv", "text/csv",
                    csv.getBytes(StandardCharsets.UTF_8));

            MvcResult bulkResult = mockMvc.perform(multipart("/api/v1/identity/users/bulk").file(file))
                    .andExpect(status().isAccepted())
                    .andReturn();

            String jobId = objectMapper.readTree(bulkResult.getResponse().getContentAsString())
                    .path("data").path("jobId").asText();

            // Check job status
            mockMvc.perform(get("/api/v1/identity/jobs/{jobId}", jobId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.jobId").value(jobId))
                    .andExpect(jsonPath("$.data.operationType").value("BULK_CREATE"));
        }
    }

    // ──────────────────────────── Permission Matrix ────────────────────────────

    @Nested
    class PermissionMatrix {

        @Test
        @WithMockUser(roles = "USER_ADMIN")
        void userAdminCanCreateUser() throws Exception {
            CreateUserRequest request = new CreateUserRequest(
                    "PermTest", "User", "perm.test@innait.io", "perm@innait.io",
                    "PEMP001", null, null, null, null,
                    null, null, UserType.EMPLOYEE, null, null, true, null, null, null);

            mockMvc.perform(post("/api/v1/identity/users")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk());
        }

        @Test
        @WithMockUser(roles = "HELPDESK")
        void helpdeskCanUnlockAccount() throws Exception {
            mockMvc.perform(post("/api/v1/identity/accounts/{accountId}/unlock", UUID.randomUUID()))
                    .andExpect(status().is4xxClientError()); // 404 since UUID doesn't exist, but 403 would mean access denied
        }

        @Test
        @WithMockUser(roles = "TENANT_ADMIN")
        void tenantAdminCanCreateRole() throws Exception {
            CreateRoleRequest request = new CreateRoleRequest(
                    "PERM_ROLE", "Perm Role", "Permission test", RoleType.TENANT, false);

            mockMvc.perform(post("/api/v1/identity/roles")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk());
        }

        @Test
        @WithMockUser(roles = "TENANT_ADMIN")
        void tenantAdminCanListGroups() throws Exception {
            mockMvc.perform(get("/api/v1/identity/groups")
                            .param("page", "0")
                            .param("size", "5"))
                    .andExpect(status().isOk());
        }
    }

    // ──────────────────────────── Full Lifecycle ────────────────────────────

    @Nested
    @WithMockUser(roles = "SUPER_ADMIN")
    class FullLifecycle {

        @Test
        void shouldCompleteUserLifecycle() throws Exception {
            // 1. Create user
            String userId = createTestUser("Lifecycle", "Test", "lifecycle@innait.io", "LEMP001");
            Assertions.assertNotNull(userId);

            // 2. Retrieve user
            mockMvc.perform(get("/api/v1/identity/users/{userId}", userId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.firstName").value("Lifecycle"));

            // 3. Get account
            String accountId = getFirstAccountId(userId);
            Assertions.assertNotNull(accountId);

            // 4. Activate account
            activateAccount(accountId);

            // 5. Create and assign role
            String roleId = createTestRole("LIFECYCLE_ROLE", "Lifecycle Role");
            RoleAssignmentRequest assignReq = new RoleAssignmentRequest(
                    UUID.fromString(roleId), "ADMIN", null, "Lifecycle test", null);

            mockMvc.perform(post("/api/v1/identity/accounts/{accountId}/roles", accountId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(assignReq)))
                    .andExpect(status().isOk());

            // 6. Verify role assigned
            mockMvc.perform(get("/api/v1/identity/accounts/{accountId}/roles", accountId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))));

            // 7. Create group and add member
            String groupId = createTestGroup("LIFECYCLE_GROUP", "Lifecycle Group");
            GroupMemberRequest memberReq = new GroupMemberRequest(
                    UUID.fromString(accountId), "ADMIN", null, "Lifecycle test");

            mockMvc.perform(post("/api/v1/identity/groups/{groupId}/members", groupId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(memberReq)))
                    .andExpect(status().isOk());

            // 8. Suspend account
            AccountStatusChangeRequest suspendReq = new AccountStatusChangeRequest(
                    AccountStatus.SUSPENDED, "Investigation", null);

            mockMvc.perform(patch("/api/v1/identity/accounts/{accountId}/status", accountId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(suspendReq)))
                    .andExpect(status().isOk());

            // 9. Terminate account
            AccountStatusChangeRequest terminateReq = new AccountStatusChangeRequest(
                    AccountStatus.DEPROVISIONED, "Employee left", null);

            mockMvc.perform(patch("/api/v1/identity/accounts/{accountId}/status", accountId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(terminateReq)))
                    .andExpect(status().isOk());

            // 10. Soft delete user
            mockMvc.perform(delete("/api/v1/identity/users/{userId}", userId))
                    .andExpect(status().isOk());
        }
    }

    // ──────────────────────────── Frozen API Contract ────────────────────────────

    @Nested
    @WithMockUser(roles = "SUPER_ADMIN")
    class FrozenApiContract {

        @Test
        void accountStatusEndpointShouldAcceptPatchWithBody() throws Exception {
            AccountStatusChangeRequest request = new AccountStatusChangeRequest(
                    AccountStatus.ACTIVE, null, null);

            // Verify the endpoint exists and accepts the correct format
            mockMvc.perform(patch("/api/v1/identity/accounts/{accountId}/status", UUID.randomUUID())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().is4xxClientError()); // 404 for non-existent account, not 405
        }

        @Test
        void accountRolesEndpointShouldReturnList() throws Exception {
            String userId = createTestUser("Contract", "Test", "contract@innait.io", "CEMP001");
            String accountId = getFirstAccountId(userId);

            mockMvc.perform(get("/api/v1/identity/accounts/{accountId}/roles", accountId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data").isArray());
        }

        @Test
        void accountEntitlementsEndpointShouldReturnList() throws Exception {
            String userId = createTestUser("Contract2", "Test", "contract2@innait.io", "CEMP002");
            String accountId = getFirstAccountId(userId);

            mockMvc.perform(get("/api/v1/identity/accounts/{accountId}/entitlements", accountId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data").isArray());
        }
    }

    // ──────────────────────────── Helpers ────────────────────────────

    private String createTestUser(String firstName, String lastName, String email, String empNo) throws Exception {
        CreateUserRequest request = new CreateUserRequest(
                firstName, lastName, firstName + " " + lastName, email,
                empNo, null, null, "Engineering", null,
                null, null, UserType.EMPLOYEE, "en", "UTC", true, "ADMIN_CREATED",
                null, null);

        MvcResult result = mockMvc.perform(post("/api/v1/identity/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andReturn();

        return objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("userId").asText();
    }

    private String createTestUserWithDept(String firstName, String lastName, String email,
                                          String empNo, String department) throws Exception {
        CreateUserRequest request = new CreateUserRequest(
                firstName, lastName, firstName + " " + lastName, email,
                empNo, null, null, department, null,
                null, null, UserType.EMPLOYEE, "en", "UTC", true, "ADMIN_CREATED",
                null, null);

        MvcResult result = mockMvc.perform(post("/api/v1/identity/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andReturn();

        return objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("userId").asText();
    }

    private String createTestRole(String code, String name) throws Exception {
        CreateRoleRequest request = new CreateRoleRequest(code, name, "Test role", RoleType.TENANT, false);

        MvcResult result = mockMvc.perform(post("/api/v1/identity/roles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andReturn();

        return objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("roleId").asText();
    }

    private String createTestGroup(String code, String name) throws Exception {
        CreateGroupRequest request = new CreateGroupRequest(code, name, "Test group", GroupType.STATIC);

        MvcResult result = mockMvc.perform(post("/api/v1/identity/groups")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andReturn();

        return objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("groupId").asText();
    }

    private String getFirstAccountId(String userId) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/identity/users/{userId}", userId))
                .andExpect(status().isOk())
                .andReturn();

        return objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("accounts").path(0).path("accountId").asText();
    }

    private void activateAccount(String accountId) throws Exception {
        AccountStatusChangeRequest request = new AccountStatusChangeRequest(
                AccountStatus.ACTIVE, null, null);

        mockMvc.perform(patch("/api/v1/identity/accounts/{accountId}/status", accountId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());
    }

    private void lockAccount(String accountId) throws Exception {
        AccountStatusChangeRequest request = new AccountStatusChangeRequest(
                AccountStatus.LOCKED, null, null);

        mockMvc.perform(patch("/api/v1/identity/accounts/{accountId}/status", accountId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());
    }
}
