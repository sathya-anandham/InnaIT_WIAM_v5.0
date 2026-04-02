package io.innait.wiam.common.kafka;

public final class InnaITTopics {

    private InnaITTopics() {
    }

    // Identity domain
    public static final String USER_CREATED = "innait.identity.user.created";
    public static final String USER_UPDATED = "innait.identity.user.updated";
    public static final String ACCOUNT_STATUS_CHANGED = "innait.identity.account.status.changed";
    public static final String ACCOUNT_TERMINATED = "innait.identity.account.terminated";
    public static final String ACCOUNT_ROLE_ASSIGNED = "innait.identity.account.role.assigned";
    public static final String ACCOUNT_ROLE_REMOVED = "innait.identity.account.role.removed";

    // Credential domain
    public static final String CREDENTIAL_ENROLLED = "innait.credential.credential.enrolled";
    public static final String CREDENTIAL_REVOKED = "innait.credential.credential.revoked";

    // Authentication domain
    public static final String AUTH_STARTED = "innait.authn.auth.started";
    public static final String AUTH_SUCCEEDED = "innait.authn.auth.succeeded";
    public static final String AUTH_FAILED = "innait.authn.auth.failed";

    // Session domain
    public static final String SESSION_CREATED = "innait.session.session.created";
    public static final String SESSION_REVOKED = "innait.session.session.revoked";

    // Policy domain
    public static final String POLICY_UPDATED = "innait.policy.policy.updated";

    // Admin domain
    public static final String ADMIN_ACTION_LOGGED = "innait.admin.action.logged";

    // Notification domain
    public static final String NOTIFICATION_REQUESTED = "innait.notification.requested";

    // Connector domain
    public static final String CONNECTOR_SYNC_COMPLETED = "innait.connector.sync.completed";

    // Audit / security domain
    public static final String SECURITY_INCIDENT_DETECTED = "innait.audit.security.incident.detected";
    public static final String ACCOUNT_LOCKED = "innait.identity.account.locked";

    // Admin config domain
    public static final String TENANT_CREATED = "innait.admin.tenant.created";
    public static final String TENANT_UPDATED = "innait.admin.tenant.updated";
    public static final String FEATURE_FLAG_CHANGED = "innait.admin.feature.flag.changed";
    public static final String CONFIG_UPDATED = "innait.admin.config.updated";
}
