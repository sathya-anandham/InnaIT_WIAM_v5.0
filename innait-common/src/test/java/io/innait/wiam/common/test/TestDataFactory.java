package io.innait.wiam.common.test;

import java.time.Instant;
import java.util.*;

/**
 * Factory methods for creating test data with realistic defaults.
 * Returns Maps to avoid coupling to entity classes across modules.
 * Each module can convert these Maps to its own entity types.
 */
public final class TestDataFactory {

    private static final UUID DEFAULT_TENANT_ID = TestTenantContext.getTenantId();
    private static final Random RANDOM = new Random();

    private TestDataFactory() {}

    // ──────────────────── User ────────────────────

    public static Map<String, Object> createTestUser() {
        return createTestUser(Map.of());
    }

    public static Map<String, Object> createTestUser(Map<String, Object> overrides) {
        int seq = RANDOM.nextInt(100_000);
        Map<String, Object> user = new LinkedHashMap<>();
        user.put("id", UUID.randomUUID());
        user.put("tenantId", DEFAULT_TENANT_ID);
        user.put("firstName", "Test");
        user.put("lastName", "User" + seq);
        user.put("displayName", "Test User" + seq);
        user.put("email", "test.user" + seq + "@innait.io");
        user.put("employeeNo", "EMP-" + String.format("%05d", seq));
        user.put("department", "Engineering");
        user.put("designation", "Developer");
        user.put("userType", "EMPLOYEE");
        user.put("status", "ACTIVE");
        user.put("locale", "en");
        user.put("timezone", "UTC");
        user.put("createdAt", Instant.now());
        user.putAll(overrides);
        return user;
    }

    // ──────────────────── Account ────────────────────

    public static Map<String, Object> createTestAccount() {
        return createTestAccount(Map.of());
    }

    public static Map<String, Object> createTestAccount(Map<String, Object> overrides) {
        int seq = RANDOM.nextInt(100_000);
        Map<String, Object> account = new LinkedHashMap<>();
        account.put("id", UUID.randomUUID());
        account.put("tenantId", DEFAULT_TENANT_ID);
        account.put("loginId", "testuser" + seq);
        account.put("accountStatus", "PENDING_ACTIVATION");
        account.put("passwordEnabled", true);
        account.put("fidoEnabled", false);
        account.put("totpEnabled", false);
        account.put("softtokenEnabled", false);
        account.put("failedAttemptCount", 0);
        account.put("mustChangePassword", false);
        account.put("createdAt", Instant.now());
        account.putAll(overrides);
        return account;
    }

    // ──────────────────── Role ────────────────────

    public static Map<String, Object> createTestRole() {
        return createTestRole(Map.of());
    }

    public static Map<String, Object> createTestRole(Map<String, Object> overrides) {
        int seq = RANDOM.nextInt(100_000);
        Map<String, Object> role = new LinkedHashMap<>();
        role.put("id", UUID.randomUUID());
        role.put("tenantId", DEFAULT_TENANT_ID);
        role.put("roleCode", "TEST_ROLE_" + seq);
        role.put("roleName", "Test Role " + seq);
        role.put("description", "Auto-generated test role");
        role.put("roleType", "TENANT");
        role.put("system", false);
        role.put("status", "ACTIVE");
        role.put("createdAt", Instant.now());
        role.putAll(overrides);
        return role;
    }

    // ──────────────────── Group ────────────────────

    public static Map<String, Object> createTestGroup() {
        return createTestGroup(Map.of());
    }

    public static Map<String, Object> createTestGroup(Map<String, Object> overrides) {
        int seq = RANDOM.nextInt(100_000);
        Map<String, Object> group = new LinkedHashMap<>();
        group.put("id", UUID.randomUUID());
        group.put("tenantId", DEFAULT_TENANT_ID);
        group.put("groupCode", "TEST_GROUP_" + seq);
        group.put("groupName", "Test Group " + seq);
        group.put("description", "Auto-generated test group");
        group.put("groupType", "STATIC");
        group.put("status", "ACTIVE");
        group.put("createdAt", Instant.now());
        group.putAll(overrides);
        return group;
    }

    // ──────────────────── Entitlement ────────────────────

    public static Map<String, Object> createTestEntitlement() {
        return createTestEntitlement(Map.of());
    }

    public static Map<String, Object> createTestEntitlement(Map<String, Object> overrides) {
        int seq = RANDOM.nextInt(100_000);
        Map<String, Object> entitlement = new LinkedHashMap<>();
        entitlement.put("id", UUID.randomUUID());
        entitlement.put("tenantId", DEFAULT_TENANT_ID);
        entitlement.put("entitlementCode", "ENT_" + seq);
        entitlement.put("entitlementName", "Test Entitlement " + seq);
        entitlement.put("resource", "api/v1/test");
        entitlement.put("action", "READ");
        entitlement.put("status", "ACTIVE");
        entitlement.put("createdAt", Instant.now());
        entitlement.putAll(overrides);
        return entitlement;
    }

    // ──────────────────── Password Policy ────────────────────

