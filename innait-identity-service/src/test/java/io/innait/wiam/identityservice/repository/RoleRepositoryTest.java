package io.innait.wiam.identityservice.repository;

import io.innait.wiam.common.constant.RoleType;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.identityservice.entity.ActiveStatus;
import io.innait.wiam.identityservice.entity.Role;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
class RoleRepositoryTest {

    @Autowired
    private RoleRepository roleRepository;

    private final UUID tenantId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(tenantId);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldFindByTenantAndRoleCode() {
        Role role = createRole("SUPER_ADMIN", "Super Administrator", RoleType.SYSTEM);
        roleRepository.save(role);

        Optional<Role> found = roleRepository.findByTenantIdAndRoleCode(tenantId, "SUPER_ADMIN");

        assertThat(found).isPresent();
        assertThat(found.get().getRoleName()).isEqualTo("Super Administrator");
    }

    @Test
    void shouldNotFindRoleCodeFromDifferentTenant() {
        Role role = createRole("ADMIN", "Admin", RoleType.TENANT);
        roleRepository.save(role);

        Optional<Role> found = roleRepository.findByTenantIdAndRoleCode(UUID.randomUUID(), "ADMIN");

        assertThat(found).isEmpty();
    }

    @Test
    void shouldFindByRoleType() {
        createAndSaveRole("SYS_ROLE", "System Role", RoleType.SYSTEM);
        createAndSaveRole("BIZ_ROLE", "Business Role", RoleType.TENANT);

        Page<Role> systemRoles = roleRepository.findByTenantIdAndRoleType(
                tenantId, RoleType.SYSTEM, PageRequest.of(0, 10));

        assertThat(systemRoles.getTotalElements()).isEqualTo(1);
        assertThat(systemRoles.getContent().get(0).getRoleCode()).isEqualTo("SYS_ROLE");
    }

    private Role createRole(String code, String name, RoleType type) {
        Role role = new Role();
        role.setRoleCode(code);
        role.setRoleName(name);
        role.setRoleType(type);
        role.setStatus(ActiveStatus.ACTIVE);
        return role;
    }

    private void createAndSaveRole(String code, String name, RoleType type) {
        roleRepository.save(createRole(code, name, type));
    }
}
