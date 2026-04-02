package io.innait.wiam.identityservice.controller;

import io.innait.wiam.common.dto.ApiResponse;
import io.innait.wiam.identityservice.dto.*;
import io.innait.wiam.identityservice.service.GroupService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/identity/groups")
public class GroupController {

    private final GroupService groupService;

    public GroupController(GroupService groupService) {
        this.groupService = groupService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN')")
    public ResponseEntity<ApiResponse<GroupResponse>> createGroup(@Valid @RequestBody CreateGroupRequest request) {
        GroupResponse response = groupService.createGroup(
                request.groupCode(), request.groupName(), request.description(), request.groupType());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/{groupId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<GroupResponse>> getGroupById(@PathVariable UUID groupId) {
        return ResponseEntity.ok(ApiResponse.success(groupService.getGroupById(groupId)));
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Page<GroupResponse>>> listGroups(Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(groupService.listGroups(pageable)));
    }

    @PatchMapping("/{groupId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN')")
    public ResponseEntity<ApiResponse<GroupResponse>> updateGroup(
            @PathVariable UUID groupId, @Valid @RequestBody UpdateGroupRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                groupService.updateGroup(groupId, request.groupName(), request.description())));
    }

    @DeleteMapping("/{groupId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deactivateGroup(@PathVariable UUID groupId) {
        groupService.deactivateGroup(groupId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{groupId}/members")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> addMember(
            @PathVariable UUID groupId, @Valid @RequestBody GroupMemberRequest request) {
        groupService.addMember(groupId, request);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @DeleteMapping("/{groupId}/members/{accountId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> removeMember(
            @PathVariable UUID groupId, @PathVariable UUID accountId) {
        groupService.removeMember(groupId, accountId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{groupId}/roles/{roleId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> assignRoleToGroup(
            @PathVariable UUID groupId, @PathVariable UUID roleId) {
        groupService.assignRoleToGroup(groupId, roleId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @DeleteMapping("/{groupId}/roles/{roleId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> removeRoleFromGroup(
            @PathVariable UUID groupId, @PathVariable UUID roleId) {
        groupService.removeRoleFromGroup(groupId, roleId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