    public static Map<String, Object> createTestPasswordPolicy() {
        return createTestPasswordPolicy(Map.of());
    }

    public static Map<String, Object> createTestPasswordPolicy(Map<String, Object> overrides) {
        Map<String, Object> policy = new LinkedHashMap<>();
        policy.put("passwordPolicyId", UUID.randomUUID());
        policy.put("tenantId", DEFAULT_TENANT_ID);
        policy.put("policyName", "Default Password Policy");
        policy.put("minLength", 8);
        policy.put("maxLength", 128);
        policy.put("requireUppercase", true);
        policy.put("requireLowercase", true);
        policy.put("requireDigit", true);
        policy.put("requireSpecial", true);
        policy.put("maxRepeatedChars", 3);
        policy.put("historyCount", 5);
        policy.put("maxAgeDays", 90);
        policy.put("minAgeDays", 1);
        policy.put("lockoutThreshold", 5);
        policy.put("lockoutDurationMin", 30);
        policy.put("isDefault", true);
        policy.put("status", "ACTIVE");
        policy.put("createdAt", Instant.now());
        policy.put("updatedAt", Instant.now());
        policy.putAll(overrides);
        return policy;
    }

    // ──────────────────── MFA Policy ────────────────────

    public static Map<String, Object> createTestMfaPolicy() {
        return createTestMfaPolicy(Map.of());
    }

    public static Map<String, Object> createTestMfaPolicy(Map<String, Object> overrides) {
        Map<String, Object> policy = new LinkedHashMap<>();
        policy.put("mfaPolicyId", UUID.randomUUID());
        policy.put("tenantId", DEFAULT_TENANT_ID);
        policy.put("policyName", "Default MFA Policy");
        policy.put("enforcementMode", "REQUIRED");
        policy.put("allowedMethods", "[\"TOTP\",\"FIDO\",\"SOFT_TOKEN\"]");
        policy.put("rememberDeviceDays", 30);
        policy.put("gracePeriodDays", 7);
        policy.put("isDefault", true);
        policy.put("status", "ACTIVE");
        policy.put("createdAt", Instant.now());
        policy.put("updatedAt", Instant.now());
        policy.putAll(overrides);
        return policy;
    }

    // ──────────────────── Session ────────────────────

    public static Map<String, Object> createTestSession() {
        return createTestSession(Map.of());
    }

    public static Map<String, Object> createTestSession(Map<String, Object> overrides) {
        Map<String, Object> session = new LinkedHashMap<>();
        session.put("sessionId", UUID.randomUUID());
        session.put("accountId", UUID.randomUUID());
        session.put("tenantId", DEFAULT_TENANT_ID);
        session.put("authMethodsUsed", List.of("pwd", "totp"));
        session.put("acrLevel", 2);
        session.put("sessionType", "INTERACTIVE");
        session.put("ipAddress", "192.168.1.100");
        session.put("userAgent", "Mozilla/5.0 (Test)");
        session.put("active", true);
        session.put("createdAt", Instant.now());
        session.put("expiresAt", Instant.now().plusSeconds(3600));
        session.putAll(overrides);
        return session;
    }

    // ──────────────────── Audit Event ────────────────────

    public static Map<String, Object> createTestAuditEvent() {
        return createTestAuditEvent(Map.of());
    }

    public static Map<String, Object> createTestAuditEvent(Map<String, Object> overrides) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("id", UUID.randomUUID());
        event.put("tenantId", DEFAULT_TENANT_ID);
        event.put("eventType", "USER_LOGIN");
        event.put("actorId", UUID.randomUUID());
        event.put("actorType", "USER");
        event.put("targetId", UUID.randomUUID());
        event.put("targetType", "SESSION");
        event.put("outcome", "SUCCESS");
        event.put("ipAddress", "192.168.1.100");
        event.put("userAgent", "Mozilla/5.0 (Test)");
        event.put("timestamp", Instant.now());
        event.putAll(overrides);
        return event;
    }

    // ──────────────────── Tenant ────────────────────

    public static Map<String, Object> createTestTenant() {
        return createTestTenant(Map.of());
    }

    public static Map<String, Object> createTestTenant(Map<String, Object> overrides) {
        int seq = RANDOM.nextInt(100_000);
        Map<String, Object> tenant = new LinkedHashMap<>();
        tenant.put("tenantId", UUID.randomUUID());
        tenant.put("tenantCode", "TENANT_" + seq);
        tenant.put("tenantName", "Test Tenant " + seq);
        tenant.put("domain", "tenant" + seq + ".innait.io");
        tenant.put("status", "ACTIVE");
        tenant.put("tier", "STANDARD");
        tenant.put("maxUsers", 1000);
        tenant.put("createdAt", Instant.now());
        tenant.putAll(overrides);
        return tenant;
    }

    // ──────────────────── Helpers ────────────────────

    public static UUID randomId() {
        return UUID.randomUUID();
    }

    public static String randomEmail() {
        return "user" + RANDOM.nextInt(100_000) + "@innait.io";
    }

    public static String randomLoginId() {
        return "user" + RANDOM.nextInt(100_000);
    }
}
