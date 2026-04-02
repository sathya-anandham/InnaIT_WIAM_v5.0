package io.innait.wiam.identityservice.service;

import io.innait.wiam.common.constant.AccountStatus;
import io.innait.wiam.common.constant.UserType;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.exception.ResourceNotFoundException;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.kafka.InnaITTopics;
import io.innait.wiam.identityservice.dto.CreateUserRequest;
import io.innait.wiam.identityservice.dto.UpdateUserRequest;
import io.innait.wiam.identityservice.dto.UserResponse;
import io.innait.wiam.identityservice.dto.UserSearchCriteria;
import io.innait.wiam.identityservice.entity.*;
import io.innait.wiam.identityservice.repository.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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
class UserServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private AccountRepository accountRepository;
    @Mock private AccountRoleMapRepository accountRoleMapRepository;
    @Mock private AccountGroupMapRepository accountGroupMapRepository;
    @Mock private RoleRepository roleRepository;
    @Mock private GroupRepository groupRepository;
    @Mock private EventPublisher eventPublisher;

    @InjectMocks
    private UserService userService;

    private final UUID tenantId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(tenantId);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    // ---- createUser tests ----

    @Nested
    class CreateUser {

        @Test
        void shouldCreateUserWithAccountAndPublishEvent() {
            CreateUserRequest request = new CreateUserRequest(
                    "John", "Doe", null, "john@innait.io", "EMP-001",
                    null, null, "Engineering", "Developer", null, null,
                    UserType.EMPLOYEE, null, null, true, "MANUAL", null, null
            );

            when(userRepository.findByTenantIdAndEmail(tenantId, "john@innait.io")).thenReturn(Optional.empty());
            when(userRepository.findByTenantIdAndEmployeeNo(tenantId, "EMP-001")).thenReturn(Optional.empty());
            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                User u = inv.getArgument(0);
                u.setId(UUID.randomUUID());
                u.setTenantId(tenantId);
                u.setAccounts(new ArrayList<>());
                return u;
            });
            when(accountRepository.save(any(Account.class))).thenAnswer(inv -> {
                Account a = inv.getArgument(0);
                a.setId(UUID.randomUUID());
                a.setTenantId(tenantId);
                return a;
            });
            when(eventPublisher.publish(anyString(), any())).thenReturn(CompletableFuture.completedFuture(null));

            UserResponse response = userService.createUser(request);

            assertThat(response.firstName()).isEqualTo("John");
            assertThat(response.lastName()).isEqualTo("Doe");
            assertThat(response.displayName()).isEqualTo("John Doe");
            assertThat(response.email()).isEqualTo("john@innait.io");
            assertThat(response.department()).isEqualTo("Engineering");

            verify(userRepository).save(any(User.class));
            verify(accountRepository).save(any(Account.class));
            verify(eventPublisher).publish(eq(InnaITTopics.USER_CREATED), any(EventEnvelope.class));
        }

        @Test
        void shouldRejectDuplicateEmail() {
            CreateUserRequest request = new CreateUserRequest(
                    "John", "Doe", null, "john@innait.io", null,
                    null, null, null, null, null, null,
                    UserType.EMPLOYEE, null, null, false, null, null, null
            );
            when(userRepository.findByTenantIdAndEmail(tenantId, "john@innait.io"))
                    .thenReturn(Optional.of(new User()));

            assertThatThrownBy(() -> userService.createUser(request))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Email already exists");
        }

        @Test
        void shouldRejectDuplicateEmployeeNo() {
            CreateUserRequest request = new CreateUserRequest(
                    "John", "Doe", null, "john@innait.io", "EMP-001",
                    null, null, null, null, null, null,
                    UserType.EMPLOYEE, null, null, false, null, null, null
            );
            when(userRepository.findByTenantIdAndEmail(tenantId, "john@innait.io")).thenReturn(Optional.empty());
            when(userRepository.findByTenantIdAndEmployeeNo(tenantId, "EMP-001"))
                    .thenReturn(Optional.of(new User()));

            assertThatThrownBy(() -> userService.createUser(request))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Employee number already exists");
        }

        @Test
        void shouldSetPendingActivationWhenPasswordEnabled() {
            CreateUserRequest request = new CreateUserRequest(
                    "John", "Doe", null, "john@innait.io", null,
                    null, null, null, null, null, null,
                    UserType.EMPLOYEE, null, null, true, null, null, null
            );
            when(userRepository.findByTenantIdAndEmail(tenantId, "john@innait.io")).thenReturn(Optional.empty());
            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                User u = inv.getArgument(0);
                u.setId(UUID.randomUUID());
                u.setTenantId(tenantId);
                u.setAccounts(new ArrayList<>());
                return u;
            });

            ArgumentCaptor<Account> accountCaptor = ArgumentCaptor.forClass(Account.class);
            when(accountRepository.save(accountCaptor.capture())).thenAnswer(inv -> {
                Account a = inv.getArgument(0);
                a.setId(UUID.randomUUID());
                a.setTenantId(tenantId);
                return a;
            });
            when(eventPublisher.publish(anyString(), any())).thenReturn(CompletableFuture.completedFuture(null));

            userService.createUser(request);

            Account savedAccount = accountCaptor.getValue();
            assertThat(savedAccount.getAccountStatus()).isEqualTo(AccountStatus.PENDING_ACTIVATION);
            assertThat(savedAccount.isMustChangePassword()).isTrue();
        }

        @Test
        void shouldAssignDefaultRolesAndGroups() {
            UUID roleId = UUID.randomUUID();
            UUID groupId = UUID.randomUUID();
            CreateUserRequest request = new CreateUserRequest(
                    "John", "Doe", null, "john@innait.io", null,
                    null, null, null, null, null, null,
                    UserType.EMPLOYEE, null, null, false, null,
                    List.of(roleId), List.of(groupId)
            );
            when(userRepository.findByTenantIdAndEmail(tenantId, "john@innait.io")).thenReturn(Optional.empty());
            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                User u = inv.getArgument(0);
                u.setId(UUID.randomUUID());
                u.setTenantId(tenantId);
                u.setAccounts(new ArrayList<>());
                return u;
            });
            when(accountRepository.save(any(Account.class))).thenAnswer(inv -> {
                Account a = inv.getArgument(0);
                a.setId(UUID.randomUUID());
                a.setTenantId(tenantId);
                return a;
            });

            Role role = new Role();
            role.setId(roleId);
            when(roleRepository.findById(roleId)).thenReturn(Optional.of(role));
            when(accountRoleMapRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Group group = new Group();
            group.setId(groupId);
            when(groupRepository.findById(groupId)).thenReturn(Optional.of(group));
            when(accountGroupMapRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventPublisher.publish(anyString(), any())).thenReturn(CompletableFuture.completedFuture(null));

            userService.createUser(request);

            verify(accountRoleMapRepository).save(any(AccountRoleMap.class));
            verify(accountGroupMapRepository).save(any(AccountGroupMap.class));
        }
    }

    // ---- getUserById / searchUsers ----

    @Test
    void shouldGetUserById() {
        UUID userId = UUID.randomUUID();
        User user = createTestUser(userId, "john@innait.io");
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        UserResponse response = userService.getUserById(userId);

        assertThat(response.userId()).isEqualTo(userId);
        assertThat(response.email()).isEqualTo("john@innait.io");
    }

    @Test
    void shouldThrowWhenUserNotFound() {
        UUID userId = UUID.randomUUID();
        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getUserById(userId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void shouldSearchUsers() {
        User user = createTestUser(UUID.randomUUID(), "alice@innait.io");
        Page<User> page = new PageImpl<>(List.of(user));
        when(userRepository.search(eq(tenantId), eq("Alice"), isNull(), isNull(), isNull(), any()))
                .thenReturn(page);

        UserSearchCriteria criteria = new UserSearchCriteria("Alice", null, null, null);
        Page<UserResponse> result = userService.searchUsers(criteria, PageRequest.of(0, 10));

        assertThat(result.getTotalElements()).isEqualTo(1);
        assertThat(result.getContent().get(0).email()).isEqualTo("alice@innait.io");
    }

    // ---- updateUser ----

    @Test
    void shouldUpdateUserAndPublishEvent() {
        UUID userId = UUID.randomUUID();
        User user = createTestUser(userId, "john@innait.io");
        user.setDepartment("Engineering");
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(eventPublisher.publish(anyString(), any())).thenReturn(CompletableFuture.completedFuture(null));

        UpdateUserRequest request = new UpdateUserRequest(
                null, null, null, null, null, null, null,
                "HR", null, null, null, null, null
        );

        UserResponse response = userService.updateUser(userId, request);

        assertThat(response.department()).isEqualTo("HR");
        verify(eventPublisher).publish(eq(InnaITTopics.USER_UPDATED), any(EventEnvelope.class));
    }

    @Test
    void shouldNotPublishEventWhenNoChanges() {
        UUID userId = UUID.randomUUID();
        User user = createTestUser(userId, "john@innait.io");
        user.setDepartment("Engineering");
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        UpdateUserRequest request = new UpdateUserRequest(
                null, null, null, null, null, null, null,
                "Engineering", null, null, null, null, null
        );

        userService.updateUser(userId, request);

        verify(eventPublisher, never()).publish(anyString(), any());
    }

    // ---- Status State Machine Tests ----

    @Nested
    class StatusStateMachine {

        @Test
        void shouldActivateFromPending() {
            Account account = createTestAccount(AccountStatus.PENDING_ACTIVATION);
            when(accountRepository.findById(account.getId())).thenReturn(Optional.of(account));
            when(accountRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventPublisher.publish(anyString(), any())).thenReturn(CompletableFuture.completedFuture(null));

            userService.activateAccount(account.getId());

            assertThat(account.getAccountStatus()).isEqualTo(AccountStatus.ACTIVE);
            assertThat(account.getFailedAttemptCount()).isZero();
        }

        @Test
        void shouldSuspendActiveAccount() {
            Account account = createTestAccount(AccountStatus.ACTIVE);
            when(accountRepository.findById(account.getId())).thenReturn(Optional.of(account));
            when(accountRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventPublisher.publish(anyString(), any())).thenReturn(CompletableFuture.completedFuture(null));

            userService.suspendAccount(account.getId(), "Policy violation");

            assertThat(account.getAccountStatus()).isEqualTo(AccountStatus.SUSPENDED);
        }

        @Test
        void shouldReactivateSuspendedAccount() {
            Account account = createTestAccount(AccountStatus.SUSPENDED);
            when(accountRepository.findById(account.getId())).thenReturn(Optional.of(account));
            when(accountRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventPublisher.publish(anyString(), any())).thenReturn(CompletableFuture.completedFuture(null));

            userService.reactivateAccount(account.getId());

            assertThat(account.getAccountStatus()).isEqualTo(AccountStatus.ACTIVE);
        }

        @Test
        void shouldLockActiveAccount() {
            Account account = createTestAccount(AccountStatus.ACTIVE);
            when(accountRepository.findById(account.getId())).thenReturn(Optional.of(account));
            when(accountRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventPublisher.publish(anyString(), any())).thenReturn(CompletableFuture.completedFuture(null));

            userService.lockAccount(account.getId());

            assertThat(account.getAccountStatus()).isEqualTo(AccountStatus.LOCKED);
        }

        @Test
        void shouldUnlockLockedAccount() {
            Account account = createTestAccount(AccountStatus.LOCKED);
            account.setFailedAttemptCount(5);
            account.setLockedUntil(Instant.now().plusSeconds(300));
            when(accountRepository.findById(account.getId())).thenReturn(Optional.of(account));
            when(accountRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventPublisher.publish(anyString(), any())).thenReturn(CompletableFuture.completedFuture(null));

            userService.unlockAccount(account.getId());

            assertThat(account.getAccountStatus()).isEqualTo(AccountStatus.ACTIVE);
            assertThat(account.getFailedAttemptCount()).isZero();
            assertThat(account.getLockedUntil()).isNull();
        }

        @Test
        void shouldDisableActiveAccount() {
            Account account = createTestAccount(AccountStatus.ACTIVE);
            when(accountRepository.findById(account.getId())).thenReturn(Optional.of(account));
            when(accountRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventPublisher.publish(anyString(), any())).thenReturn(CompletableFuture.completedFuture(null));

            userService.disableAccount(account.getId());

            assertThat(account.getAccountStatus()).isEqualTo(AccountStatus.INACTIVE);
        }

        @Test
        void shouldReenableInactiveAccount() {
            Account account = createTestAccount(AccountStatus.INACTIVE);
            when(accountRepository.findById(account.getId())).thenReturn(Optional.of(account));
            when(accountRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventPublisher.publish(anyString(), any())).thenReturn(CompletableFuture.completedFuture(null));

            userService.reenableAccount(account.getId());

            assertThat(account.getAccountStatus()).isEqualTo(AccountStatus.ACTIVE);
        }

        // ---- Invalid transitions ----

        @Test
        void shouldRejectSuspendFromPending() {
            Account account = createTestAccount(AccountStatus.PENDING_ACTIVATION);
            when(accountRepository.findById(account.getId())).thenReturn(Optional.of(account));

            assertThatThrownBy(() -> userService.suspendAccount(account.getId(), "test"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Invalid account status transition");
        }

        @Test
        void shouldRejectLockFromSuspended() {
            Account account = createTestAccount(AccountStatus.SUSPENDED);
            when(accountRepository.findById(account.getId())).thenReturn(Optional.of(account));

            assertThatThrownBy(() -> userService.lockAccount(account.getId()))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("SUSPENDED → LOCKED");
        }

        @Test
        void shouldRejectActivateFromActive() {
            Account account = createTestAccount(AccountStatus.ACTIVE);
            when(accountRepository.findById(account.getId())).thenReturn(Optional.of(account));

            assertThatThrownBy(() -> userService.activateAccount(account.getId()))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("ACTIVE → ACTIVE");
        }

        @Test
        void shouldRejectAnyTransitionFromDeprovisioned() {
            Account account = createTestAccount(AccountStatus.DEPROVISIONED);
            when(accountRepository.findById(account.getId())).thenReturn(Optional.of(account));

            assertThatThrownBy(() -> userService.activateAccount(account.getId()))
                    .isInstanceOf(IllegalStateException.class);
            assertThatThrownBy(() -> userService.suspendAccount(account.getId(), "test"))
                    .isInstanceOf(IllegalStateException.class);
            assertThatThrownBy(() -> userService.disableAccount(account.getId()))
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    // ---- Terminate with cascade ----

    @Nested
    class TerminateAccount {

        @Test
        void shouldTerminateAndCascade() {
            Account account = createTestAccount(AccountStatus.ACTIVE);
            User user = createTestUser(UUID.randomUUID(), "john@innait.io");
            account.setUser(user);

            AccountRoleMap arm = new AccountRoleMap();
            arm.setActive(true);
            AccountGroupMap agm = new AccountGroupMap();
            agm.setActive(true);

            when(accountRepository.findById(account.getId())).thenReturn(Optional.of(account));
            when(accountRoleMapRepository.findByAccountIdAndActive(account.getId(), true))
                    .thenReturn(List.of(arm));
            when(accountGroupMapRepository.findByAccountIdAndActive(account.getId(), true))
                    .thenReturn(List.of(agm));
            when(accountRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(accountRoleMapRepository.saveAll(any())).thenReturn(List.of(arm));
            when(accountGroupMapRepository.saveAll(any())).thenReturn(List.of(agm));
            when(eventPublisher.publish(anyString(), any())).thenReturn(CompletableFuture.completedFuture(null));

            userService.terminateAccount(account.getId(), "Employee departure");

            assertThat(account.getAccountStatus()).isEqualTo(AccountStatus.DEPROVISIONED);
            assertThat(arm.isActive()).isFalse();
            assertThat(arm.getRemovedAt()).isNotNull();
            assertThat(agm.isActive()).isFalse();

            verify(eventPublisher).publish(eq(InnaITTopics.ACCOUNT_TERMINATED), any(EventEnvelope.class));
        }

        @Test
        void shouldRejectTerminateAlreadyDeprovisioned() {
            Account account = createTestAccount(AccountStatus.DEPROVISIONED);
            when(accountRepository.findById(account.getId())).thenReturn(Optional.of(account));

            assertThatThrownBy(() -> userService.terminateAccount(account.getId(), "test"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("already terminated");
        }

        @Test
        void shouldTerminateFromAnyNonTerminalStatus() {
            for (AccountStatus status : List.of(AccountStatus.ACTIVE, AccountStatus.SUSPENDED,
                    AccountStatus.LOCKED, AccountStatus.INACTIVE, AccountStatus.PENDING_ACTIVATION)) {
                Account account = createTestAccount(status);
                User user = createTestUser(UUID.randomUUID(), "test@innait.io");
                account.setUser(user);

                when(accountRepository.findById(account.getId())).thenReturn(Optional.of(account));
                when(accountRoleMapRepository.findByAccountIdAndActive(account.getId(), true))
                        .thenReturn(Collections.emptyList());
                when(accountGroupMapRepository.findByAccountIdAndActive(account.getId(), true))
                        .thenReturn(Collections.emptyList());
                when(accountRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
                when(accountRoleMapRepository.saveAll(any())).thenReturn(Collections.emptyList());
                when(accountGroupMapRepository.saveAll(any())).thenReturn(Collections.emptyList());
                when(eventPublisher.publish(anyString(), any())).thenReturn(CompletableFuture.completedFuture(null));

                userService.terminateAccount(account.getId(), "test");

                assertThat(account.getAccountStatus()).isEqualTo(AccountStatus.DEPROVISIONED);
            }
        }
    }

    // ---- Soft delete / restore ----

    @Test
    void shouldSoftDeleteUser() {
        UUID userId = UUID.randomUUID();
        User user = createTestUser(userId, "john@innait.io");
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(accountRepository.findByUserId(userId)).thenReturn(Collections.emptyList());
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        userService.softDeleteUser(userId);

        assertThat(user.isDeleted()).isTrue();
        assertThat(user.getDeletedAt()).isNotNull();
    }

    @Test
    void shouldRestoreUser() {
        UUID userId = UUID.randomUUID();
        User user = createTestUser(userId, "john@innait.io");
        user.softDelete();
        when(userRepository.findByTenantIdAndDeletedAndDeletedAtBefore(eq(tenantId), eq(true), any()))
                .thenReturn(List.of(user));
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        userService.restoreUser(userId);

        assertThat(user.isDeleted()).isFalse();
        assertThat(user.getDeletedAt()).isNull();
    }

    // ---- Helpers ----

    private User createTestUser(UUID userId, String email) {
        User user = new User();
        user.setId(userId);
        user.setTenantId(tenantId);
        user.setFirstName("Test");
        user.setLastName("User");
        user.setDisplayName("Test User");
        user.setEmail(email);
        user.setUserType(UserType.EMPLOYEE);
        user.setStatus(UserStatus.ACTIVE);
        user.setAccounts(new ArrayList<>());
        return user;
    }

    private Account createTestAccount(AccountStatus status) {
        Account account = new Account();
        account.setId(UUID.randomUUID());
        account.setTenantId(tenantId);
        account.setLoginId("testuser");
        account.setAccountStatus(status);
        return account;
    }
}
