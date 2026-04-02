package io.innait.wiam.identityservice.service;

import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.exception.ResourceNotFoundException;
import io.innait.wiam.identityservice.dto.GroupMemberRequest;
import io.innait.wiam.identityservice.dto.GroupResponse;
import io.innait.wiam.identityservice.entity.*;
import io.innait.wiam.identityservice.repository.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GroupServiceTest {

    @Mock private GroupRepository groupRepository;
    @Mock private AccountRepository accountRepository;
    @Mock private AccountGroupMapRepository accountGroupMapRepository;
    @Mock private GroupRoleMapRepository groupRoleMapRepository;
    @Mock private RoleRepository roleRepository;

    @InjectMocks
    private GroupService groupService;

    private final UUID tenantId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(tenantId);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    // ---- CRUD ----

    @Test
    void shouldCreateGroup() {
        when(groupRepository.findByTenantIdAndGroupCode(tenantId, "ENGINEERS")).thenReturn(Optional.empty());
        when(groupRepository.save(any(Group.class))).thenAnswer(inv -> {
            Group g = inv.getArgument(0);
            g.setId(UUID.randomUUID());
            g.setTenantId(tenantId);
            return g;
        });

        GroupResponse response = groupService.createGroup("ENGINEERS", "Engineers", "Engineering team", GroupType.STATIC);

        assertThat(response.groupCode()).isEqualTo("ENGINEERS");
        assertThat(response.groupType()).isEqualTo(GroupType.STATIC);
        assertThat(response.status()).isEqualTo(ActiveStatus.ACTIVE);
    }

    @Test
    void shouldRejectDuplicateGroupCode() {
        when(groupRepository.findByTenantIdAndGroupCode(tenantId, "ENGINEERS")).thenReturn(Optional.of(new Group()));

        assertThatThrownBy(() -> groupService.createGroup("ENGINEERS", "Engineers", null, GroupType.STATIC))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Group code already exists");
    }

    @Test
    void shouldGetGroupById() {
        UUID groupId = UUID.randomUUID();
        Group group = createTestGroup(groupId, "ADMINS");
        when(groupRepository.findById(groupId)).thenReturn(Optional.of(group));

        GroupResponse response = groupService.getGroupById(groupId);

        assertThat(response.groupCode()).isEqualTo("ADMINS");
    }

    @Test
    void shouldListGroups() {
        Group group = createTestGroup(UUID.randomUUID(), "ADMINS");
        when(groupRepository.findByTenantId(tenantId, PageRequest.of(0, 10)))
                .thenReturn(new PageImpl<>(List.of(group)));

        Page<GroupResponse> result = groupService.listGroups(PageRequest.of(0, 10));

        assertThat(result.getTotalElements()).isEqualTo(1);
    }

    @Test
    void shouldUpdateGroup() {
        UUID groupId = UUID.randomUUID();
        Group group = createTestGroup(groupId, "ADMINS");
        when(groupRepository.findById(groupId)).thenReturn(Optional.of(group));
        when(groupRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        GroupResponse response = groupService.updateGroup(groupId, "Super Admins", "Updated description");

        assertThat(response.groupName()).isEqualTo("Super Admins");
    }

    @Test
    void shouldDeactivateGroup() {
        UUID groupId = UUID.randomUUID();
        Group group = createTestGroup(groupId, "OLD_GROUP");
        when(groupRepository.findById(groupId)).thenReturn(Optional.of(group));
        when(groupRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        groupService.deactivateGroup(groupId);

        assertThat(group.getStatus()).isEqualTo(ActiveStatus.INACTIVE);
    }

    // ---- Member management ----

    @Test
    void shouldAddMember() {
        UUID groupId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();

        Group group = createTestGroup(groupId, "ENGINEERS");
        when(groupRepository.findById(groupId)).thenReturn(Optional.of(group));

        Account account = new Account();
        account.setId(accountId);
        account.setTenantId(tenantId);
        when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
        when(accountGroupMapRepository.findByAccountIdAndActive(accountId, true)).thenReturn(Collections.emptyList());
        when(accountGroupMapRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        GroupMemberRequest request = new GroupMemberRequest(accountId, "MANUAL", null, null);
        groupService.addMember(groupId, request);

        verify(accountGroupMapRepository).save(any(AccountGroupMap.class));
    }

    @Test
    void shouldRejectDuplicateMember() {
        UUID groupId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();

        Group group = createTestGroup(groupId, "ENGINEERS");
        when(groupRepository.findById(groupId)).thenReturn(Optional.of(group));

        Account account = new Account();
        account.setId(accountId);
        account.setTenantId(tenantId);
        when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

        AccountGroupMap existing = new AccountGroupMap();
        existing.setGroup(group);
        when(accountGroupMapRepository.findByAccountIdAndActive(accountId, true)).thenReturn(List.of(existing));

        GroupMemberRequest request = new GroupMemberRequest(accountId, "MANUAL", null, null);

        assertThatThrownBy(() -> groupService.addMember(groupId, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already a member");
    }

    @Test
    void shouldRemoveMember() {
        UUID groupId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();

        Group group = createTestGroup(groupId, "ENGINEERS");
        AccountGroupMap agm = new AccountGroupMap();
        agm.setGroup(group);
        agm.setActive(true);

        when(accountGroupMapRepository.findByAccountIdAndActive(accountId, true)).thenReturn(List.of(agm));
        when(accountGroupMapRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        groupService.removeMember(groupId, accountId);

        assertThat(agm.isActive()).isFalse();
        assertThat(agm.getRemovedAt()).isNotNull();
    }

    @Test
    void shouldThrowWhenRemovingNonMember() {
        UUID groupId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();

        when(accountGroupMapRepository.findByAccountIdAndActive(accountId, true)).thenReturn(Collections.emptyList());

        assertThatThrownBy(() -> groupService.removeMember(groupId, accountId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ---- Group-role mapping ----

    @Test
    void shouldAssignRoleToGroup() {
        UUID groupId = UUID.randomUUID();
        UUID roleId = UUID.randomUUID();

        Group group = createTestGroup(groupId, "ENGINEERS");
        when(groupRepository.findById(groupId)).thenReturn(Optional.of(group));

        Role role = new Role();
        role.setId(roleId);
        role.setTenantId(tenantId);
        when(roleRepository.findById(roleId)).thenReturn(Optional.of(role));
        when(groupRoleMapRepository.findByGroupIdAndActive(groupId, true)).thenReturn(Collections.emptyList());
        when(groupRoleMapRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        groupService.assignRoleToGroup(groupId, roleId);

        verify(groupRoleMapRepository).save(any(GroupRoleMap.class));
    }

    @Test
    void shouldRejectDuplicateGroupRoleMapping() {
        UUID groupId = UUID.randomUUID();
        UUID roleId = UUID.randomUUID();

        Group group = createTestGroup(groupId, "ENGINEERS");
        when(groupRepository.findById(groupId)).thenReturn(Optional.of(group));

        Role role = new Role();
        role.setId(roleId);
        role.setTenantId(tenantId);
        when(roleRepository.findById(roleId)).thenReturn(Optional.of(role));

        GroupRoleMap existing = new GroupRoleMap();
        existing.setRole(role);
        when(groupRoleMapRepository.findByGroupIdAndActive(groupId, true)).thenReturn(List.of(existing));

        assertThatThrownBy(() -> groupService.assignRoleToGroup(groupId, roleId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already assigned");
    }

    @Test
    void shouldRemoveRoleFromGroup() {
        UUID groupId = UUID.randomUUID();
        UUID roleId = UUID.randomUUID();

        Role role = new Role();
        role.setId(roleId);
        GroupRoleMap grm = new GroupRoleMap();
        grm.setRole(role);
        grm.setActive(true);

        when(groupRoleMapRepository.findByGroupIdAndActive(groupId, true)).thenReturn(List.of(grm));
        when(groupRoleMapRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        groupService.removeRoleFromGroup(groupId, roleId);

        assertThat(grm.isActive()).isFalse();
    }

    // ---- Helpers ----

    private Group createTestGroup(UUID groupId, String groupCode) {
        Group group = new Group();
        group.setId(groupId);
        group.setTenantId(tenantId);
        group.setGroupCode(groupCode);
        group.setGroupName(groupCode + " Group");
        group.setGroupType(GroupType.STATIC);
        group.setStatus(ActiveStatus.ACTIVE);
        return group;
    }
}
