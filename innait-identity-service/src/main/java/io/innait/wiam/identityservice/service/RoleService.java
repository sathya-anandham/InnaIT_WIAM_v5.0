package io.innait.wiam.identityservice.service;

import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.event.payload.AccountRoleAssignedPayload;
import io.innait.wiam.common.event.payload.AccountRoleRemovedPayload;
import io.innait.wiam.common.exception.ResourceNotFoundException;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.kafka.InnaITTopics;
import io.innait.wiam.identityservice.dto.*;
import io.innait.wiam.identityservice.entity.*;
import io.innait.wiam.identityservice.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class RoleService {

    private static final Logger log = LoggerFactory.getLogger(RoleService.class);

    private final RoleRepository roleRepository;
    private final AccountRepository accountRepository;
    private final AccountRoleMapRepository accountRoleMapRepository;
    private final AccountGroupMapRepository accountGroupMapRepository;
    private final GroupRoleMapRepository groupRoleMapRepository;
    private final RoleEntitlementMapRepository roleEntitlementMapRepository;
    private final EventPublisher eventPublisher;

    public RoleService(RoleRepository roleRepository,
                       AccountRepository accountRepository,
                       AccountRoleMapRepository accountRoleMapRepository,
                       AccountGroupMapRepository accountGroupMapRepository,
                       GroupRoleMapRepository groupRoleMapRepository,
                       RoleEntitlementMapRepository roleEntitlementMapRepository,
                       EventPublisher eventPublisher) {
        this.roleRepository = roleRepository;
        this.accountRepository = accountRepository;
        this.accountRoleMapRepository = accountRoleMapRepository;
        this.accountGroupMapRepository = accountGroupMapRepository;
        this.groupRoleMapRepository = groupRoleMapRepository;
        this.roleEntitlementMapRepository = roleEntitlementMapRepository;
        this.eventPublisher = eventPublisher;
    }

    public RoleResponse createRole(String roleCode, String roleName, String description,
                                   io.innait.wiam.common.constant.RoleType roleType, boolean system) {
        UUID tenantId = TenantContext.requireTenantId();

        roleRepository.findByTenantIdAndRoleCode(tenantId, roleCode)
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("Role code already exists: " + roleCode);
                });

        Role role = new Role();
        role.setRoleCode(roleCode);
        role.setRoleName(roleName);
        role.setDescription(description);
        role.setRoleType(roleType);
        role.setSystem(system);
        role.setStatus(ActiveStatus.ACTIVE);

        role = roleRepository.save(role);
        log.info("Created role [{}] code [{}] for tenant [{}]", role.getId(), roleCode, tenantId);
        return toRoleResponse(role);
    }

    @Transactional(readOnly = true)
    public RoleResponse getRoleById(UUID roleId) {
        return toRoleResponse(findRoleOrThrow(roleId));
    }

    @Transactional(readOnly = true)
    public Page<RoleResponse> listRoles(Pageable pageable) {
        UUID tenantId = TenantContext.requireTenantId();
        return roleRepository.findByTenantId(tenantId, pageable).map(this::toRoleResponse);
    }

    public RoleResponse updateRole(UUID roleId, String roleName, String description) {
        Role role = findRoleOrThrow(roleId);
        if (roleName != null) role.setRoleName(roleName);
        if (description != null) role.setDescription(description);
        role = roleRepository.save(role);
        log.info("Updated role [{}]", roleId);
        return toRoleResponse(role);
    }

    public void deactivateRole(UUID roleId) {
        Role role = findRoleOrThrow(roleId);
        if (role.isSystem()) {
            throw new IllegalStateException("Cannot deactivate a system role");
        }
        role.setStatus(ActiveStatus.INACTIVE);
        roleRepository.save(role);
        log.info("Deactivated role [{}]", roleId);
    }

    public RoleAssignmentResponse assignRoleToAccount(UUID accountId, RoleAssignmentRequest request) {
        UUID tenantId = TenantContext.requireTenantId();

        Account account = accountRepository.findById(accountId)
                .filter(a -> a.getTenantId().equals(tenantId))
                .orElseThrow(() -> new ResourceNotFoundException("Account", accountId.toString()));

        Role role = findRoleOrThrow(request.roleId());

        // Check for duplicate active assignment
        List<AccountRoleMap> existing = accountRoleMapRepository.findByAccountIdAndActive(accountId, true);
        boolean alreadyAssigned = existing.stream().anyMatch(arm -> arm.getRole().getId().equals(request.roleId()));
        if (alreadyAssigned) {
            throw new IllegalArgumentException("Role already assigned to this account");
        }

        AccountRoleMap arm = new AccountRoleMap();
        arm.setAccount(account);
        arm.setRole(role);
        arm.setAssignmentSource(MappingAssignmentSource.valueOf(request.assignmentSource()));
        arm.setActive(true);
        arm.setAssignedAt(Instant.now());
        arm = accountRoleMapRepository.save(arm);

        // Publish event
        var payload = new AccountRoleAssignedPayload(
                accountId, role.getId(), role.getRoleCode(),
                request.assignmentSource(), request.assignedBy(), request.reason()
        );
        var envelope = EventEnvelope.<AccountRoleAssignedPayload>builder()
                .eventType("account.role.assigned")
                .tenantId(tenantId)
                .actorId(request.assignedBy())
                .payload(payload)
                .build();
        eventPublisher.publish(InnaITTopics.ACCOUNT_ROLE_ASSIGNED, envelope);

        log.info("Assigned role [{}] to account [{}]", role.getRoleCode(), accountId);
        return toRoleAssignmentResponse(arm);
    }

    public void removeRoleFromAccount(UUID accountId, UUID roleId, RoleRemovalRequest request) {
        UUID tenantId = TenantContext.requireTenantId();

        List<AccountRoleMap> mappings = accountRoleMapRepository.findByAccountIdAndActive(accountId, true);
        AccountRoleMap arm = mappings.stream()
                .filter(m -> m.getRole().getId().equals(roleId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("AccountRoleMapping",
                        "accountId=" + accountId + ", roleId=" + roleId));

        arm.setActive(false);
        arm.setRemovedAt(Instant.now());
        accountRoleMapRepository.save(arm);

        // Publish event
        var payload = new AccountRoleRemovedPayload(
                accountId, roleId, arm.getRole().getRoleCode(),
                arm.getAssignmentSource().name(), request.removedBy(), request.reason()
        );
        var envelope = EventEnvelope.<AccountRoleRemovedPayload>builder()
                .eventType("account.role.removed")
                .tenantId(tenantId)
                .actorId(request.removedBy())
                .payload(payload)
                .build();
        eventPublisher.publish(InnaITTopics.ACCOUNT_ROLE_REMOVED, envelope);

        log.info("Removed role [{}] from account [{}]", roleId, accountId);
    }

    @Transactional(readOnly = true)
    public List<RoleAssignmentResponse> getAccountRoles(UUID accountId) {
        List<AccountRoleMap> mappings = accountRoleMapRepository.findByAccountIdAndActive(accountId, true);
        return mappings.stream().map(this::toRoleAssignmentResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<EffectiveEntitlementResponse> getEffectiveEntitlements(UUID accountId) {
        List<EffectiveEntitlementResponse> result = new ArrayList<>();
        Set<UUID> seenEntitlementIds = new HashSet<>();

        // 1. Direct roles → entitlements
        List<AccountRoleMap> directRoles = accountRoleMapRepository.findByAccountIdAndActive(accountId, true);
        for (AccountRoleMap arm : directRoles) {
            Role role = arm.getRole();
            List<RoleEntitlementMap> entitlements = roleEntitlementMapRepository.findByRoleIdAndActive(role.getId(), true);
            for (RoleEntitlementMap rem : entitlements) {
                Entitlement ent = rem.getEntitlement();
                if (seenEntitlementIds.add(ent.getId())) {
                    result.add(new EffectiveEntitlementResponse(
                            ent.getId(), ent.getEntitlementCode(), ent.getEntitlementName(),
                            ent.getEntitlementType().name(), role.getId(), role.getRoleCode(),
                            "direct:role:" + role.getRoleCode()
                    ));
                }
            }
        }

        // 2. Group → role → entitlements
        List<AccountGroupMap> groups = accountGroupMapRepository.findByAccountIdAndActive(accountId, true);
        for (AccountGroupMap agm : groups) {
            List<GroupRoleMap> groupRoles = groupRoleMapRepository.findByGroupIdAndActive(agm.getGroup().getId(), true);
            for (GroupRoleMap grm : groupRoles) {
                Role role = grm.getRole();
                List<RoleEntitlementMap> entitlements = roleEntitlementMapRepository.findByRoleIdAndActive(role.getId(), true);
                for (RoleEntitlementMap rem : entitlements) {
                    Entitlement ent = rem.getEntitlement();
                    if (seenEntitlementIds.add(ent.getId())) {
                        result.add(new EffectiveEntitlementResponse(
                                ent.getId(), ent.getEntitlementCode(), ent.getEntitlementName(),
                                ent.getEntitlementType().name(), role.getId(), role.getRoleCode(),
                                "group:" + agm.getGroup().getGroupCode() + ":role:" + role.getRoleCode()
                        ));
                    }
                }
            }
        }

        return result;
    }

    public void bulkAssignRole(UUID roleId, List<UUID> accountIds) {
        Role role = findRoleOrThrow(roleId);
        UUID tenantId = TenantContext.requireTenantId();

        for (UUID accountId : accountIds) {
            Account account = accountRepository.findById(accountId)
                    .filter(a -> a.getTenantId().equals(tenantId))
                    .orElse(null);
            if (account == null) continue;

            boolean alreadyAssigned = accountRoleMapRepository.findByAccountIdAndActive(accountId, true)
                    .stream().anyMatch(arm -> arm.getRole().getId().equals(roleId));
            if (alreadyAssigned) continue;

            AccountRoleMap arm = new AccountRoleMap();
            arm.setAccount(account);
            arm.setRole(role);
            arm.setAssignmentSource(MappingAssignmentSource.MANUAL);
            arm.setActive(true);
            arm.setAssignedAt(Instant.now());
            accountRoleMapRepository.save(arm);
        }

        log.info("Bulk assigned role [{}] to {} accounts", roleId, accountIds.size());
    }

    public void bulkRemoveRole(UUID roleId, List<UUID> accountIds) {
        for (UUID accountId : accountIds) {
            List<AccountRoleMap> mappings = accountRoleMapRepository.findByAccountIdAndActive(accountId, true);
            mappings.stream()
                    .filter(arm -> arm.getRole().getId().equals(roleId))
                    .findFirst()
                    .ifPresent(arm -> {
                        arm.setActive(false);
                        arm.setRemovedAt(Instant.now());
                        accountRoleMapRepository.save(arm);
                    });
        }

        log.info("Bulk removed role [{}] from {} accounts", roleId, accountIds.size());
    }

    private Role findRoleOrThrow(UUID roleId) {
        UUID tenantId = TenantContext.requireTenantId();
        return roleRepository.findById(roleId)
                .filter(r -> r.getTenantId().equals(tenantId))
                .orElseThrow(() -> new ResourceNotFoundException("Role", roleId.toString()));
    }

    private RoleResponse toRoleResponse(Role role) {
        return new RoleResponse(
                role.getId(), role.getTenantId(), role.getRoleCode(), role.getRoleName(),
                role.getDescription(), role.getRoleType(), role.isSystem(), role.getStatus(),
                role.getCreatedAt(), role.getUpdatedAt()
        );
    }

    private RoleAssignmentResponse toRoleAssignmentResponse(AccountRoleMap arm) {
        return new RoleAssignmentResponse(
                arm.getId(), arm.getAccount().getId(), arm.getRole().getId(),
                arm.getRole().getRoleCode(), arm.getRole().getRoleName(),
                arm.getAssignmentSource().name(), arm.isActive(),
                arm.getAssignedAt(), arm.getRemovedAt()
        );
    }
}
