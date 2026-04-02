package io.innait.wiam.identityservice.repository;

import io.innait.wiam.common.constant.AccountStatus;
import io.innait.wiam.common.constant.UserType;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.identityservice.entity.Account;
import io.innait.wiam.identityservice.entity.User;
import io.innait.wiam.identityservice.entity.UserStatus;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
class AccountRepositoryTest {

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private UserRepository userRepository;

    private final UUID tenantId = UUID.randomUUID();
    private User testUser;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(tenantId);
        testUser = createAndSaveUser("testuser@innait.io");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldFindByTenantAndLoginIdIgnoreCase() {
        Account account = createAccount(testUser, "Admin.User", AccountStatus.ACTIVE);
        accountRepository.save(account);

        Optional<Account> found = accountRepository.findByTenantIdAndLoginIdIgnoreCase(tenantId, "admin.user");

        assertThat(found).isPresent();
        assertThat(found.get().getLoginId()).isEqualTo("Admin.User");
    }

    @Test
    void shouldNotFindLoginIdFromDifferentTenant() {
        Account account = createAccount(testUser, "user1", AccountStatus.ACTIVE);
        accountRepository.save(account);

        UUID otherTenant = UUID.randomUUID();
        Optional<Account> found = accountRepository.findByTenantIdAndLoginIdIgnoreCase(otherTenant, "user1");

        assertThat(found).isEmpty();
    }

    @Test
    void shouldFindAccountsByUserId() {
        Account account1 = createAccount(testUser, "login1", AccountStatus.ACTIVE);
        Account account2 = createAccount(testUser, "login2", AccountStatus.ACTIVE);
        accountRepository.save(account1);
        accountRepository.save(account2);

        List<Account> found = accountRepository.findByUserId(testUser.getId());

        assertThat(found).hasSize(2);
    }

    @Test
    void shouldFindByAccountStatus() {
        Account active = createAccount(testUser, "active-user", AccountStatus.ACTIVE);
        accountRepository.save(active);

        User user2 = createAndSaveUser("user2@innait.io");
        Account locked = createAccount(user2, "locked-user", AccountStatus.LOCKED);
        accountRepository.save(locked);

        Page<Account> activePage = accountRepository.findByTenantIdAndAccountStatus(
                tenantId, AccountStatus.ACTIVE, PageRequest.of(0, 10));

        assertThat(activePage.getTotalElements()).isEqualTo(1);
        assertThat(activePage.getContent().get(0).getLoginId()).isEqualTo("active-user");
    }

    @Test
    void shouldFindLockedAccountsForAutoUnlock() {
        Account locked = createAccount(testUser, "locked-user", AccountStatus.LOCKED);
        locked.setLockedUntil(Instant.now().minusSeconds(300)); // locked until 5 min ago
        accountRepository.save(locked);

        List<Account> expired = accountRepository.findByTenantIdAndLockedUntilBefore(tenantId, Instant.now());

        assertThat(expired).hasSize(1);
        assertThat(expired.get(0).getLoginId()).isEqualTo("locked-user");
    }

    @Test
    void shouldPaginateAccounts() {
        for (int i = 0; i < 12; i++) {
            User user = createAndSaveUser("page-user" + i + "@innait.io");
            Account account = createAccount(user, "page-login" + i, AccountStatus.ACTIVE);
            accountRepository.save(account);
        }

        Page<Account> page = accountRepository.findByTenantId(tenantId, PageRequest.of(0, 5));

        assertThat(page.getTotalElements()).isEqualTo(12);
        assertThat(page.getTotalPages()).isEqualTo(3);
        assertThat(page.getContent()).hasSize(5);
    }

    private User createAndSaveUser(String email) {
        User user = new User();
        user.setEmail(email);
        user.setFirstName("Test");
        user.setLastName("User");
        user.setDisplayName("Test User");
        user.setUserType(UserType.EMPLOYEE);
        user.setStatus(UserStatus.ACTIVE);
        return userRepository.save(user);
    }

    private Account createAccount(User user, String loginId, AccountStatus status) {
        Account account = new Account();
        account.setUser(user);
        account.setLoginId(loginId);
        account.setAccountStatus(status);
        return account;
    }
}
