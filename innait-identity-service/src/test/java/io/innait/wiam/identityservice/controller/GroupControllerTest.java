package io.innait.wiam.identityservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.common.exception.GlobalExceptionHandler;
import io.innait.wiam.common.exception.ResourceNotFoundException;
import io.innait.wiam.identityservice.dto.*;
import io.innait.wiam.identityservice.entity.ActiveStatus;
import io.innait.wiam.identityservice.entity.GroupType;
import io.innait.wiam.identityservice.service.GroupService;
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

@WebMvcTest(GroupController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
@DisplayName("GroupController WebMvc Tests")
class GroupControllerTest {

    private static final String BASE_URL = "/api/v1/identity/groups";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private GroupService groupService;

    // ──────────────────────────── Test Data Builders ────────────────────────────

    private static final UUID TEST_GROUP_ID = UUID.fromString("00000000-0000-0000-0000-000000000070");
    private static final UUID TEST_TENANT_ID = UUID.fromString("00000000-0000-0000-0000-000000000099");
    private static final UUID TEST_ACCOUNT_ID = UUID.fromString("00000000-0000-0000-0000-000000000010");
    private static final UUID TEST_ROLE_ID = UUID.fromString("00000000-0000-0000-0000-000000000050");

    private GroupResponse buildGroupResponse() {
        return new GroupResponse(
                TEST_GROUP_ID, TEST_TENANT_ID,
                "ENGINEERING", "Engineering Team",
                "Engineering department group",
                GroupType.STATIC,
                ActiveStatus.ACTIVE,
                Instant.parse("2026-01-10T08:00:00Z"),
                Instant.parse("2026-01-10T08:00:00Z")
        );
    }

    private CreateGroupRequest buildValidCreateRequest() {
        return new CreateGroupRequest(
                "ENGINEERING", "Engineering Team",
                "Engineering department group",
                GroupType.STATIC
        );
    }

    // ──────────────────────────── Create Group ────────────────────────────

    @Nested
    @DisplayName("POST /api/v1/identity/groups")
    class CreateGroup {

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldCreateGroupAndReturnSuccess")
        void shouldCreateGroupAndReturnSuccess() throws Exception {
            GroupResponse response = buildGroupResponse();
            when(groupService.createGroup(
                    eq("ENGINEERING"), eq("Engineering Team"),
                    eq("Engineering department group"), eq(GroupType.STATIC)
            )).thenReturn(response);

            mockMvc.perform(post(BASE_URL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(buildValidCreateRequest())))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.groupId").value(TEST_GROUP_ID.toString()))
                    .andExpect(jsonPath("$.data.groupCode").value("ENGINEERING"))
                    .andExpect(jsonPath("$.data.groupName").value("Engineering Team"))
                    .andExpect(jsonPath("$.data.groupType").value("STATIC"))
                    .andExpect(jsonPath("$.data.status").value("ACTIVE"));

            verify(groupService).createGroup(
                    eq("ENGINEERING"), eq("Engineering Team"),
                    eq("Engineering department group"), eq(GroupType.STATIC));
        }

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldRejectCreateGroupWithMissingRequiredFields")
        void shouldRejectCreateGroupWithMissingRequiredFields() throws Exception {
            // groupCode, groupName, and groupType are all required
            String emptyBody = "{}";

            mockMvc.perform(post(BASE_URL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(emptyBody))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value("ERROR"))
                    .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));

            verifyNoInteractions(groupService);
        }

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldRejectCreateGroupWithBlankGroupCode")
        void shouldRejectCreateGroupWithBlankGroupCode() throws Exception {
            CreateGroupRequest invalid = new CreateGroupRequest(
                    "", "Some Name", "Description", GroupType.STATIC
            );

            mockMvc.perform(post(BASE_URL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(invalid)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value("ERROR"))
                    .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));

            verifyNoInteractions(groupService);
        }

        @Test
        @WithMockUser(roles = "USER_ADMIN")
        @DisplayName("shouldAllowUserAdminToCreateGroup")
        void shouldAllowUserAdminToCreateGroup() throws Exception {
            when(groupService.createGroup(anyString(), anyString(), anyString(), any()))
                    .thenReturn(buildGroupResponse());

            mockMvc.perform(post(BASE_URL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(buildValidCreateRequest())))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"));
        }
    }

    // ──────────────────────────── Get Group by ID ────────────────────────────

    @Nested
    @DisplayName("GET /api/v1/identity/groups/{groupId}")
    class GetGroupById {

        @Test
        @WithMockUser
        @DisplayName("shouldGetGroupById")
        void shouldGetGroupById() throws Exception {
            when(groupService.getGroupById(TEST_GROUP_ID)).thenReturn(buildGroupResponse());

            mockMvc.perform(get(BASE_URL + "/{groupId}", TEST_GROUP_ID))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.groupId").value(TEST_GROUP_ID.toString()))
                    .andExpect(jsonPath("$.data.groupCode").value("ENGINEERING"))
                    .andExpect(jsonPath("$.data.groupName").value("Engineering Team"))
                    .andExpect(jsonPath("$.data.description").value("Engineering department group"));

            verify(groupService).getGroupById(TEST_GROUP_ID);
        }

        @Test
        @WithMockUser
        @DisplayName("shouldReturn404ForNonExistentGroup")
        void shouldReturn404ForNonExistentGroup() throws Exception {
            UUID nonExistentId = UUID.randomUUID();
            when(groupService.getGroupById(nonExistentId))
                    .thenThrow(new ResourceNotFoundException("Group", nonExistentId.toString()));

            mockMvc.perform(get(BASE_URL + "/{groupId}", nonExistentId))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value("ERROR"))
                    .andExpect(jsonPath("$.error.code").value("NOT_FOUND"))
                    .andExpect(jsonPath("$.error.message", containsString("Group not found")));
        }
    }

    // ──────────────────────────── List Groups ────────────────────────────

    @Nested
    @DisplayName("GET /api/v1/identity/groups")
    class ListGroups {

        @Test
        @WithMockUser
        @DisplayName("shouldListGroupsWithPagination")
        void shouldListGroupsWithPagination() throws Exception {
            GroupResponse group1 = buildGroupResponse();
            GroupResponse group2 = new GroupResponse(
                    UUID.randomUUID(), TEST_TENANT_ID,
                    "QA_TEAM", "QA Team",
                    "Quality assurance team",
                    GroupType.STATIC,
                    ActiveStatus.ACTIVE,
                    Instant.now(), Instant.now()
            );

            Page<GroupResponse> page = new PageImpl<>(List.of(group1, group2));
            when(groupService.listGroups(any(Pageable.class))).thenReturn(page);

            mockMvc.perform(get(BASE_URL)
                            .param("page", "0")
                            .param("size", "10"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.content").isArray())
                    .andExpect(jsonPath("$.data.content", hasSize(2)))
                    .andExpect(jsonPath("$.data.content[0].groupCode").value("ENGINEERING"))
                    .andExpect(jsonPath("$.data.content[1].groupCode").value("QA_TEAM"));

            verify(groupService).listGroups(any(Pageable.class));
        }

        @Test
        @WithMockUser
        @DisplayName("shouldReturnEmptyPageWhenNoGroupsExist")
        void shouldReturnEmptyPageWhenNoGroupsExist() throws Exception {
            Page<GroupResponse> emptyPage = new PageImpl<>(Collections.emptyList());
            when(groupService.listGroups(any(Pageable.class))).thenReturn(emptyPage);

            mockMvc.perform(get(BASE_URL)
                            .param("page", "0")
                            .param("size", "10"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.content", hasSize(0)));
        }
    }

    // ──────────────────────────── Update Group ────────────────────────────

    @Nested
    @DisplayName("PATCH /api/v1/identity/groups/{groupId}")
    class UpdateGroup {

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldUpdateGroup")
        void shouldUpdateGroup() throws Exception {
            UpdateGroupRequest updateReq = new UpdateGroupRequest("Updated Engineering", "Updated description");

            GroupResponse updatedResponse = new GroupResponse(
                    TEST_GROUP_ID, TEST_TENANT_ID,
                    "ENGINEERING", "Updated Engineering",
                    "Updated description",
                    GroupType.STATIC,
                    ActiveStatus.ACTIVE,
                    Instant.parse("2026-01-10T08:00:00Z"),
                    Instant.parse("2026-03-01T12:00:00Z")
            );

            when(groupService.updateGroup(eq(TEST_GROUP_ID), eq("Updated Engineering"), eq("Updated description")))
                    .thenReturn(updatedResponse);

            mockMvc.perform(patch(BASE_URL + "/{groupId}", TEST_GROUP_ID)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(updateReq)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.groupName").value("Updated Engineering"))
                    .andExpect(jsonPath("$.data.description").value("Updated description"));

            verify(groupService).updateGroup(eq(TEST_GROUP_ID), eq("Updated Engineering"), eq("Updated description"));
        }

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldReturn404WhenUpdatingNonExistentGroup")
        void shouldReturn404WhenUpdatingNonExistentGroup() throws Exception {
            UUID nonExistentId = UUID.randomUUID();
            UpdateGroupRequest updateReq = new UpdateGroupRequest("Name", "Desc");

            when(groupService.updateGroup(eq(nonExistentId), anyString(), anyString()))
                    .thenThrow(new ResourceNotFoundException("Group", nonExistentId.toString()));

            mockMvc.perform(patch(BASE_URL + "/{groupId}", nonExistentId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(updateReq)))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value("ERROR"))
                    .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
        }
    }

    // ──────────────────────────── Deactivate Group ────────────────────────────

    @Nested
    @DisplayName("DELETE /api/v1/identity/groups/{groupId}")
    class DeactivateGroup {

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldDeactivateGroup")
        void shouldDeactivateGroup() throws Exception {
            doNothing().when(groupService).deactivateGroup(TEST_GROUP_ID);

            mockMvc.perform(delete(BASE_URL + "/{groupId}", TEST_GROUP_ID))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data").doesNotExist());

            verify(groupService).deactivateGroup(TEST_GROUP_ID);
        }
    }

    // ──────────────────────────── Member Management ────────────────────────────

    @Nested
    @DisplayName("Member management endpoints")
    class MemberManagement {

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldAddMemberToGroup")
        void shouldAddMemberToGroup() throws Exception {
            GroupMemberRequest request = new GroupMemberRequest(
                    TEST_ACCOUNT_ID, "ADMIN", null, "Adding for project"
            );

            doNothing().when(groupService).addMember(eq(TEST_GROUP_ID), any(GroupMemberRequest.class));

            mockMvc.perform(post(BASE_URL + "/{groupId}/members", TEST_GROUP_ID)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"));

            verify(groupService).addMember(eq(TEST_GROUP_ID), any(GroupMemberRequest.class));
        }

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldRejectAddMemberWithMissingAccountId")
        void shouldRejectAddMemberWithMissingAccountId() throws Exception {
            // accountId and assignmentSource are @NotNull
            String invalidBody = "{\"reason\": \"test\"}";

            mockMvc.perform(post(BASE_URL + "/{groupId}/members", TEST_GROUP_ID)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(invalidBody))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value("ERROR"))
                    .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));

            verifyNoInteractions(groupService);
        }

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldRemoveMemberFromGroup")
        void shouldRemoveMemberFromGroup() throws Exception {
            doNothing().when(groupService).removeMember(TEST_GROUP_ID, TEST_ACCOUNT_ID);

            mockMvc.perform(delete(BASE_URL + "/{groupId}/members/{accountId}",
                            TEST_GROUP_ID, TEST_ACCOUNT_ID))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"));

            verify(groupService).removeMember(TEST_GROUP_ID, TEST_ACCOUNT_ID);
        }

        @Test
        @WithMockUser(roles = "USER_ADMIN")
        @DisplayName("shouldAllowUserAdminToAddMember")
        void shouldAllowUserAdminToAddMember() throws Exception {
            GroupMemberRequest request = new GroupMemberRequest(
                    TEST_ACCOUNT_ID, "ADMIN", null, "Adding team member"
            );

            doNothing().when(groupService).addMember(eq(TEST_GROUP_ID), any(GroupMemberRequest.class));

            mockMvc.perform(post(BASE_URL + "/{groupId}/members", TEST_GROUP_ID)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"));
        }
    }

    // ──────────────────────────── Role Mapping ────────────────────────────

    @Nested
    @DisplayName("Group-Role mapping endpoints")
    class RoleMapping {

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldAssignRoleToGroup")
        void shouldAssignRoleToGroup() throws Exception {
            doNothing().when(groupService).assignRoleToGroup(TEST_GROUP_ID, TEST_ROLE_ID);

            mockMvc.perform(post(BASE_URL + "/{groupId}/roles/{roleId}",
                            TEST_GROUP_ID, TEST_ROLE_ID))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"));

            verify(groupService).assignRoleToGroup(TEST_GROUP_ID, TEST_ROLE_ID);
        }

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldRemoveRoleFromGroup")
        void shouldRemoveRoleFromGroup() throws Exception {
            doNothing().when(groupService).removeRoleFromGroup(TEST_GROUP_ID, TEST_ROLE_ID);

            mockMvc.perform(delete(BASE_URL + "/{groupId}/roles/{roleId}",
                            TEST_GROUP_ID, TEST_ROLE_ID))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"));

            verify(groupService).removeRoleFromGroup(TEST_GROUP_ID, TEST_ROLE_ID);
        }

        @Test
        @WithMockUser(roles = "SUPER_ADMIN")
        @DisplayName("shouldReturn404WhenAssigningRoleToNonExistentGroup")
        void shouldReturn404WhenAssigningRoleToNonExistentGroup() throws Exception {
            UUID nonExistentGroupId = UUID.randomUUID();
            doThrow(new ResourceNotFoundException("Group", nonExistentGroupId.toString()))
                    .when(groupService).assignRoleToGroup(nonExistentGroupId, TEST_ROLE_ID);

            mockMvc.perform(post(BASE_URL + "/{groupId}/roles/{roleId}",
                            nonExistentGroupId, TEST_ROLE_ID))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value("ERROR"))
                    .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
        }

        @Test
        @WithMockUser(roles = "TENANT_ADMIN")
        @DisplayName("shouldAllowTenantAdminToAssignRoleToGroup")
        void shouldAllowTenantAdminToAssignRoleToGroup() throws Exception {
            doNothing().when(groupService).assignRoleToGroup(TEST_GROUP_ID, TEST_ROLE_ID);

            mockMvc.perform(post(BASE_URL + "/{groupId}/roles/{roleId}",
                            TEST_GROUP_ID, TEST_ROLE_ID))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"));
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
            when(groupService.getGroupById(TEST_GROUP_ID)).thenReturn(buildGroupResponse());

            mockMvc.perform(get(BASE_URL + "/{groupId}", TEST_GROUP_ID))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data").exists())
                    .andExpect(jsonPath("$.data.groupId").exists())
                    .andExpect(jsonPath("$.error").doesNotExist());
        }

        @Test
        @WithMockUser
        @DisplayName("shouldReturnApiResponseEnvelopeOnError")
        void shouldReturnApiResponseEnvelopeOnError() throws Exception {
            UUID id = UUID.randomUUID();
            when(groupService.getGroupById(id))
                    .thenThrow(new ResourceNotFoundException("Group", id.toString()));

            mockMvc.perform(get(BASE_URL + "/{groupId}", id))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value("ERROR"))
                    .andExpect(jsonPath("$.error").exists())
                    .andExpect(jsonPath("$.error.code").value("NOT_FOUND"))
                    .andExpect(jsonPath("$.error.message").isNotEmpty())
                    .andExpect(jsonPath("$.data").doesNotExist());
        }
    }
}
