package io.innait.wiam.identityservice.service;

import io.innait.wiam.common.constant.AccountStatus;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.event.payload.AccountTerminatedPayload;
import io.innait.wiam.common.event.payload.UserCreatedPayload;
import io.innait.wiam.common.event.payload.UserUpdatedPayload;
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

@Service
@Transactional
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private static final Map<AccountStatus, Set<AccountStatus>> VALID_TRANSITIONS;

    static {
        Map<AccountStatus, Set<AccountStatus>> map = new EnumMap<>(AccountStatus.class);
        map.put(AccountStatus.PENDING_ACTIVATION, EnumSet.of(AccountStatus.ACTIVE, AccountStatus.DEPROVISIONED));
        map.put(AccountStatus.ACTIVE, EnumSet.of(AccountStatus.SUSPENDED, AccountStatus.LOCKED, AccountStatus.INACTIVE, AccountStatus.DEPROVISIONED));
        map.put(AccountStatus.SUSPENDED, EnumSet.of(AccountStatus.ACTIVE, AccountStatus.DEPROVISIONED));
        map.put(AccountStatus.LOCKED, EnumSet.of(AccountStatus.ACTIVE, AccountStatus.DEPROVISIONED));
        map.put(AccountStatus.INACTIVE, EnumSet.of(AccountStatus.ACTIVE, AccountStatus.DEPROVISIONED));
        map.put(AccountStatus.EXPIRED, EnumSet.of(AccountStatus.ACTIVE, AccountStatus.DEPROVISIONED));
        map.put(AccountStatus.DEPROVISIONED, EnumSet.noneOf(AccountStatus.class));
        VALID_TRANSITIONS = Collections.unmodifiableMap(map);
    }

    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final AccountRoleMapRepository accountRoleMapRepository;
    private final AccountGroupMapRepository accountGroupMapRepository;
    private final RoleRepository roleRepository;
    private final GroupRepository groupRepository;
    private final EventPublisher eventPublisher;

    public UserService(UserRepository userRepository,
                       AccountRepository accountRepository,
                       AccountRoleMapRepository accountRoleMapRepository,
                       AccountGroupMapRepository accountGroupMapRepository,
                       RoleRepository roleRepository,
                       GroupRepository groupRepository,
                       EventPublisher eventPublisher) {
        this.userRepository = userRepository;
        this.accountRepository = accountRepository;
        this.accountRoleMapRepository = accountRoleMapRepository;
        this.accountGroupMapRepository = accountGroupMapRepository;
        this.roleRepository = roleRepository;
        this.groupRepository = groupRepository;
        this.eventPublisher = eventPublisher;
    }

    public UserResponse createUser(CreateUserRequest request) {
        UUID tenantId = TenantContext.requireTenantId();

        // Validate email uniqueness per tenant
        userRepository.findByTenantIdAndEmail(tenantId, request.email())
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("Email already exists for this tenant: " + request.email());
                });

        // Validate employeeNo uniqueness per tenant if provided
        if (request.employeeNo() != null && !request.employeeNo().isBlank()) {
            userRepository.findByTenantIdAndEmployeeNo(tenantId, request.employeeNo())
                    .ifPresent(existing -> {
                        throw new IllegalArgumentException("Employee number already exists for this tenant: " + request.employeeNo());
                    });
        }

        // Create User entity
        User user = new User();
        user.setFirstName(request.firstName());
        user.setLastName(request.lastName());
        user.setDisplayName(request.displayName() != null ? request.displayName()
                : request.firstName() + " " + request.lastName());
        user.setEmail(request.email());
        user.setEmployeeNo(request.employeeNo());
        user.setPhoneCountryCode(request.phoneCountryCode());
        user.setPhoneNumber(request.phoneNumber());
        user.setDepartment(request.department());
        user.setDesignation(request.designation());
        user.setManagerUserId(request.managerUserId());
        user.setOrgUnitId(request.orgUnitId());
        user.setUserType(request.userType());
        user.setStatus(UserStatus.ACTIVE);
        user.setLocale(request.locale());
        user.setTimezone(request.timezone());

        user = userRepository.save(user);

        // Auto-create Account with loginId = email
        Account account = new Account();
        account.setUser(user);
        account.setLoginId(request.email());
        account.setAccountStatus(request.passwordEnabled()
                ? AccountStatus.PENDING_ACTIVATION : AccountStatus.ACTIVE);
        account.setPasswordEnabled(request.passwordEnabled());
        account.setMustChangePassword(request.passwordEnabled());
        account = accountRepository.save(account);

        // Assign default roles
        if (request.defaultRoleIds() != null) {
            for (UUID roleId : request.defaultRoleIds()) {
                assignDefaultRole(account, roleId);
            }
        }

        // Assign default groups
        if (request.defaultGroupIds() != null) {
            for (UUID groupId : request.defaultGroupIds()) {
                assignDefaultGroup(account, groupId);
            }
        }

        // Publish user.created event
        publishUserCreatedEvent(user, request.creationMethod());

        log.info("Created user [{}] with account [{}] for tenant [{}]",
                user.getId(), account.getId(), tenantId);

        return toUserResponse(user);
    }

    @Transactional(readOnly = true)
    public UserResponse getUserById(UUID userId) {
        UUID tenantId = TenantContext.requireTenantId();
        User user = userRepository.findById(userId)
                .filter(u -> u.getTenantId().equals(tenantId))
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));
        return toUserResponse(user);
    }

    @Transactional(readOnly = true)
    public Page<UserResponse> searchUsers(UserSearchCriteria criteria, Pageable pageable) {
        UUID tenantId = TenantContext.requireTenantId();
        Page<User> users = userRepository.search(
                tenantId,
                criteria.displayName(),
                criteria.email(),
                criteria.status(),
                criteria.department(),
                pageable
        );
        return users.map(this::toUserResponse);
    }

    public UserResponse updateUser(UUID userId, UpdateUserRequest request) {
        UUID tenantId = TenantContext.requireTenantId();
        User user = userRepository.findById(userId)
                .filter(u -> u.getTenantId().equals(tenantId))
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));

        List<String> changedFields = new ArrayList<>();
        Map<String, Object> oldValues = new LinkedHashMap<>();
        Map<String, Object> newValues = new LinkedHashMap<>();

        trackAndUpdate(user, request, changedFields, oldValues, newValues);

        if (!changedFields.isEmpty()) {
            user = userRepository.save(user);

            // Publish user.updated event
            publishUserUpdatedEvent(user, changedFields, oldValues, newValues);

            log.info("Updated user [{}] fields: {}", userId, changedFields);
        }

        return toUserResponse(user);
    }

    // ---- Account Status State Machine ----

    public void activateAccount(UUID accountId) {
        Account account = findAccountOrThrow(accountId);
        validateAndTransition(account, AccountStatus.ACTIVE);
        account.setFailedAttemptCount(0);
        accountRepository.save(account);
        publishStatusChangedEvent(account);
        log.info("Activated account [{}]", accountId);
    }

    public void suspendAccount(UUID accountId, String reason) {
        Account account = findAccountOrThrow(accountId);
        validateAndTransition(account, AccountStatus.SUSPENDED);
        accountRepository.save(account);
        publishStatusChangedEvent(account);
        log.info("Suspended account [{}] reason: {}", accountId, reason);
    }

    public void reactivateAccount(UUID accountId) {
        Account account = findAccountOrThrow(accountId);
        validateAndTransition(account, AccountStatus.ACTIVE);
        accountRepository.save(account);
        publishStatusChangedEvent(account);
        log.info("Reactivated account [{}]", accountId);
    }

    public void lockAccount(UUID accountId) {
        Account account = findAccountOrThrow(accountId);
        validateAndTransition(account, AccountStatus.LOCKED);
        accountRepository.save(account);
        publishStatusChangedEvent(account);
        log.info("Locked account [{}]", accountId);
    }

    public void unlockAccount(UUID accountId) {
        Account account = findAccountOrThrow(accountId);
        validateAndTransition(account, AccountStatus.ACTIVE);
        account.setFailedAttemptCount(0);
        account.setLockedUntil(null);
        accountRepository.save(account);
        publishStatusChangedEvent(account);
        log.info("Unlocked account [{}]", accountId);
    }

    public void disableAccount(UUID accountId) {
        Account account = findAccountOrThrow(accountId);
        validateAndTransition(account, AccountStatus.INACTIVE);
        accountRepository.save(account);
        publishStatusChangedEvent(account);
        log.info("Disabled account [{}]", accountId);
    }

    public void reenableAccount(UUID accountId) {
        Account account = findAccountOrThrow(accountId);
        validateAndTransition(account, AccountStatus.ACTIVE);
        accountRepository.save(account);
        publishStatusChangedEvent(account);
        log.info("Re-enabled account [{}]", accountId);
    }

    public void terminateAccount(UUID accountId, String reason) {
        Account account = findAccountOrThrow(accountId);
        AccountStatus previousStatus = account.getAccountStatus();

        // DEPROVISIONED is terminal — only block if already deprovisioned
        if (previousStatus == AccountStatus.DEPROVISIONED) {
            throw new IllegalStateException(
                    "Account is already terminated (DEPROVISIONED)");
        }

        account.setAccountStatus(AccountStatus.DEPROVISIONED);

        // Cascade: remove all role assignments
        List<AccountRoleMap> activeRoles = accountRoleMapRepository.findByAccountIdAndActive(accountId, true);
        int rolesRemoved = activeRoles.size();
        for (AccountRoleMap arm : activeRoles) {
            arm.setActive(false);
            arm.setRemovedAt(Instant.now());
        }
        accountRoleMapRepository.saveAll(activeRoles);

        // Cascade: remove all group memberships
        List<AccountGroupMap> activeGroups = accountGroupMapRepository.findByAccountIdAndActive(accountId, true);
        for (AccountGroupMap agm : activeGroups) {
            agm.setActive(false);
            agm.setRemovedAt(Instant.now());
        }
        accountGroupMapRepository.saveAll(activeGroups);

        accountRepository.save(account);

        // Publish account.terminated event with cascade summary
        publishAccountTerminatedEvent(account, rolesRemoved);

        log.info("Terminated account [{}] reason: {}, roles removed: {}, groups removed: {}",
                accountId, reason, rolesRemoved, activeGroups.size());
    }

    public void softDeleteUser(UUID userId) {
        UUID tenantId = TenantContext.requireTenantId();
        User user = userRepository.findById(userId)
                .filter(u -> u.getTenantId().equals(tenantId))
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));

        // Terminate all accounts first
        List<Account> accounts = accountRepository.findByUserId(userId);
        for (Account account : accounts) {
            if (account.getAccountStatus() != AccountStatus.DEPROVISIONED) {
                terminateAccount(account.getId(), "User soft-deleted");
            }
        }

        user.softDelete();
        userRepository.save(user);
        log.info("Soft-deleted user [{}]", userId);
    }

    public void restoreUser(UUID userId) {
        UUID tenantId = TenantContext.requireTenantId();
        // Use native query or direct find since soft-deleted users are filtered by @SQLRestriction
        User user = userRepository.findByTenantIdAndDeletedAndDeletedAtBefore(
                        tenantId, true, Instant.now().plusSeconds(1))
                .stream()
                .filter(u -> u.getId().equals(userId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));

        user.restore();
        userRepository.save(user);
        log.info("Restored user [{}]", userId);
    }

    // ---- Private helpers ----

    void validateAndTransition(Account account, AccountStatus targetStatus) {
        AccountStatus currentStatus = account.getAccountStatus();
        Set<AccountStatus> allowed = VALID_TRANSITIONS.getOrDefault(currentStatus, EnumSet.noneOf(AccountStatus.class));
        if (!allowed.contains(targetStatus)) {
            throw new IllegalStateException(String.format(
                    "Invalid account status transition: %s → %s", currentStatus, targetStatus));
        }
        account.setAccountStatus(targetStatus);
    }

    private Account findAccountOrThrow(UUID accountId) {
        UUID tenantId = TenantContext.requireTenantId();
        return accountRepository.findById(accountId)
                .filter(a -> a.getTenantId().equals(tenantId))
                .orElseThrow(() -> new ResourceNotFoundException("Account", accountId.toString()));
    }

    private void assignDefaultRole(Account account, UUID roleId) {
        roleRepository.findById(roleId).ifPresent(role -> {
            AccountRoleMap arm = new AccountRoleMap();
            arm.setAccount(account);
            arm.setRole(role);
            arm.setAssignmentSource(MappingAssignmentSource.POLICY);
            arm.setActive(true);
            arm.setAssignedAt(Instant.now());
            accountRoleMapRepository.save(arm);
        });
    }

    private void assignDefaultGroup(Account account, UUID groupId) {
        groupRepository.findById(groupId).ifPresent(group -> {
            AccountGroupMap agm = new AccountGroupMap();
            agm.setAccount(account);
            agm.setGroup(group);
            agm.setAssignmentSource(MappingAssignmentSource.POLICY);
            agm.setActive(true);
            agm.setAssignedAt(Instant.now());
            accountGroupMapRepository.save(agm);
        });
    }

    private void trackAndUpdate(User user, UpdateUserRequest request,
                                List<String> changedFields,
                                Map<String, Object> oldValues,
                                Map<String, Object> newValues) {
        if (request.firstName() != null && !request.firstName().equals(user.getFirstName())) {
            changedFields.add("firstName");
            oldValues.put("firstName", user.getFirstName());
            newValues.put("firstName", request.firstName());
            user.setFirstName(request.firstName());
        }
        if (request.lastName() != null && !request.lastName().equals(user.getLastName())) {
            changedFields.add("lastName");
            oldValues.put("lastName", user.getLastName());
            newValues.put("lastName", request.lastName());
            user.setLastName(request.lastName());
        }
        if (request.displayName() != null && !request.displayName().equals(user.getDisplayName())) {
            changedFields.add("displayName");
            oldValues.put("displayName", user.getDisplayName());
            newValues.put("displayName", request.displayName());
            user.setDisplayName(request.displayName());
        }
        if (request.email() != null && !request.email().equals(user.getEmail())) {
            changedFields.add("email");
            oldValues.put("email", user.getEmail());
            newValues.put("email", request.email());
            user.setEmail(request.email());
        }
        if (request.employeeNo() != null && !request.employeeNo().equals(user.getEmployeeNo())) {
            changedFields.add("employeeNo");
            oldValues.put("employeeNo", user.getEmployeeNo());
            newValues.put("employeeNo", request.employeeNo());
            user.setEmployeeNo(request.employeeNo());
        }
        if (request.phoneCountryCode() != null && !request.phoneCountryCode().equals(user.getPhoneCountryCode())) {
            changedFields.add("phoneCountryCode");
            oldValues.put("phoneCountryCode", user.getPhoneCountryCode());
            newValues.put("phoneCountryCode", request.phoneCountryCode());
            user.setPhoneCountryCode(request.phoneCountryCode());
        }
        if (request.phoneNumber() != null && !request.phoneNumber().equals(user.getPhoneNumber())) {
            changedFields.add("phoneNumber");
            oldValues.put("phoneNumber", user.getPhoneNumber());
            newValues.put("phoneNumber", request.phoneNumber());
            user.setPhoneNumber(request.phoneNumber());
        }
        if (request.department() != null && !request.department().equals(user.getDepartment())) {
            changedFields.add("department");
            oldValues.put("department", user.getDepartment());
            newValues.put("department", request.department());
            user.setDepartment(request.department());
        }
        if (request.designation() != null && !request.designation().equals(user.getDesignation())) {
            changedFields.add("designation");
            oldValues.put("designation", user.getDesignation());
            newValues.put("designation", request.designation());
            user.setDesignation(request.designation());
        }
        if (request.managerUserId() != null && !request.managerUserId().equals(user.getManagerUserId())) {
            changedFields.add("managerUserId");
            oldValues.put("managerUserId", user.getManagerUserId());
            newValues.put("managerUserId", request.managerUserId());
            user.setManagerUserId(request.managerUserId());
        }
        if (request.orgUnitId() != null && !request.orgUnitId().equals(user.getOrgUnitId())) {
            changedFields.add("orgUnitId");
            oldValues.put("orgUnitId", user.getOrgUnitId());
            newValues.put("orgUnitId", request.orgUnitId());
            user.setOrgUnitId(request.orgUnitId());
        }
        if (request.locale() != null && !request.locale().equals(user.getLocale())) {
            changedFields.add("locale");
            oldValues.put("locale", user.getLocale());
            newValues.put("locale", request.locale());
            user.setLocale(request.locale());
        }
        if (request.timezone() != null && !request.timezone().equals(user.getTimezone())) {
            changedFields.add("timezone");
            oldValues.put("timezone", user.getTimezone());
            newValues.put("timezone", request.timezone());
            user.setTimezone(request.timezone());
        }
    }

    private void publishUserCreatedEvent(User user, String creationMethod) {
        UUID tenantId = TenantContext.requireTenantId();
        var payload = new UserCreatedPayload(
                user.getId(), tenantId, user.getUserType().name(),
                user.getDepartment(), user.getDesignation(),
                user.getOrgUnitId(), user.getManagerUserId(),
                user.getEmail(), user.getCreatedBy(),
                creationMethod != null ? creationMethod : "MANUAL"
        );
        var envelope = EventEnvelope.<UserCreatedPayload>builder()
                .eventType("user.created")
                .tenantId(tenantId)
                .actorId(user.getCreatedBy())
                .payload(payload)
                .build();
        eventPublisher.publish(InnaITTopics.USER_CREATED, envelope);
    }

    private void publishUserUpdatedEvent(User user, List<String> changedFields,
                                         Map<String, Object> oldValues,
                                         Map<String, Object> newValues) {
        UUID tenantId = TenantContext.requireTenantId();
        var payload = new UserUpdatedPayload(
                user.getId(), changedFields, oldValues, newValues, user.getUpdatedBy()
        );
        var envelope = EventEnvelope.<UserUpdatedPayload>builder()
                .eventType("user.updated")
                .tenantId(tenantId)
                .actorId(user.getUpdatedBy())
                .payload(payload)
                .build();
        eventPublisher.publish(InnaITTopics.USER_UPDATED, envelope);
    }

    private void publishStatusChangedEvent(Account account) {
        UUID tenantId = TenantContext.requireTenantId();
        var envelope = EventEnvelope.<Map<String, Object>>builder()
                .eventType("account.status.changed")
                .tenantId(tenantId)
                .payload(Map.of(
                        "account_id", account.getId(),
                        "new_status", account.getAccountStatus().name()
                ))
                .build();
        eventPublisher.publish(InnaITTopics.ACCOUNT_STATUS_CHANGED, envelope);
    }

    private void publishAccountTerminatedEvent(Account account, int rolesRemoved) {
        UUID tenantId = TenantContext.requireTenantId();
        var payload = new AccountTerminatedPayload(
                account.getId(),
                account.getUser().getId(),
                account.getUpdatedBy(),
                new AccountTerminatedPayload.CascadeSummary(0, 0, rolesRemoved)
        );
        var envelope = EventEnvelope.<AccountTerminatedPayload>builder()
                .eventType("account.terminated")
                .tenantId(tenantId)
                .payload(payload)
                .build();
        eventPublisher.publish(InnaITTopics.ACCOUNT_TERMINATED, envelope);
    }

    UserResponse toUserResponse(User user) {
        List<UserResponse.AccountSummary> accountSummaries = new ArrayList<>();
        if (user.getAccounts() != null) {
            for (Account acc : user.getAccounts()) {
                accountSummaries.add(new UserResponse.AccountSummary(
                        acc.getId(), acc.getLoginId(), acc.getAccountStatus().name()));
            }
        }
        return new UserResponse(
                user.getId(),
                user.getTenantId(),
                user.getEmployeeNo(),
                user.getFirstName(),
                user.getLastName(),
                user.getDisplayName(),
                user.getEmail(),
                user.getPhoneCountryCode(),
                user.getPhoneNumber(),
                user.getDepartment(),
                user.getDesignation(),
                user.getManagerUserId(),
                user.getOrgUnitId(),
                user.getUserType(),
                user.getStatus(),
                user.getLocale(),
                user.getTimezone(),
                accountSummaries,
                user.getCreatedAt(),
                user.getUpdatedAt()
        );
    }
}
