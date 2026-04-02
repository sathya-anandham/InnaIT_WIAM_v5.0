package io.innait.wiam.identityservice.service;

import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.exception.ResourceNotFoundException;
import io.innait.wiam.identityservice.dto.GroupMemberRequest;
import io.innait.wiam.identityservice.dto.GroupResponse;
import io.innait.wiam.identityservice.entity.*;
import io.innait.wiam.identityservice.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class GroupService {

    private static final Logger log = LoggerFactory.getLogger(GroupService.class);

    private final GroupRepository groupRepository;
    private final AccountRepository accountRepository;
    private final AccountGroupMapRepository accountGroupMapRepository;
    private final GroupRoleMapRepository groupRoleMapRepository;
    private final RoleRepository roleRepository;

    public GroupService(GroupRepository groupRepository,
                        AccountRepository accountRepository,
                        AccountGroupMapRepository accountGroupMapRepository,
                        GroupRoleMapRepository groupRoleMapRepository,
                        RoleRepository roleRepository) {
        this.groupRepository = groupRepository;
        this.accountRepository = accountRepository;
        this.accountGroupMapRepository = accountGroupMapRepository;
        this.groupRoleMapRepository = groupRoleMapRepository;
        this.roleRepository = roleRepository;
    }

    public GroupResponse createGroup(String groupCode, String groupName, String description,
                                     GroupType groupType) {
        UUID tenantId = TenantContext.requireTenantId();

        groupRepository.findByTenantIdAndGroupCode(tenantId, groupCode)
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("Group code already exists: " + groupCode);
                });

        Group group = new Group();
        group.setGroupCode(groupCode);
        group.setGroupName(groupName);
        group.setDescription(description);
        group.setGroupType(groupType);
        group.setStatus(ActiveStatus.ACTIVE);

        group = groupRepository.save(group);
        log.info("Created group [{}] code [{}] for tenant [{}]", group.getId(), groupCode, tenantId);
        return toGroupResponse(group);
    }

    @Transactional(readOnly = true)
    public GroupResponse getGroupById(UUID groupId) {
        return toGroupResponse(findGroupOrThrow(groupId));
    }

    @Transactional(readOnly = true)
    public Page<GroupResponse> listGroups(Pageable pageable) {
        UUID tenantId = TenantContext.requireTenantId();
        return groupRepository.findByTenantId(tenantId, pageable).map(this::toGroupResponse);
    }

    public GroupResponse updateGroup(UUID groupId, String groupName, String description) {
        Group group = findGroupOrThrow(groupId);
        if (groupName != null) group.setGroupName(groupName);
        if (description != null) group.setDescription(description);
        group = groupRepository.save(group);
        log.info("Updated group [{}]", groupId);
        return toGroupResponse(group);
    }

    public void deactivateGroup(UUID groupId) {
        Group group = findGroupOrThrow(groupId);
        group.setStatus(ActiveStatus.INACTIVE);
        groupRepository.save(group);
        log.info("Deactivated group [{}]", groupId);
    }

    public void addMember(UUID groupId, GroupMemberRequest request) {
        UUID tenantId = TenantContext.requireTenantId();
        Group group = findGroupOrThrow(groupId);

        Account account = accountRepository.findById(request.accountId())
                .filter(a -> a.getTenantId().equals(tenantId))
                .orElseThrow(() -> new ResourceNotFoundException("Account", request.accountId().toString()));

        // Check duplicate
        boolean alreadyMember = accountGroupMapRepository.findByAccountIdAndActive(request.accountId(), true)
                .stream().anyMatch(agm -> agm.getGroup().getId().equals(groupId));
        if (alreadyMember) {
            throw new IllegalArgumentException("Account is already a member of this group");
        }

        AccountGroupMap agm = new AccountGroupMap();
        agm.setAccount(account);
        agm.setGroup(group);
        agm.setAssignmentSource(MappingAssignmentSource.valueOf(request.assignmentSource()));
        agm.setActive(true);
        agm.setAssignedAt(Instant.now());
        accountGroupMapRepository.save(agm);

        log.info("Added account [{}] to group [{}]", request.accountId(), groupId);
    }

    public void removeMember(UUID groupId, UUID accountId) {
        List<AccountGroupMap> mappings = accountGroupMapRepository.findByAccountIdAndActive(accountId, true);
        AccountGroupMap agm = mappings.stream()
                .filter(m -> m.getGroup().getId().equals(groupId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("GroupMembership",
                        "groupId=" + groupId + ", accountId=" + accountId));

        agm.setActive(false);
        agm.setRemovedAt(Instant.now());
        accountGroupMapRepository.save(agm);

        log.info("Removed account [{}] from group [{}]", accountId, groupId);
    }

    public void assignRoleToGroup(UUID groupId, UUID roleId) {
        UUID tenantId = TenantContext.requireTenantId();
        Group group = findGroupOrThrow(groupId);
        Role role = roleRepository.findById(roleId)
                .filter(r -> r.getTenantId().equals(tenantId))
                .orElseThrow(() -> new ResourceNotFoundException("Role", roleId.toString()));

        // Check duplicate
        boolean alreadyAssigned = groupRoleMapRepository.findByGroupIdAndActive(groupId, true)
                .stream().anyMatch(grm -> grm.getRole().getId().equals(roleId));
        if (alreadyAssigned) {
            throw new IllegalArgumentException("Role already assigned to this group");
        }

        GroupRoleMap grm = new GroupRoleMap();
        grm.setGroup(group);
        grm.setRole(role);
        grm.setActive(true);
        groupRoleMapRepository.save(grm);

        log.info("Assigned role [{}] to group [{}]", roleId, groupId);
    }

    public void removeRoleFromGroup(UUID groupId, UUID roleId) {
        List<GroupRoleMap> mappings = groupRoleMapRepository.findByGroupIdAndActive(groupId, true);
        GroupRoleMap grm = mappings.stream()
                .filter(m -> m.getRole().getId().equals(roleId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("GroupRoleMapping",
                        "groupId=" + groupId + ", roleId=" + roleId));

        grm.setActive(false);
        groupRoleMapRepository.save(grm);

        log.info("Removed role [{}] from group [{}]", roleId, groupId);
    }

    private Group findGroupOrThrow(UUID groupId) {
        UUID tenantId = TenantContext.requireTenantId();
        return groupRepository.findById(groupId)
                .filter(g -> g.getTenantId().equals(tenantId))
                .orElseThrow(() -> new ResourceNotFoundException("Group", groupId.toString()));
    }

    private GroupResponse toGroupResponse(Group group) {
        return new GroupResponse(
                group.getId(), group.getTenantId(), group.getGroupCode(), group.getGroupName(),
                group.getDescription(), group.getGroupType(), group.getStatus(),
                group.getCreatedAt(), group.getUpdatedAt()
        );
    }
}
