package io.innait.wiam.identityservice.service;

import io.innait.wiam.common.constant.RoleType;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.kafka.InnaITTopics;
import io.innait.wiam.identityservice.dto.*;
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

import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RoleServiceTest {

    @Mock private RoleRepository roleRepository;
    @Mock private AccountRepository accountRepository;
    @Mock private AccountRoleMapRepository accountRoleMapRepository;
    @Mock private AccountGroupMapRepository accountGroupMapRepository;
    @Mock private GroupRoleMapRepository groupRoleMapRepository;
    @Mock private RoleEntitlementMapRepository roleEntitlementMapRepository;
    @Mock private EventPublisher eventPublisher;

    @InjectMocks
    private RoleService roleService;

    private final UUID tenantId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(tenantId);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    // ---- CRUD tests ----

    @Test
    void shouldCreateRole() {
        when(roleRepository.findByTenantIdAndRoleCode(tenantId, "ADMIN")).thenReturn(Optional.empty());
        when(roleRepository.save(any(Role.class))).thenAnswer(inv -> {
            Role r = inv.getArgument(0);
            r.setId(UUID.randomUUID());
            r.setTenantId(tenantId);
            return r;
        });

        RoleResponse response = roleService.createRole("ADMIN", "Administrator", "Admin role", RoleType.TENANT, false);

        assertThat(response.roleCode()).isEqualTo("ADMIN");
        assertThat(response.roleName()).isEqualTo("Administrator");
        assertThat(response.roleType()).isEqualTo(RoleType.TENANT);
        assertThat(response.status()).isEqualTo(ActiveStatus.ACTIVE);
    }

    @Test
    void shouldRejectDuplicateRoleCode() {
        when(roleRepository.findByTenantIdAndRoleCode(tenantId, "ADMIN")).thenReturn(Optional.of(new Role()));

        assertThatThrownBy(() -> roleService.createRole("ADMIN", "Admin", null, RoleType.TENANT, false))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Role code already exists");
    }

    @Test
    void shouldGetRoleById() {
        UUID roleId = UUID.randomUUID();
        Role role = createTestRole(roleId, "VIEWER");
        when(roleRepository.findById(roleId)).thenReturn(Optional.of(role));

        RoleResponse response = roleService.getRoleById(roleId);

        assertThat(response.roleCode()).isEqualTo("VIEWER");
    }

    @Test
    void shouldListRoles() {
        Role role = createTestRole(UUID.randomUUID(), "ADMIN");
        when(roleRepository.findByTenantId(tenantId, PageRequest.of(0, 10)))
                .thenReturn(new PageImpl<>(List.of(role)));

        Page<RoleResponse> result = roleService.listRoles(PageRequest.of(0, 10));

        assertThat(result.getTotalElements()).isEqualTo(1);
    }

    @Test
    void shouldUpdateRole() {
        UUID roleId = UUID.randomUUID();
        Role role = createTestRole(roleId, "ADMIN");
        when(roleRepository.findById(roleId)).thenReturn(Optional.of(role));
        when(roleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        RoleResponse response = roleService.updateRole(roleId, "Super Admin", "Updated description");

        assertThat(response.roleName()).isEqualTo("Super Admin");
        assertThat(response.description()).isEqualTo("Updated description");
    }

    @Test
    void shouldDeactivateNonSystemRole() {
        UUID roleId = UUID.randomUUID();
        Role role = createTestRole(roleId, "CUSTOM");
        role.setSystem(false);
        when(roleRepository.findById(roleId)).thenReturn(Optional.of(role));
        when(roleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        roleService.deactivateRole(roleId);

        assertThat(role.getStatus()).isEqualTo(ActiveStatus.INACTIVE);
    }

    @Test
    void shouldRejectDeactivateSystemRole() {
        UUID roleId = UUID.randomUUID();
        Role role = createTestRole(roleId, "SYSTEM");
        role.setSystem(true);
        when(roleRepository.findById(roleId)).thenReturn(Optional.of(role));

        assertThatThrownBy(() -> roleService.deactivateRole(roleId))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("system role");
    }

    // ---- Assignment tests ----

    @Test
    void shouldAssignRoleToAccount() {
        UUID accountId = UUID.randomUUID();
        UUID roleId = UUID.randomUUID();

        Account account = new Account();
        account.setId(accountId);
        account.setTenantId(tenantId);
        when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

        Role role = createTestRole(roleId, "ADMIN");
        when(roleRepository.findById(roleId)).thenReturn(Optional.of(role));
        when(accountRoleMapRepository.findByAccountIdAndActive(accountId, true)).thenReturn(Collections.emptyList());
        when(accountRoleMapRepository.save(any(AccountRoleMap.class))).thenAnswer(inv -> {
            AccountRoleMap arm = inv.getArgument(0);
            arm.setId(UUID.randomUUID());
            return arm;
        });
        when(eventPublisher.publish(anyString(), any())).thenReturn(CompletableFuture.completedFuture(null));

        RoleAssignmentRequest request = new RoleAssignmentRequest(roleId, "MANUAL", null, "Initial setup", null);
        RoleAssignmentResponse response = roleService.assignRoleToAccount(accountId, request);

        assertThat(response.roleCode()).isEqualTo("ADMIN");
        assertThat(response.active()).isTrue();
        verify(eventPublisher).publish(eq(InnaITTopics.ACCOUNT_ROLE_ASSIGNED), any(EventEnvelope.class));
    }

    @Test
    void shouldRejectDuplicateRoleAssignment() {
        UUID accountId = UUID.randomUUID();
        UUID roleId = UUID.randomUUID();

        Account account = new Account();
        account.setId(accountId);
        account.setTenantId(tenantId);
        when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

        Role role = createTestRole(roleId, "ADMIN");
        when(roleRepository.findById(roleId)).thenReturn(Optional.of(role));

        AccountRoleMap existing = new AccountRoleMap();
        existing.setRole(role);
        when(accountRoleMapRepository.findByAccountIdAndActive(accountId, true)).thenReturn(List.of(existing));

        RoleAssignmentRequest request = new RoleAssignmentRequest(roleId, "MANUAL", null, null, null);

        assertThatThrownBy(() -> roleService.assignRoleToAccount(accountId, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already assigned");
    }

    @Test
    void shouldRemoveRoleFromAccount() {
        UUID accountId = UUID.randomUUID();
        UUID roleId = UUID.randomUUID();

        Role role = createTestRole(roleId, "VIEWER");
        AccountRoleMap arm = new AccountRoleMap();
        arm.setRole(role);
        arm.setActive(true);
        arm.setAssignmentSource(MappingAssignmentSource.MANUAL);

        when(accountRoleMapRepository.findByAccountIdAndActive(accountId, true)).thenReturn(List.of(arm));
        when(accountRoleMapRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(eventPublisher.publish(anyString(), any())).thenReturn(CompletableFuture.completedFuture(null));

        RoleRemovalRequest request = new RoleRemovalRequest(UUID.randomUUID(), "No longer needed", "ADMIN");
        roleService.removeRoleFromAccount(accountId, roleId, request);

        assertThat(arm.isActive()).isFalse();
        assertThat(arm.getRemovedAt()).isNotNull();
        verify(eventPublisher).publish(eq(InnaITTopics.ACCOUNT_ROLE_REMOVED), any(EventEnvelope.class));
    }

    @Test
    void shouldGetAccountRoles() {
        UUID accountId = UUID.randomUUID();
        Role role = createTestRole(UUID.randomUUID(), "ADMIN");
        AccountRoleMap arm = new AccountRoleMap();
        arm.setId(UUID.randomUUID());
        arm.setAccount(new Account());
        arm.getAccount().setId(accountId);
        arm.setRole(role);
        arm.setAssignmentSource(MappingAssignmentSource.MANUAL);
        arm.setActive(true);
        arm.setAssignedAt(Instant.now());

        when(accountRoleMapRepository.findByAccountIdAndActive(accountId, true)).thenReturn(List.of(arm));

        List<RoleAssignmentResponse> result = roleService.getAccountRoles(accountId);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).roleCode()).isEqualTo("ADMIN");
    }

    // ---- Effective entitlements ----

    @Test
    void shouldResolveEffectiveEntitlementsFromDirectRoles() {
        UUID accountId = UUID.randomUUID();
        UUID roleId = UUID.randomUUID();

        Role role = createTestRole(roleId, "ADMIN");
        AccountRoleMap arm = new AccountRoleMap();
        arm.setRole(role);

        Entitlement ent = new Entitlement();
        ent.setId(UUID.randomUUID());
        ent.setEntitlementCode("USER_READ");
        ent.setEntitlementName("Read Users");
        ent.setEntitlementType(EntitlementType.APP_PERMISSION);

        RoleEntitlementMap rem = new RoleEntitlementMap();
        rem.setEntitlement(ent);

        when(accountRoleMapRepository.findByAccountIdAndActive(accountId, true)).thenReturn(List.of(arm));
        when(roleEntitlementMapRepository.findByRoleIdAndActive(roleId, true)).thenReturn(List.of(rem));
        when(accountGroupMapRepository.findByAccountIdAndActive(accountId, true)).thenReturn(Collections.emptyList());

        List<EffectiveEntitlementResponse> result = roleService.getEffectiveEntitlements(accountId);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).entitlementCode()).isEqualTo("USER_READ");
        assertThat(result.get(0).resolutionPath()).startsWith("direct:role:");
    }

    @Test
    void shouldResolveEffectiveEntitlementsFromGroupChain() {
        UUID accountId = UUID.randomUUID();
        UUID groupId = UUID.randomUUID();
        UUID roleId = UUID.randomUUID();

        // No direct roles
        when(accountRoleMapRepository.findByAccountIdAndActive(accountId, true)).thenReturn(Collections.emptyList());

        // Group membership
        Group group = new Group();
        group.setId(groupId);
        group.setGroupCode("ENGINEERS");
        AccountGroupMap agm = new AccountGroupMap();
        agm.setGroup(group);

        when(accountGroupMapRepository.findByAccountIdAndActive(accountId, true)).thenReturn(List.of(agm));

        // Group → role
        Role role = createTestRole(roleId, "ENG_ROLE");
        GroupRoleMap grm = new GroupRoleMap();
        grm.setRole(role);
        when(groupRoleMapRepository.findByGroupIdAndActive(groupId, true)).thenReturn(List.of(grm));

        // Role → entitlement
        Entitlement ent = new Entitlement();
        ent.setId(UUID.randomUUID());
        ent.setEntitlementCode("CODE_DEPLOY");
        ent.setEntitlementName("Deploy Code");
        ent.setEntitlementType(EntitlementType.APP_PERMISSION);

        RoleEntitlementMap rem = new RoleEntitlementMap();
        rem.setEntitlement(ent);
        when(roleEntitlementMapRepository.findByRoleIdAndActive(roleId, true)).thenReturn(List.of(rem));

        List<EffectiveEntitlementResponse> result = roleService.getEffectiveEntitlements(accountId);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).entitlementCode()).isEqualTo("CODE_DEPLOY");
        assertThat(result.get(0).resolutionPath()).isEqualTo("group:ENGINEERS:role:ENG_ROLE");
    }

    @Test
    void shouldDeduplicateEntitlements() {
        UUID accountId = UUID.randomUUID();
        UUID roleId = UUID.randomUUID();
        UUID entitlementId = UUID.randomUUID();

        // Same entitlement from direct role
        Role role = createTestRole(roleId, "ADMIN");
        AccountRoleMap arm = new AccountRoleMap();
        arm.setRole(role);

        Entitlement ent = new Entitlement();
        ent.setId(entitlementId);
        ent.setEntitlementCode("USER_READ");
        ent.setEntitlementName("Read Users");
        ent.setEntitlementType(EntitlementType.APP_PERMISSION);

        RoleEntitlementMap rem = new RoleEntitlementMap();
        rem.setEntitlement(ent);

        when(accountRoleMapRepository.findByAccountIdAndActive(accountId, true)).thenReturn(List.of(arm));
        when(roleEntitlementMapRepository.findByRoleIdAndActive(roleId, true)).thenReturn(List.of(rem));

        // Same entitlement from group chain
        UUID groupId = UUID.randomUUID();
        Group group = new Group();
        group.setId(groupId);
        group.setGroupCode("ALL_USERS");
        AccountGroupMap agm = new AccountGroupMap();
        agm.setGroup(group);
        when(accountGroupMapRepository.findByAccountIdAndActive(accountId, true)).thenReturn(List.of(agm));

        Role groupRole = createTestRole(UUID.randomUUID(), "BASE_ROLE");
        GroupRoleMap grm = new GroupRoleMap();
        grm.setRole(groupRole);
        when(groupRoleMapRepository.findByGroupIdAndActive(groupId, true)).thenReturn(List.of(grm));

        RoleEntitlementMap rem2 = new RoleEntitlementMap();
        rem2.setEntitlement(ent); // Same entitlement
        when(roleEntitlementMapRepository.findByRoleIdAndActive(groupRole.getId(), true)).thenReturn(List.of(rem2));

        List<EffectiveEntitlementResponse> result = roleService.getEffectiveEntitlements(accountId);

        // Should only appear once (from direct role, which is resolved first)
        assertThat(result).hasSize(1);
        assertThat(result.get(0).resolutionPath()).startsWith("direct:role:");
    }

    // ---- Bulk operations ----

    @Test
    void shouldBulkAssignRole() {
        UUID roleId = UUID.randomUUID();
        UUID accountId1 = UUID.randomUUID();
        UUID accountId2 = UUID.randomUUID();

        Role role = createTestRole(roleId, "BULK_ROLE");
        when(roleRepository.findById(roleId)).thenReturn(Optional.of(role));

        Account account1 = new Account();
        account1.setId(accountId1);
        account1.setTenantId(tenantId);
        Account account2 = new Account();
        account2.setId(accountId2);
        account2.setTenantId(tenantId);

        when(accountRepository.findById(accountId1)).thenReturn(Optional.of(account1));
        when(accountRepository.findById(accountId2)).thenReturn(Optional.of(account2));
        when(accountRoleMapRepository.findByAccountIdAndActive(any(), eq(true))).thenReturn(Collections.emptyList());
        when(accountRoleMapRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        roleService.bulkAssignRole(roleId, List.of(accountId1, accountId2));

        verify(accountRoleMapRepository, times(2)).save(any(AccountRoleMap.class));
    }

    @Test
    void shouldSkipAlreadyAssignedInBulk() {
        UUID roleId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();

        Role role = createTestRole(roleId, "ROLE");
        when(roleRepository.findById(roleId)).thenReturn(Optional.of(role));

        Account account = new Account();
        account.setId(accountId);
        account.setTenantId(tenantId);
        when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

        AccountRoleMap existing = new AccountRoleMap();
        existing.setRole(role);
        when(accountRoleMapRepository.findByAccountIdAndActive(accountId, true)).thenReturn(List.of(existing));

        roleService.bulkAssignRole(roleId, List.of(accountId));

        verify(accountRoleMapRepository, never()).save(any(AccountRoleMap.class));
    }

    // ---- Helpers ----

    private Role createTestRole(UUID roleId, String roleCode) {
        Role role = new Role();
        role.setId(roleId);
        role.setTenantId(tenantId);
        role.setRoleCode(roleCode);
        role.setRoleName(roleCode + " Role");
        role.setRoleType(RoleType.TENANT);
        role.setStatus(ActiveStatus.ACTIVE);
        return role;
    }
}
