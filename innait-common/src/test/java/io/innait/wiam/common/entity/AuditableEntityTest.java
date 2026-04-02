package io.innait.wiam.common.entity;

import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.security.InnaITAuthenticationToken;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AuditableEntityTest {

    private final UUID tenantId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    @Test
    void onCreateShouldSetCreatedByAndUpdatedBy() {
        TenantContext.setTenantId(tenantId);
        setUpSecurityContext(userId);

        var entity = new TestAuditableEntity();
        entity.onCreate();

        assertThat(entity.getCreatedBy()).isEqualTo(userId);
        assertThat(entity.getUpdatedBy()).isEqualTo(userId);
    }

    @Test
    void onUpdateShouldSetUpdatedBy() {
        TenantContext.setTenantId(tenantId);
        setUpSecurityContext(userId);

        var entity = new TestAuditableEntity();
        entity.onCreate();

        UUID newUserId = UUID.randomUUID();
        setUpSecurityContext(newUserId);
        entity.onUpdate();

        assertThat(entity.getCreatedBy()).isEqualTo(userId);
        assertThat(entity.getUpdatedBy()).isEqualTo(newUserId);
    }

    @Test
    void onCreateShouldSetNullWhenNoSecurityContext() {
        TenantContext.setTenantId(tenantId);
        // No SecurityContext set

        var entity = new TestAuditableEntity();
        entity.onCreate();

        assertThat(entity.getCreatedBy()).isNull();
        assertThat(entity.getUpdatedBy()).isNull();
    }

    private void setUpSecurityContext(UUID actorUserId) {
        var token = new InnaITAuthenticationToken(
                "user@innait.io", tenantId, actorUserId, "user", UUID.randomUUID(),
                List.of("USER"), List.of(), List.of("pwd"), "aal1", "token",
                List.of(new SimpleGrantedAuthority("ROLE_USER"))
        );
        SecurityContextHolder.getContext().setAuthentication(token);
    }

    static class TestAuditableEntity extends AuditableEntity {
        @Override
        public void onCreate() {
            super.onCreate();
        }

        @Override
        public void onUpdate() {
            super.onUpdate();
        }
    }
}
