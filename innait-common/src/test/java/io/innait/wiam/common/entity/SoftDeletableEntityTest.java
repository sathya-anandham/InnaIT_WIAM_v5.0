package io.innait.wiam.common.entity;

import io.innait.wiam.common.context.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class SoftDeletableEntityTest {

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
    void shouldDefaultToNotDeleted() {
        var entity = new TestSoftDeletableEntity();
        entity.onCreate();

        assertThat(entity.isDeleted()).isFalse();
        assertThat(entity.getDeletedAt()).isNull();
    }

    @Test
    void softDeleteShouldMarkAsDeletedWithTimestamp() {
        var entity = new TestSoftDeletableEntity();
        entity.onCreate();

        entity.softDelete();

        assertThat(entity.isDeleted()).isTrue();
        assertThat(entity.getDeletedAt()).isNotNull();
    }

    @Test
    void restoreShouldClearDeletedState() {
        var entity = new TestSoftDeletableEntity();
        entity.onCreate();
        entity.softDelete();

        entity.restore();

        assertThat(entity.isDeleted()).isFalse();
        assertThat(entity.getDeletedAt()).isNull();
    }

    static class TestSoftDeletableEntity extends SoftDeletableEntity {
        @Override
        public void onCreate() {
            super.onCreate();
        }
    }
}
