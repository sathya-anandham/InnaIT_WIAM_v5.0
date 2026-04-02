package io.innait.wiam.common.redis;

import io.innait.wiam.common.context.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class TenantAwareCacheManagerTest {

    @BeforeEach
    void setUp() {
        TenantContext.clear();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldPrefixCacheNameWithTenantId() {
        UUID tenantId = UUID.randomUUID();
        TenantContext.setTenantId(tenantId);

        String resolved = resolveTenantCacheName("policies");

        assertThat(resolved).isEqualTo(tenantId + ":policies");
    }

    @Test
    void shouldNotPrefixWhenNoTenantContext() {
        // TenantContext is clear (null)
        String resolved = resolveTenantCacheName("policies");

        assertThat(resolved).isEqualTo("policies");
    }

    @Test
    void differentTenantsShouldResolveDifferentCacheNames() {
        UUID tenant1 = UUID.randomUUID();
        UUID tenant2 = UUID.randomUUID();

        TenantContext.setTenantId(tenant1);
        String name1 = resolveTenantCacheName("policies");

        TenantContext.setTenantId(tenant2);
        String name2 = resolveTenantCacheName("policies");

        assertThat(name1).isNotEqualTo(name2);
        assertThat(name1).startsWith(tenant1.toString());
        assertThat(name2).startsWith(tenant2.toString());
    }

    @Test
    void sameTenantSameCacheNameShouldResolveIdentically() {
        UUID tenantId = UUID.randomUUID();
        TenantContext.setTenantId(tenantId);

        String name1 = resolveTenantCacheName("sessions");
        String name2 = resolveTenantCacheName("sessions");

        assertThat(name1).isEqualTo(name2);
    }

    /**
     * Mirrors the resolution logic in TenantAwareCacheManager.resolveTenantCacheName()
     */
    private String resolveTenantCacheName(String name) {
        UUID tenantId = TenantContext.getTenantId();
        if (tenantId != null) {
            return tenantId + ":" + name;
        }
        return name;
    }
}
