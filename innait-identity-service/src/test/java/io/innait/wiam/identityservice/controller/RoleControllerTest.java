package io.innait.wiam.identityservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.common.constant.RoleType;
import io.innait.wiam.common.exception.ResourceNotFoundException;
import io.innait.wiam.identityservice.dto.*;
import io.innait.wiam.identityservice.entity.ActiveStatus;
import io.innait.wiam.identityservice.service.RoleService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

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

@WebMvcTest(RoleController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("RoleController WebMvc Tests")
class RoleControllerTest {

    private static final String BASE_URL = "/api/v1/identity/roles";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private RoleService roleService;

    // ──────────────────────────── Test Data Builders ────────────────────────────

    private static final UUID TEST_ROLE_ID = UUID.fromString("00000000-0000-0000-0000-000000000050");
    private static final UUID TEST_TENANT_ID = UUID.fromString("00000000-0000-0000-0000-000000000099");

    private RoleResponse buildRoleResponse() {
        return new RoleResponse(
                TEST_ROLE_ID, TEST_TENANT_ID,
                "MANAGER", "Manager",
                "Manager role with elevated privileges",
                RoleType.TENANT, false,
                ActiveStatus.ACTIVE,
                Instant.parse("2026-01-10T08:00:00Z"),
                Instant.parse("2026-01-10T08:00:00Z")
        );
    }

    private CreateRoleRequest buildValidCreateRequest() {
        return new CreateRoleRequest(
                "MANAGER", "Manager",
                "Manager role with elevated privileges",
                RoleType.TENANT, false
        );
    }

    // ──────────────────────────── Create Role ────────────────────────────

    @Nested
    @DisplayName("POST /api/v1/identity/roles")
    class CreateRole {

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldCreateRoleAndReturnSuccess")
        void shouldCreateRoleAndReturnSuccess() throws Exception {
            RoleResponse response = buildRoleResponse();
            when(roleService.createRole(
                    eq("MANAGER"), eq("Manager"), eq("Manager role with elevated privileges"),
                    eq(RoleType.TENANT), eq(false)
            )).thenReturn(response);

            mockMvc.perform(post(BASE_URL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(buildValidCreateRequest())))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.roleId").value(TEST_ROLE_ID.toString()))
                    .andExpect(jsonPath("$.data.roleCode").value("MANAGER"))
                    .andExpect(jsonPath("$.data.roleName").value("Manager"))
                    .andExpect(jsonPath("$.data.roleType").value("TENANT"))
                    .andExpect(jsonPath("$.data.system").value(false))
                    .andExpect(jsonPath("$.data.status").value("ACTIVE"));

            verify(roleService).createRole(eq("MANAGER"), eq("Manager"),
                    eq("Manager role with elevated privileges"), eq(RoleType.TENANT), eq(false));
        }

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldRejectCreateRoleWithMissingRequiredFields")
        void shouldRejectCreateRoleWithMissingRequiredFields() throws Exception {
            // roleCode, roleName, and roleType are all required
            String emptyBody = "{}";

            mockMvc.perform(post(BASE_URL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(emptyBody))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value("ERROR"))
                    .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));

            verifyNoInteractions(roleService);
        }

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldRejectCreateRoleWithBlankRoleCode")
        void shouldRejectCreateRoleWithBlankRoleCode() throws Exception {
            CreateRoleRequest invalid = new CreateRoleRequest(
                    "", "Manager", "Description", RoleType.TENANT, false
            );

            mockMvc.perform(post(BASE_URL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(invalid)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value("ERROR"))
                    .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));

            verifyNoInteractions(roleService);
        }

        @Test
        @WithMockUser(roles = "TENANT_ADMIN")
        @DisplayName("shouldAllowTenantAdminToCreateRole")
        void shouldAllowTenantAdminToCreateRole() throws Exception {
            when(roleService.createRole(anyString(), anyString(), anyString(), any(), anyBoolean()))
                    .thenReturn(buildRoleResponse());

            mockMvc.perform(post(BASE_URL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(buildValidCreateRequest())))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"));
        }
    }

    // ──────────────────────────── Get Role by ID ────────────────────────────

    @Nested
    @DisplayName("GET /api/v1/identity/roles/{roleId}")
    class GetRoleById {

        @Test
        @WithMockUser
        @DisplayName("shouldGetRoleById")
        void shouldGetRoleById() throws Exception {
            when(roleService.getRoleById(TEST_ROLE_ID)).thenReturn(buildRoleResponse());

            mockMvc.perform(get(BASE_URL + "/{roleId}", TEST_ROLE_ID))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.roleId").value(TEST_ROLE_ID.toString()))
                    .andExpect(jsonPath("$.data.roleCode").value("MANAGER"))
                    .andExpect(jsonPath("$.data.description").value("Manager role with elevated privileges"));

            verify(roleService).getRoleById(TEST_ROLE_ID);
        }

        @Test
        @WithMockUser
        @DisplayName("shouldReturn404ForNonExistentRole")
        void shouldReturn404ForNonExistentRole() throws Exception {
            UUID nonExistentId = UUID.randomUUID();
            when(roleService.getRoleById(nonExistentId))
                    .thenThrow(new ResourceNotFoundException("Role", nonExistentId.toString()));

            mockMvc.perform(get(BASE_URL + "/{roleId}", nonExistentId))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value("ERROR"))
                    .andExpect(jsonPath("$.error.code").value("NOT_FOUND"))
                    .andExpect(jsonPath("$.error.message", containsString("Role not found")));
        }
    }

    // ──────────────────────────── List Roles ────────────────────────────

    @Nested
    @DisplayName("GET /api/v1/identity/roles")
    class ListRoles {

        @Test
        @WithMockUser
        @DisplayName("shouldListRolesWithPagination")
        void shouldListRolesWithPagination() throws Exception {
            RoleResponse role1 = buildRoleResponse();
            RoleResponse role2 = new RoleResponse(
                    UUID.randomUUID(), TEST_TENANT_ID,
                    "DEVELOPER", "Developer",
                    "Developer role",
                    RoleType.TENANT, false,
                    ActiveStatus.ACTIVE,
                    Instant.now(), Instant.now()
            );

            Page<RoleResponse> page = new PageImpl<>(List.of(role1, role2));
            when(roleService.listRoles(any(Pageable.class))).thenReturn(page);

            mockMvc.perform(get(BASE_URL)
                            .param("page", "0")
                            .param("size", "10"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.content").isArray())
                    .andExpect(jsonPath("$.data.content", hasSize(2)))
                    .andExpect(jsonPath("$.data.content[0].roleCode").value("MANAGER"))
                    .andExpect(jsonPath("$.data.content[1].roleCode").value("DEVELOPER"));

            verify(roleService).listRoles(any(Pageable.class));
        }

        @Test
        @WithMockUser
        @DisplayName("shouldReturnEmptyPageWhenNoRolesExist")
        void shouldReturnEmptyPageWhenNoRolesExist() throws Exception {
            Page<RoleResponse> emptyPage = new PageImpl<>(Collections.emptyList());
            when(roleService.listRoles(any(Pageable.class))).thenReturn(emptyPage);

            mockMvc.perform(get(BASE_URL)
                            .param("page", "0")
                            .param("size", "10"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.content", hasSize(0)));
        }
    }

    // ──────────────────────────── Update Role ────────────────────────────

    @Nested
    @DisplayName("PATCH /api/v1/identity/roles/{roleId}")
    class UpdateRole {

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldUpdateRole")
        void shouldUpdateRole() throws Exception {
            UpdateRoleRequest updateReq = new UpdateRoleRequest("Updated Manager", "Updated description");

            RoleResponse updatedResponse = new RoleResponse(
                    TEST_ROLE_ID, TEST_TENANT_ID,
                    "MANAGER", "Updated Manager",
                    "Updated description",
                    RoleType.TENANT, false,
                    ActiveStatus.ACTIVE,
                    Instant.parse("2026-01-10T08:00:00Z"),
                    Instant.parse("2026-03-01T12:00:00Z")
            );

            when(roleService.updateRole(eq(TEST_ROLE_ID), eq("Updated Manager"), eq("Updated description")))
                    .thenReturn(updatedResponse);

            mockMvc.perform(patch(BASE_URL + "/{roleId}", TEST_ROLE_ID)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(updateReq)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.roleName").value("Updated Manager"))
                    .andExpect(jsonPath("$.data.description").value("Updated description"));

            verify(roleService).updateRole(eq(TEST_ROLE_ID), eq("Updated Manager"), eq("Updated description"));
        }
    }

    // ──────────────────────────── Deactivate Role ────────────────────────────

    @Nested
    @DisplayName("DELETE /api/v1/identity/roles/{roleId}")
    class DeactivateRole {

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldDeactivateRole")
        void shouldDeactivateRole() throws Exception {
            doNothing().when(roleService).deactivateRole(TEST_ROLE_ID);

            mockMvc.perform(delete(BASE_URL + "/{roleId}", TEST_ROLE_ID))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data").doesNotExist());

            verify(roleService).deactivateRole(TEST_ROLE_ID);
        }

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldReturn404WhenDeactivatingNonExistentRole")
        void shouldReturn404WhenDeactivatingNonExistentRole() throws Exception {
            UUID nonExistentId = UUID.randomUUID();
            doThrow(new ResourceNotFoundException("Role", nonExistentId.toString()))
                    .when(roleService).deactivateRole(nonExistentId);

            mockMvc.perform(delete(BASE_URL + "/{roleId}", nonExistentId))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value("ERROR"))
                    .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
        }
    }

    // ──────────────────────────── Bulk Assign Role ────────────────────────────

    @Nested
    @DisplayName("POST /api/v1/identity/roles/{roleId}/bulk-assign")
    class BulkAssignRole {

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldBulkAssignRole")
        void shouldBulkAssignRole() throws Exception {
            UUID accountId1 = UUID.randomUUID();
            UUID accountId2 = UUID.randomUUID();
            BulkRoleRequest request = new BulkRoleRequest(List.of(accountId1, accountId2));

            doNothing().when(roleService).bulkAssignRole(eq(TEST_ROLE_ID), anyList());

            mockMvc.perform(post(BASE_URL + "/{roleId}/bulk-assign", TEST_ROLE_ID)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"));

            verify(roleService).bulkAssignRole(eq(TEST_ROLE_ID), anyList());
        }

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldRejectBulkAssignWithEmptyAccountIds")
        void shouldRejectBulkAssignWithEmptyAccountIds() throws Exception {
            BulkRoleRequest request = new BulkRoleRequest(Collections.emptyList());

            mockMvc.perform(post(BASE_URL + "/{roleId}/bulk-assign", TEST_ROLE_ID)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value("ERROR"))
                    .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));

            verifyNoInteractions(roleService);
        }
    }

    // ──────────────────────────── Bulk Remove Role ────────────────────────────

    @Nested
    @DisplayName("POST /api/v1/identity/roles/{roleId}/bulk-remove")
    class BulkRemoveRole {

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldBulkRemoveRole")
        void shouldBulkRemoveRole() throws Exception {
            UUID accountId1 = UUID.randomUUID();
            BulkRoleRequest request = new BulkRoleRequest(List.of(accountId1));

            doNothing().when(roleService).bulkRemoveRole(eq(TEST_ROLE_ID), anyList());

            mockMvc.perform(post(BASE_URL + "/{roleId}/bulk-remove", TEST_ROLE_ID)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"));

            verify(roleService).bulkRemoveRole(eq(TEST_ROLE_ID), anyList());
        }
    }

    // ──────────────────────────── ApiResponse Envelope ────────────────────────────

    @Nested
    @DisplayName("ApiResponse envelope format")
    class ApiResponseEnvelope {

        @Test
        @WithMockUser
        @DisplayName("shouldReturnApiResponseEnvelopeOnSuccess")
        void shouldReturnApiResponseEnvelopeOnSuccess() throws Exception {
            when(roleService.getRoleById(TEST_ROLE_ID)).thenReturn(buildRoleResponse());

            mockMvc.perform(get(BASE_URL + "/{roleId}", TEST_ROLE_ID))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data").exists())
                    .andExpect(jsonPath("$.error").doesNotExist());
        }

        @Test
        @WithMockUser
        @DisplayName("shouldReturnApiResponseEnvelopeOnError")
        void shouldReturnApiResponseEnvelopeOnError() throws Exception {
            UUID id = UUID.randomUUID();
            when(roleService.getRoleById(id))
                    .thenThrow(new ResourceNotFoundException("Role", id.toString()));

            mockMvc.perform(get(BASE_URL + "/{roleId}", id))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value("ERROR"))
                    .andExpect(jsonPath("$.error").exists())
                    .andExpect(jsonPath("$.error.code").value("NOT_FOUND"))
                    .andExpect(jsonPath("$.data").doesNotExist());
        }
    }
}
