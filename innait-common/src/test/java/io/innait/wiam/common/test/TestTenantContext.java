package io.innait.wiam.common.test;

import io.innait.wiam.common.context.TenantContext;
import org.junit.jupiter.api.extension.AfterEachCallback;
import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;

import java.util.UUID;

/**
 * JUnit 5 extension that automatically sets and clears TenantContext around each test.
 *
 * Usage:
 * <pre>
 *   {@literal @}ExtendWith(TestTenantContext.class)
 *   class MyServiceTest {
 *       // TenantContext is automatically set before each test
 *   }
 * </pre>
 *
 * To get the tenant ID, use {@link TestTenantContext#getTenantId()}.
 */
public class TestTenantContext implements BeforeEachCallback, AfterEachCallback {

    private static final UUID DEFAULT_TENANT_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Override
    public void beforeEach(ExtensionContext context) {
        TenantContext.setTenantId(DEFAULT_TENANT_ID);
    }

    @Override
    public void afterEach(ExtensionContext context) {
        TenantContext.clear();
    }

    /**
     * Returns the default tenant ID used by this extension.
     */
    public static UUID getTenantId() {
        return DEFAULT_TENANT_ID;
    }

    /**
     * Manually set a specific tenant ID for the current test.
     */
    public static void setTenantId(UUID tenantId) {
        TenantContext.setTenantId(tenantId);
    }

    /**
     * Manually clear the tenant context.
     */
    public static void clear() {
        TenantContext.clear();
    }
}
