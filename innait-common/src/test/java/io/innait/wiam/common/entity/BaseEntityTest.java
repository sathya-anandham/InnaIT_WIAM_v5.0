package io.innait.wiam.common.entity;

import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.exception.TenantMismatchException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BaseEntityTest {

    private final UUID tenantId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        TenantContext.clear();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void onCreateShouldAutoGenerateIdAndSetTenant() {
        TenantContext.setTenantId(tenantId);
        var entity = new TestEntity();

        entity.onCreate();

        assertThat(entity.getId()).isNotNull();
        assertThat(entity.getTenantId()).isEqualTo(tenantId);
        assertThat(entity.getCreatedAt()).isNotNull();
        assertThat(entity.getUpdatedAt()).isNotNull();
        assertThat(entity.getCreatedAt()).isEqualTo(entity.getUpdatedAt());
    }

    @Test
    void onCreateShouldNotOverrideExistingId() {
        TenantContext.setTenantId(tenantId);
        UUID existingId = UUID.randomUUID();
        var entity = new TestEntity();
        entity.setId(existingId);

        entity.onCreate();

        assertThat(entity.getId()).isEqualTo(existingId);
    }

    @Test
    void onCreateShouldNotOverrideExistingTenant() {
        UUID otherTenant = UUID.randomUUID();
        TenantContext.setTenantId(tenantId);
        var entity = new TestEntity();
        entity.setTenantId(otherTenant);

        entity.onCreate();

        // Tenant was already set, so it should not be overridden
        assertThat(entity.getTenantId()).isEqualTo(otherTenant);
    }

    @Test
    void onCreateShouldFailWithoutTenantContext() {
        // TenantContext not set
        var entity = new TestEntity();

        assertThatThrownBy(entity::onCreate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Tenant context is not set");
    }

    @Test
    void onUpdateShouldSetUpdatedAt() {
        TenantContext.setTenantId(tenantId);
        var entity = new TestEntity();
        entity.onCreate();
        var originalUpdatedAt = entity.getUpdatedAt();

        // Small delay to ensure different timestamp
        entity.onUpdate();

        assertThat(entity.getUpdatedAt()).isAfterOrEqualTo(originalUpdatedAt);
    }

    @Test
    void onUpdateShouldAllowSameTenantContext() {
        TenantContext.setTenantId(tenantId);
        var entity = new TestEntity();
        entity.onCreate();

        // Same tenant in context - should not throw
        entity.onUpdate();

        assertThat(entity.getUpdatedAt()).isNotNull();
    }

    @Test
    void onUpdateShouldThrowOnCrossTenantWrite() {
        TenantContext.setTenantId(tenantId);
        var entity = new TestEntity();
        entity.onCreate();

        // Change tenant context to a different tenant
        UUID otherTenant = UUID.randomUUID();
        TenantContext.setTenantId(otherTenant);

        assertThatThrownBy(entity::onUpdate)
                .isInstanceOf(TenantMismatchException.class);
    }

    @Test
    void onUpdateShouldPassWhenNoTenantContext() {
        TenantContext.setTenantId(tenantId);
        var entity = new TestEntity();
        entity.onCreate();

        // Clear tenant context - should not throw (allows system operations)
        TenantContext.clear();

        entity.onUpdate();
        assertThat(entity.getUpdatedAt()).isNotNull();
    }

    @Test
    void versionShouldDefaultToNull() {
        var entity = new TestEntity();
        assertThat(entity.getVersion()).isNull();
    }

    /**
     * Concrete subclass for testing the abstract BaseEntity.
     */
    static class TestEntity extends BaseEntity {
        // Override to make accessible for testing
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
