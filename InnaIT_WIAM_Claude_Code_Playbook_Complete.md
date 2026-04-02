# InnaIT WIAM – Complete Claude Code Development Playbook
# End-to-End Implementation with Unit, Integration & UI Testing
# Version 1.0 | April 2026
# Precision Group – InnaIT Identity Solutions
# Total Prompts: 62 (across 8 phases)

---

## PHASE 0: PROJECT SCAFFOLDING & DATABASE (Prompts 01–05)

---

### PROMPT 01 – Maven Multi-Module Project Scaffold

```
Create an InnaIT WIAM Maven multi-module project using Java 21 and Spring Boot 3.3.x.

Root pom.xml (groupId: io.innait.wiam, artifactId: innait-wiam-platform):
- Parent: spring-boot-starter-parent:3.3.2
- Java 21, UTF-8, strict compilation warnings
- Module list: innait-common, innait-identity-service, innait-credential-service, innait-auth-orchestrator, innait-mfa-service, innait-session-service, innait-token-service, innait-policy-service, innait-audit-service, innait-notification-service, innait-admin-config-service, innait-directory-connector, innait-api-gateway, innait-admin-bff

innait-common module:
- Shared DTOs, exceptions, constants, tenant context, base entities, audit annotations
- Base entity: BaseEntity with UUID PK (RAW(16) mapped via @Column(columnDefinition="RAW(16)")), TENANT_ID, CREATED_AT, UPDATED_AT
- TenantContext: ThreadLocal<UUID> with Spring Security filter integration
- Custom exceptions: ResourceNotFoundException, TenantMismatchException, ConcurrencyException, AuthenticationFlowException
- Kafka event envelope: EventEnvelope<T> with event_id, schema_version="v1", event_type, tenant_id, correlation_id, timestamp, actor_id, actor_type, payload
- API response envelope: ApiResponse<T> with status (SUCCESS/ERROR), data, error (code + message), meta (page, size, total)
- Constants: AuthMethod enum, UserType enum, AccountStatus enum, CredentialStatus enum, AssignmentSource enum, RoleType enum

Dependencies to manage in parent:
- spring-boot-starter-web, spring-boot-starter-security, spring-boot-starter-data-jpa
- spring-boot-starter-validation, spring-kafka, spring-session-data-redis
- spring-cloud-starter-gateway (for gateway module only), spring-vault-core
- ojdbc11:23.4.0.24.05, ucp11, jooq:3.19.x, webauthn4j-core:0.24.x
- nimbus-jose-jwt:9.40, micrometer-registry-prometheus, springdoc-openapi-starter-webmvc-ui:2.6.x
- lettuce-core, testcontainers (oracle-xe, kafka, redis)
- spring-boot-starter-test, spring-security-test

Each service module has:
- src/main/java/io/innait/wiam/{service}/
- src/main/resources/application.yml, application-dev.yml, application-staging.yml, application-prod.yml
- src/test/java/ mirroring main structure
- Dockerfile (multi-stage: maven build → eclipse-temurin:21-jre-alpine runtime)

Generate complete pom.xml files for root and all modules. Include spring-boot-maven-plugin with layers for Docker. Include maven-surefire-plugin for unit tests and maven-failsafe-plugin for integration tests (*IT.java pattern).
```

---

### PROMPT 02 – Oracle Schema Creation & Flyway Setup

```
Set up Flyway 10.x database migrations for InnaIT WIAM across 9 Oracle schemas.

Each service module gets its own Flyway configuration:
- innait-identity-service → INNAIT_IDENTITY schema
- innait-credential-service → INNAIT_CREDENTIAL schema
- innait-auth-orchestrator → INNAIT_AUTHN schema
- innait-session-service → INNAIT_SESSION schema
- innait-policy-service → INNAIT_POLICY schema
- innait-audit-service → INNAIT_AUDIT schema
- innait-admin-config-service → INNAIT_TENANT + INNAIT_CONFIG schemas

Migration files (use the exact DDL from the delivered evidence pack):

V001__create_innait_tenant_schema.sql:
- TENANTS (TENANT_ID RAW(16) PK, TENANT_CODE, TENANT_NAME, STATUS, BRANDING_CONFIG JSON, SUBSCRIPTION_TIER)
- TENANT_DOMAINS (DOMAIN_ID PK, TENANT_ID FK, DOMAIN_NAME unique lower, VERIFICATION_STATUS)
- ORG_UNITS (ORG_UNIT_ID PK, TENANT_ID FK, ORG_CODE unique per tenant, PARENT_ORG_UNIT_ID self-ref)
- APPLICATIONS (APP_ID PK, TENANT_ID FK, APP_CODE unique per tenant, APP_TYPE, STATUS)

V001__create_innait_identity_schema.sql:
- USERS (USER_ID PK, TENANT_ID, EMAIL unique per tenant case-insensitive, USER_TYPE CHECK, STATUS CHECK, IS_DELETED, DELETED_AT, MANAGER_USER_ID self-ref)
- ACCOUNTS (ACCOUNT_ID PK, USER_ID FK, TENANT_ID, LOGIN_ID unique per tenant case-insensitive, ACCOUNT_STATUS CHECK, IS_PASSWORD/FIDO/TOTP/SOFTTOKEN_ENABLED, FAILED_ATTEMPT_COUNT, LOCKED_UNTIL)
- ROLES (ROLE_ID PK, TENANT_ID, ROLE_CODE unique per tenant, ROLE_TYPE CHECK(RUNTIME/BUSINESS/APP/ADMIN), IS_SYSTEM)
- GROUPS (GROUP_ID PK, TENANT_ID, GROUP_CODE unique per tenant, GROUP_TYPE CHECK)
- ENTITLEMENTS (ENTITLEMENT_ID PK, TENANT_ID, ENTITLEMENT_CODE unique per tenant, ENTITLEMENT_TYPE CHECK(CLAIM/APP_PERMISSION/SYSTEM_PERMISSION))
- ACCOUNT_ROLE_MAP (PK, ACCOUNT_ID FK, ROLE_ID FK, TENANT_ID, ASSIGNMENT_SOURCE CHECK(MANUAL/SYNC/POLICY/IGA/SELF_SERVICE), IS_ACTIVE, REMOVED_AT)
- ACCOUNT_GROUP_MAP, GROUP_ROLE_MAP, ROLE_ENTITLEMENT_MAP (similar N:M with TENANT_ID)
- PASSWORD_HISTORY (PK, ACCOUNT_ID, PASSWORD_HASH, CHANGED_AT)

V001__create_innait_credential_schema.sql:
- PASSWORD_CREDENTIALS (PK, ACCOUNT_ID, TENANT_ID, PASSWORD_HASH varchar(512), HASH_ALGORITHM default ARGON2ID, IS_ACTIVE unique per account, MUST_CHANGE, CREDENTIAL_STATUS)
- FIDO_CREDENTIALS (PK, ACCOUNT_ID, TENANT_ID, CREDENTIAL_ID varchar(1024) unique, PUBLIC_KEY_COSE BLOB, AAGUID, SIGN_COUNT, BACKUP_ELIGIBLE)
- TOTP_CREDENTIALS (PK, ACCOUNT_ID, TENANT_ID, ENCRYPTED_SECRET RAW(256), SECRET_IV RAW(16), SECRET_KEK_VERSION, ALGORITHM, DIGITS, PERIOD_SECONDS)
- SOFTTOKEN_CREDENTIALS (PK, ACCOUNT_ID, TENANT_ID, DEVICE_ID unique, DEVICE_PLATFORM CHECK, PUBLIC_KEY BLOB, PUSH_TOKEN, ACTIVATION_STATUS)
- BACKUP_CODES (PK, ACCOUNT_ID, TENANT_ID, CODE_HASH, CODE_INDEX, STATUS CHECK(UNUSED/USED/INVALIDATED))

V001__create_innait_authn_schema.sql:
- AUTH_TRANSACTIONS partitioned by STARTED_AT monthly interval (PK, TENANT_ID, ACCOUNT_ID, CORRELATION_ID, CURRENT_STATE CHECK 8 states, CHANNEL_TYPE, RISK_SCORE, DEVICE_CONTEXT_ID reserved)
- AUTH_CHALLENGES (PK, AUTH_TXN_ID, CHALLENGE_TYPE CHECK 7 types, CHALLENGE_STATUS)
- AUTH_RESULTS (PK, AUTH_TXN_ID, RESULT CHECK, AUTH_METHODS_USED JSON)
- LOGIN_ATTEMPTS hash-partitioned by TENANT_ID 8 partitions

V001__create_innait_session_schema.sql:
- SESSIONS (PK, TENANT_ID, ACCOUNT_ID, SESSION_TYPE, SESSION_STATUS, EXPIRES_AT)
- SESSION_CONTEXT (PK, SESSION_ID FK, IP_ADDRESS, USER_AGENT, DEVICE_FINGERPRINT, GEO_*, DEVICE_TRUST_SCORE reserved)
- REFRESH_TOKENS (PK, SESSION_ID FK, TOKEN_HASH unique, TOKEN_FAMILY, IS_USED)
- SESSION_EVENTS partitioned by EVENT_TIME monthly

V001__create_innait_policy_schema.sql:
- PASSWORD_POLICIES, MFA_POLICIES, AUTH_POLICIES (with SpEL RULE_EXPRESSION), POLICY_BINDINGS

V001__create_innait_audit_schema.sql:
- AUDIT_EVENTS range-partitioned by EVENT_TIME (PK, TENANT_ID, CORRELATION_ID, EVENT_TYPE, EVENT_CATEGORY CHECK 10 categories, ACTOR_ID, SUBJECT_ID, DETAIL JSON)
- ADMIN_ACTIONS partitioned, SECURITY_INCIDENTS partitioned

V001__create_innait_config_schema.sql:
- FEATURE_FLAGS (PK, TENANT_ID, FLAG_KEY unique per tenant, FLAG_VALUE boolean)
- CONNECTORS (PK, TENANT_ID, CONNECTOR_TYPE CHECK 9 types, ENCRYPTED_CONFIG JSON)
- SYSTEM_SETTINGS (PK, TENANT_ID nullable, SETTING_KEY, SETTING_VALUE, VALUE_TYPE)

R__seed_reference_data.sql (repeatable):
- 9 system roles via MERGE: SUPER_ADMIN, TENANT_ADMIN, USER_ADMIN, HELPDESK, AUDITOR, POLICY_ADMIN, IGA_ADMIN, IGA_CERTIFIER, AUTHENTICATED_USER
- Default feature flags: self_registration_enabled=0, passwordless_enabled=0, iga_enabled=0, etc.
- Default system settings: session timeout, OTP validity, rate limits, JWT TTLs

All PKs use RAW(16) with SYS_GUID() default. All tables have TENANT_ID NOT NULL. All timestamps are TIMESTAMP WITH TIME ZONE. Booleans are NUMBER(1) CHECK IN (0,1). Every index from the closure pack index catalog must be included.

Spring Boot Flyway config per service in application.yml:
  spring.flyway.locations: classpath:db/migration/{schema}
  spring.flyway.schemas: INNAIT_{SCHEMA}
  spring.flyway.baseline-on-migrate: true

Create Testcontainers config class (OracleTestContainerConfig) for integration tests using gvenzl/oracle-xe:21-slim.
```

---

### PROMPT 03 – Spring Security + Tenant Context Foundation

```
Implement the cross-cutting security and tenant isolation layer for InnaIT WIAM in the innait-common module.

1. TenantContext (ThreadLocal):
   - TenantContext.java: static ThreadLocal<UUID> tenantId, static get()/set()/clear()
   - TenantContextFilter extends OncePerRequestFilter:
     * Extract tenant_id from JWT claims
     * Set TenantContext.set(tenantId)
     * Set Oracle VPD context via JDBC: "BEGIN INNAIT_SECURITY.SET_TENANT_CONTEXT(?); END;"
     * Clear in finally block
   - Order: run AFTER JwtAuthenticationFilter

2. JwtAuthenticationFilter extends OncePerRequestFilter:
   - Extract Bearer token from Authorization header or HttpOnly cookie "INNAIT_TOKEN"
   - Validate JWT signature using JWKS endpoint (configurable URL)
   - Extract claims: sub, tenant_id, user_id, login_id, session_id, roles[], groups[], amr[], acr
   - Create InnaITAuthenticationToken extends AbstractAuthenticationToken with all claims
   - Set SecurityContextHolder.getContext().setAuthentication(token)

3. SecurityConfig (@Configuration):
   - @Bean SecurityFilterChain: stateless session, CSRF disabled for API (enabled for Angular BFF)
   - Permit: /actuator/health, /api/v1/auth/login/**, /api/v1/self/credentials/password/forgot
   - Authenticated: everything else
   - CORS: configurable origins per tenant
   - Add JwtAuthenticationFilter before UsernamePasswordAuthenticationFilter
   - Add TenantContextFilter after JwtAuthenticationFilter

4. Method-level security:
   - @PreAuthorize annotations support: hasRole('SUPER_ADMIN'), hasTenantRole('TENANT_ADMIN')
   - Custom MethodSecurityExpressionHandler with TenantAwarePermissionEvaluator

5. Base JPA entities:
   - BaseEntity: @MappedSuperclass with id (UUID, @Column(columnDefinition="RAW(16)")), tenantId, createdAt, updatedAt
   - @PrePersist: auto-set tenantId from TenantContext, set createdAt/updatedAt
   - @PreUpdate: auto-set updatedAt, verify tenantId matches TenantContext (prevent cross-tenant write)
   - AuditableEntity extends BaseEntity: adds createdBy, updatedBy (from SecurityContext)
   - SoftDeletableEntity extends AuditableEntity: adds isDeleted, deletedAt

6. Hibernate filters:
   - @FilterDef(name="softDeleteFilter", parameters=@ParamDef(name="isDeleted", type=Integer.class))
   - Default @Filter on User and Account entities: "IS_DELETED = :isDeleted" with isDeleted=0
   - TenantFilter: "TENANT_ID = :tenantId" auto-applied

7. Global exception handler (@RestControllerAdvice):
   - Map all custom exceptions to ApiResponse<Void> with proper HTTP status codes
   - ResourceNotFoundException → 404, TenantMismatchException → 403
   - ConstraintViolationException → 400, OptimisticLockException → 409

Write unit tests for:
- TenantContextFilter: verify tenant extraction from JWT, VPD context set, cleanup
- JwtAuthenticationFilter: valid JWT, expired JWT, missing JWT, tampered JWT
- BaseEntity @PrePersist: tenant auto-set, cross-tenant write prevention
- SecurityConfig: permit/deny patterns
Use MockMvc, @WebMvcTest, Mockito.
```

---

### PROMPT 04 – Kafka Infrastructure + Event Publishing

```
Implement the Kafka event infrastructure for InnaIT WIAM.

1. Kafka configuration (innait-common):
   - KafkaProducerConfig: JsonSerializer with custom headers (tenant_id, correlation_id, event_type)
   - KafkaConsumerConfig: JsonDeserializer with trusted packages, auto.offset.reset=earliest, enable.auto.commit=false
   - Topic constants class: InnaITTopics with all 17 topic names:
     innait.identity.user.created, user.updated, account.status.changed, account.terminated,
     account.role.assigned, account.role.removed, credential.enrolled, credential.revoked,
     authn.auth.started, auth.succeeded, auth.failed, session.created, session.revoked,
     policy.updated, admin.action.logged
   - KafkaTopicConfig: @Bean NewTopic for each topic with partition counts and replication from application.yml

2. Event envelope (innait-common):
   - EventEnvelope<T>: event_id (UUID), schema_version ("v1"), event_type (String), tenant_id (UUID), correlation_id (UUID), timestamp (Instant), actor_id (UUID), actor_type (enum: USER/ADMIN/SYSTEM/IGA/CONNECTOR), payload (T)
   - EventPublisher service:
     * publish(String topic, EventEnvelope<?> event): adds tenant_id, correlation_id as Kafka headers
     * Uses KafkaTemplate<String, EventEnvelope<?>>
     * Partition key: event.tenantId.toString() (ensures tenant event ordering)

3. Payload DTOs (matching frozen Kafka schemas):
   - UserCreatedPayload: user_id, tenant_id, user_type, department, designation, org_unit_id, manager_user_id, email, created_by, creation_method
   - UserUpdatedPayload: user_id, changed_fields[], old_values (Map), new_values (Map), updated_by
   - AccountRoleAssignedPayload: account_id, role_id, role_code, assignment_source, assigned_by, reason
   - AccountRoleRemovedPayload: same structure with removed_by
   - AccountTerminatedPayload: account_id, user_id, terminated_by, cascade_summary (sessions_revoked, credentials_revoked, roles_removed)
   - AuthSucceededPayload: account_id, auth_methods[], source_ip, channel_type, risk_score
   - AuthFailedPayload: same + failure_reason_code

4. CorrelationContext:
   - ThreadLocal<UUID> correlationId
   - CorrelationFilter: extract X-Correlation-ID header or generate new UUID
   - All EventPublisher calls auto-include correlation from context

5. Kafka consumer base:
   - AbstractEventConsumer<T>: template method with deserialize, validate tenant header, process
   - @JsonIgnoreProperties(ignoreUnknown = true) on all payload DTOs (forward compatibility)
   - Error handling: DLT (Dead Letter Topic) for deserialization failures

Write unit tests:
- EventPublisher: verify Kafka headers (tenant_id, correlation_id) set correctly
- EventEnvelope serialization/deserialization roundtrip
- AbstractEventConsumer: tenant header filtering, unknown field tolerance
Use embedded Kafka (@EmbeddedKafka) for integration tests.
```

---

### PROMPT 05 – Redis Configuration + Cache Layer

```
Implement Redis configuration for InnaIT WIAM.

1. RedisConfig (@Configuration):
   - LettuceConnectionFactory with Redis Sentinel support:
     * sentinel.master: innait-master
     * sentinel.nodes from application.yml
     * Password from Vault (spring.redis.password)
   - RedisTemplate<String, Object> with Jackson2JsonRedisSerializer
   - Key namespace convention: {purpose}:{tenantId}:{identifier}

2. Cache key patterns (constants):
   - Session: "session:{tenantId}:{sessionId}" → TTL from session policy
   - Auth transaction: "authn:txn:{txnId}" → TTL 5 min
   - OTP challenge: "otp:{type}:{accountId}" → TTL 60-300 sec
   - Rate limiting: "ratelimit:{tenantId}:{ip}" → TTL 1 min sliding
   - Token blacklist: "revoked:{tokenHash}" → TTL = token remaining lifetime
   - Policy cache: "policy:{tenantId}:{scope}" → TTL 60 sec
   - FIDO challenge: "fido:challenge:{txnId}" → TTL 120 sec

3. TenantAwareCacheManager:
   - Wraps RedisCacheManager
   - Auto-prefixes all cache keys with tenantId from TenantContext
   - Prevents cross-tenant cache access

4. Rate limiter service:
   - RateLimiterService using Redis INCR + EXPIRE (atomic via Lua script)
   - Methods: isAllowed(tenantId, ip, limit, windowSeconds) → boolean
   - Used by API Gateway and Auth Orchestrator

5. Spring Session Redis:
   - @EnableRedisHttpSession
   - Session serializer: JSON (not Java serialization)
   - Namespace: spring:session:{tenantId}:{sessionId}

6. RedisHealthIndicator:
   - Custom health check that verifies Sentinel connectivity + master reachability
   - Exposed via /actuator/health/redis

Write unit tests:
- TenantAwareCacheManager: verify key prefixing, cross-tenant isolation
- RateLimiterService: within limit, exceeded limit, window expiry
Integration tests with Testcontainers Redis:
- Session storage and retrieval
- Rate limiter concurrent access
- Cache eviction on policy change
```

---

## PHASE 1: IDENTITY & USER LIFECYCLE SERVICE (Prompts 06–12)

---

### PROMPT 06 – Identity Service: User Entity & Repository

```
Implement the User domain layer for innait-identity-service.

1. JPA Entities:
   - User extends SoftDeletableEntity:
     * employeeNo, firstName, lastName, displayName, email, phoneCountryCode, phoneNumber
     * department, designation, managerUserId (self-ref), orgUnitId
     * userType (@Enumerated: EMPLOYEE, CONTRACTOR, CUSTOMER, ADMIN)
     * status (@Enumerated: ACTIVE, INACTIVE, SUSPENDED, TERMINATED)
     * @OneToMany accounts (lazy)
     * Hibernate @Filter("softDeleteFilter") with default IS_DELETED=0
     * @Where(clause = "IS_DELETED = 0") for default queries

   - Account extends SoftDeletableEntity:
     * @ManyToOne user (lazy, FK USER_ID)
     * loginId, accountStatus (@Enumerated: PENDING, ACTIVE, LOCKED, SUSPENDED, DISABLED, TERMINATED)
     * isPasswordEnabled, isFidoEnabled, isTotpEnabled, isSofttokenEnabled (boolean)
     * failedAttemptCount, lockedUntil, lastLoginAt, lastLoginIp
     * passwordChangedAt, mustChangePassword
     * @OneToMany accountRoleMaps (lazy)
     * @OneToMany accountGroupMaps (lazy)

   - Role entity: roleCode, roleName, roleType, description, status, isSystem
   - Group entity: groupCode, groupName, groupType, description, status
   - Entitlement entity: entitlementCode, entitlementName, entitlementType, resourceType, resourceId
   - AccountRoleMap: accountId, roleId, tenantId, assignmentSource, assignedBy, assignedAt, isActive, removedAt, removedBy, removalReason, expiryAt
   - AccountGroupMap: similar to AccountRoleMap
   - GroupRoleMap: groupId, roleId, mappedBy
   - RoleEntitlementMap: roleId, entitlementId, mappedBy

2. Repositories (Spring Data JPA):
   - UserRepository extends JpaRepository<User, UUID>:
     * findByTenantIdAndEmail(UUID tenantId, String email)
     * findByTenantIdAndEmployeeNo(UUID tenantId, String empNo)
     * @Query with pageable for search (displayName LIKE, email LIKE, status filter, department filter)
     * findByTenantIdAndIsDeletedAndDeletedAtBefore(tenantId, true, cutoffDate) for purge
   - AccountRepository:
     * findByTenantIdAndLoginIdIgnoreCase(UUID tenantId, String loginId)
     * findByUserId(UUID userId)
     * findByTenantIdAndAccountStatus(UUID tenantId, AccountStatus status, Pageable)
     * findByTenantIdAndLockedUntilBefore(UUID tenantId, Instant now) for auto-unlock
   - RoleRepository: findByTenantIdAndRoleCode, findByTenantIdAndRoleType
   - GroupRepository: findByTenantIdAndGroupCode
   - EntitlementRepository: findByTenantIdAndEntitlementCode
   - AccountRoleMapRepository: findByAccountIdAndIsActive(accountId, true), findByRoleIdAndIsActive
   - AccountGroupMapRepository: similar

3. JPA auditing:
   - @EnableJpaAuditing with AuditorAware<UUID> reading from SecurityContext
   - @EntityListeners(AuditingEntityListener.class) on all entities

Write unit tests for all repositories using @DataJpaTest with H2 (for fast unit tests) and Testcontainers Oracle (for integration). Test:
- Unique constraint violations (duplicate email per tenant, duplicate login_id per tenant)
- Soft-delete filter (deleted users excluded from default queries)
- Tenant isolation (queries only return tenant-scoped data)
- Pagination and sorting
- Case-insensitive email/login lookup
```

---

### PROMPT 07 – Identity Service: User CRUD + Lifecycle

```
Implement the complete User lifecycle service layer for innait-identity-service.

1. UserService:
   - createUser(CreateUserRequest) → UserResponse:
     * Validate uniqueness (email per tenant, employeeNo per tenant)
     * Create User entity with status PENDING or ACTIVE based on creation method
     * Auto-create Account with loginId = email (configurable)
     * Assign default roles per tenant policy (query POLICY_BINDINGS for tenant defaults)
     * Assign default groups per tenant policy
     * If password enabled: generate temporary password, set mustChangePassword=true
     * Publish user.created Kafka event
     * Publish account.role.assigned for each default role
     * Send welcome notification via NotificationService

   - updateUser(UUID userId, UpdateUserRequest) → UserResponse:
     * Track changed fields (compare old vs new)
     * Update entity
     * Publish user.updated with changed_fields, old_values, new_values
     * If department/designation/org_unit/manager changed: IGA JML-relevant event

   - getUserById(UUID userId) → UserResponse (frozen contract fields)
   - searchUsers(UserSearchCriteria, Pageable) → Page<UserResponse>

   - Status transitions (state machine validation):
     * activateAccount(accountId): PENDING → ACTIVE
     * suspendAccount(accountId, reason): ACTIVE → SUSPENDED, revoke all sessions
     * reactivateAccount(accountId): SUSPENDED → ACTIVE
     * lockAccount(accountId): auto from failed attempts → LOCKED
     * unlockAccount(accountId): LOCKED → ACTIVE, reset failedAttemptCount, clear lockedUntil
     * disableAccount(accountId): ACTIVE → DISABLED, revoke sessions
     * reenableAccount(accountId): DISABLED → ACTIVE
     * terminateAccount(accountId, reason): ANY → TERMINATED + cascade:
       - Revoke all active sessions (call Session Service)
       - Revoke all credentials (call Credential Service)
       - Remove all role assignments (source: SYSTEM_TERMINATION)
       - Remove all group memberships
       - Publish account.terminated with cascade_summary
     * softDeleteUser(userId): IS_DELETED=1, DELETED_AT=now, terminate all accounts
     * hardDeleteUser(userId): physical DELETE cascade (only if past retention period)
     * restoreUser(userId): IS_DELETED=0, DELETED_AT=null (grace period only)

2. RoleService:
   - CRUD for roles (tenant-scoped)
   - assignRoleToAccount(accountId, RoleAssignmentRequest): create AccountRoleMap, publish account.role.assigned
   - removeRoleFromAccount(accountId, roleId, RoleRemovalRequest): soft-remove (IS_ACTIVE=0), publish account.role.removed
   - getAccountRoles(accountId) → List<RoleAssignmentResponse> (frozen contract)
   - getEffectiveEntitlements(accountId) → List<EffectiveEntitlementResponse>: resolve from direct roles + group→role→entitlement chain
   - bulkAssignRole(roleId, List<accountIds>): batch assign
   - bulkRemoveRole(roleId, List<accountIds>): batch remove

3. GroupService: similar CRUD + member management + group-role mapping

4. BulkOperationService:
   - @Async bulk operations returning jobId
   - bulkCreateUsers(InputStream csv) → jobId
   - bulkStatusChange(List<accountIds>, targetStatus) → jobId
   - Job tracking: GET /api/v1/identity/jobs/{jobId} with progress, success/failure counts

5. DTOs (Request/Response matching OpenAPI spec):
   - CreateUserRequest, UpdateUserRequest, UserResponse (frozen fields)
   - RoleAssignmentRequest (frozen: role_id, assignment_source, assigned_by, reason, expiry_at)
   - RoleRemovalRequest (frozen: removed_by, reason, revocation_source)
   - AccountStatusChangeRequest (frozen: status, reason, changed_by)

Write comprehensive unit tests:
- UserService: all status transitions (valid and invalid), cascade on termination
- RoleService: assign, remove, duplicate prevention, effective entitlement resolution
- BulkOperationService: CSV parsing, error handling, progress tracking
- State machine: invalid transitions throw IllegalStateException
Use Mockito for repository mocks. Test each Kafka event published.
```

---

### PROMPT 08 – Identity Service: REST Controllers + Integration Tests

```
Implement REST controllers for innait-identity-service with full integration tests.

1. UserController (@RestController, @RequestMapping("/api/v1/identity/users")):
   - POST / → createUser (TENANT_ADMIN, USER_ADMIN)
   - GET /{userId} → getUserById (any authenticated)
   - PATCH /{userId} → updateUser (TENANT_ADMIN, USER_ADMIN)
   - DELETE /{userId} → softDeleteUser (SUPER_ADMIN, TENANT_ADMIN)
   - DELETE /{userId}?hard=true → hardDeleteUser (SUPER_ADMIN only)
   - POST /{userId}/restore → restoreUser (SUPER_ADMIN, TENANT_ADMIN)
   - GET / → searchUsers with query params (status, user_type, department, search, page, size)
   - POST /bulk → bulkCreateUsers (multipart CSV upload)
   - GET /export → exportUsers (CSV/XLSX format param)

2. AccountController (@RequestMapping("/api/v1/identity/accounts")):
   - PATCH /{accountId}/status → changeAccountStatus (frozen contract)
   - POST /{accountId}/unlock → unlockAccount (HELPDESK+)
   - GET /{accountId}/roles → getAccountRoles (frozen contract)
   - POST /{accountId}/roles → assignRole (frozen contract)
   - DELETE /{accountId}/roles/{roleId} → removeRole (frozen contract)
   - GET /{accountId}/entitlements → getEffectiveEntitlements (frozen contract)
   - POST /bulk/{action} → bulkStatusChange

3. RoleController (@RequestMapping("/api/v1/identity/roles")):
   - Full CRUD + GET /{roleId}/accounts, POST /{roleId}/entitlements, bulk assign/remove

4. GroupController (@RequestMapping("/api/v1/identity/groups")):
   - Full CRUD + member management + role mapping

5. JobController (@RequestMapping("/api/v1/identity/jobs")):
   - GET /{jobId} → job status with progress

6. AdminPermissionMatrix enforcement:
   - @PreAuthorize expressions matching the permission matrix from architecture doc
   - SUPER_ADMIN: all operations
   - TENANT_ADMIN: all except manage tenant settings and hard delete
   - USER_ADMIN: create/update users, activate/suspend, assign groups
   - HELPDESK: unlock accounts, reset passwords only

Write integration tests using @SpringBootTest + Testcontainers (Oracle + Kafka + Redis):
- Full user creation → role assignment → status changes → termination → audit trail
- Frozen API contract compliance: verify exact response field names and types
- Permission matrix: verify each role can/cannot access each endpoint
- Pagination, sorting, search
- Bulk operations: CSV import with validation errors
- Tenant isolation: user from TENANT_A cannot access TENANT_B resources
- Concurrent modification handling (optimistic locking)
Test each Kafka event is published correctly using embedded Kafka consumer.
```

---

### PROMPT 09 – Credential Service: Password + TOTP

```
Implement innait-credential-service for Password and TOTP credential management.

1. Password management:
   - PasswordCredentialService:
     * enrollPassword(accountId, rawPassword): hash with Spring Security Argon2PasswordEncoder (memory=65536 KB, iterations=3, parallelism=4), store in PASSWORD_CREDENTIALS
     * verifyPassword(accountId, rawPassword) → boolean: load active credential, verify hash, handle version migration
     * changePassword(accountId, oldPassword, newPassword): verify old, check password history (last N from PASSWORD_HISTORY), check policy compliance, store new, deactivate old, publish credential event
     * resetPassword(accountId, newPassword, forcedBy): admin-triggered, set mustChangePassword=true
     * getPasswordAge(accountId): for policy enforcement
   - Password policy compliance:
     * Validate against PASSWORD_POLICIES: min/max length, uppercase, lowercase, digit, special, dictionary check, breach check (HaveIBeenPwned API optional)
   - Password history:
     * Store last N password hashes in PASSWORD_HISTORY
     * Prevent reuse per history_count in policy

2. TOTP management:
   - TotpCredentialService:
     * beginEnrollment(accountId) → TotpEnrollmentResponse (secretUri for QR, manual entry key): generate random secret, encrypt with AES-256-GCM using KEK from Vault, store with status PENDING
     * confirmEnrollment(accountId, totpCode) → boolean: decrypt secret, verify TOTP code, activate credential, set isTotpEnabled=true on Account
     * verifyTotp(accountId, code) → boolean: decrypt secret, verify with time window (±1 step), track last used
     * revokeTotp(accountId, credentialId): set status REVOKED, update isTotpEnabled if last active
   - TOTP implementation:
     * RFC 6238 TOTP with HMAC-SHA1 (configurable SHA256/SHA512)
     * Default: 6 digits, 30-second period
     * Allow ±1 time step for clock drift
   - KEK management:
     * Read KEK from Vault path: secret/data/innait/kek
     * Track secret_kek_version per credential for key rotation
     * On KEK rotation: old version retained for decrypt, new version for encrypt

3. Backup codes:
   - BackupCodeService:
     * generate(accountId) → List<String> (10 codes, 8 chars each): hash with BCrypt, store
     * verify(accountId, code) → boolean: compare against unused codes, mark used
     * regenerate(accountId): invalidate old codes, generate new set
     * getRemainingCount(accountId) → int

4. REST Controllers:
   - POST /api/v1/credentials/password/enroll
   - POST /api/v1/credentials/password/verify (internal, called by Auth Orchestrator)
   - POST /api/v1/credentials/password/change
   - POST /api/v1/credentials/password/reset (admin)
   - POST /api/v1/credentials/totp/enroll → returns QR URI
   - POST /api/v1/credentials/totp/verify
   - DELETE /api/v1/credentials/totp/{credentialId}
   - POST /api/v1/credentials/backup-codes/generate
   - POST /api/v1/credentials/backup-codes/verify

Write unit tests:
- Argon2id hashing and verification (including version migration)
- Password policy validation (all rule combinations)
- Password history prevention
- TOTP generation, encryption/decryption with KEK, verification with time drift
- Backup code generation, hashing, verification, invalidation
- KEK version tracking

Integration tests:
- Full password lifecycle: enroll → verify → change → history check → reset
- TOTP lifecycle: enroll → QR → confirm → verify → revoke
- Backup code lifecycle: generate → use 3 → regenerate → old codes invalid
- Vault KEK retrieval (mock Vault in tests)
```

---

### PROMPT 10 – Credential Service: FIDO2/WebAuthn + SoftToken

```
Implement FIDO2/WebAuthn and SoftToken credential management in innait-credential-service.

1. FIDO2/WebAuthn (using WebAuthn4J):
   - FidoCredentialService:
     * beginRegistration(accountId, displayName) → PublicKeyCredentialCreationOptions JSON:
       - Generate challenge, store in Redis (fido:challenge:{txnId}, TTL 120s)
       - RP info: id=innait.io, name=InnaIT WIAM
       - User: id=accountId bytes, name=loginId, displayName
       - PubKeyCredParams: ES256 (-7), RS256 (-257)
       - Attestation: "direct"
       - AuthenticatorSelection: residentKey=preferred, userVerification=preferred
     * completeRegistration(accountId, PublicKeyCredential response):
       - Retrieve challenge from Redis
       - Use WebAuthn4J to validate attestation response
       - Extract COSE public key, AAGUID, sign count, transports
       - Store in FIDO_CREDENTIALS
       - Set isFidoEnabled=true on Account
       - Publish credential.enrolled event

     * beginAuthentication(accountId) → PublicKeyCredentialRequestOptions JSON:
       - Generate challenge, store in Redis
       - allowCredentials: list active FIDO credentials for account
     * completeAuthentication(accountId, PublicKeyCredential response) → boolean:
       - Retrieve challenge from Redis
       - Use WebAuthn4J to validate assertion
       - Verify sign count (must be > stored value)
       - Update sign count and last_used_at
       - Return true if valid

     * revokeCredential(accountId, credentialId): status=REVOKED
     * bulkRevoke(accountId): revoke all FIDO credentials
     * listCredentials(accountId): return credential metadata (no secrets)

2. SoftToken:
   - SoftTokenCredentialService:
     * provision(accountId, devicePlatform) → SoftTokenProvisionResponse:
       - Generate device_id (UUID)
       - Generate ECDSA key pair
       - Store public key in SOFTTOKEN_CREDENTIALS with status PENDING
       - Return provisioning QR data (device_id, activation_url, public_key)
     * activate(deviceId, activationCode, pushToken) → boolean:
       - Verify activation code
       - Store push token (FCM/APNs/HMS)
       - Set activation_status = ACTIVE
       - Set isSofttokenEnabled=true on Account
     * sendPushChallenge(accountId) → String challengeId:
       - Select active SoftToken for account
       - Generate challenge nonce, store in Redis (TTL 60s)
       - Send push notification via FCM/APNs with challenge data
       - Return challengeId for polling
     * verifyPushResponse(challengeId, signedResponse) → boolean:
       - Retrieve challenge from Redis
       - Verify ECDSA signature using stored public key
       - Return verification result
     * suspend/revoke/reprovision operations

3. REST Controllers:
   - POST /api/v1/credentials/fido/register/begin
   - POST /api/v1/credentials/fido/register/complete
   - POST /api/v1/credentials/fido/authenticate/begin
   - POST /api/v1/credentials/fido/authenticate/complete
   - DELETE /api/v1/credentials/fido/{credentialId}
   - GET /api/v1/credentials/fido → list credentials
   - POST /api/v1/credentials/softtoken/provision
   - POST /api/v1/credentials/softtoken/activate
   - POST /api/v1/credentials/softtoken/challenge
   - POST /api/v1/credentials/softtoken/verify
   - DELETE /api/v1/credentials/softtoken/{credentialId}
   - DELETE /api/v1/credentials/{type}/{credentialId} → generic revoke

Write unit tests:
- WebAuthn4J registration and authentication ceremony mocking
- Challenge generation, Redis storage, expiry
- Sign count verification (replay protection)
- SoftToken provisioning, key pair generation
- ECDSA signature generation and verification
- Push notification payload construction

Integration tests:
- Full FIDO2 registration + authentication flow with WebAuthn4J test utilities
- SoftToken provision → activate → challenge → verify → revoke
- Credential listing and bulk revocation
- Redis challenge lifecycle (create, retrieve, expire)
```

---

### PROMPT 11 – Auth Orchestrator: State Machine + Login Flows

```
Implement innait-auth-orchestrator with Spring State Machine for authentication flows.

1. Auth State Machine:
   - States: INITIATED, PRIMARY_CHALLENGE, PRIMARY_VERIFIED, MFA_CHALLENGE, MFA_VERIFIED, COMPLETED, FAILED, ABORTED
   - Events: LOGIN_ID_SUBMITTED, PRIMARY_CHALLENGE_ISSUED, PRIMARY_FACTOR_VERIFIED, PRIMARY_FACTOR_FAILED, MFA_CHALLENGE_ISSUED, MFA_FACTOR_VERIFIED, MFA_FACTOR_FAILED, AUTH_COMPLETED, AUTH_ABORTED, TIMEOUT
   - Transitions:
     INITIATED → PRIMARY_CHALLENGE (on LOGIN_ID_SUBMITTED)
     PRIMARY_CHALLENGE → PRIMARY_VERIFIED (on PRIMARY_FACTOR_VERIFIED)
     PRIMARY_CHALLENGE → FAILED (on PRIMARY_FACTOR_FAILED + max retries)
     PRIMARY_VERIFIED → MFA_CHALLENGE (when MFA required by policy)
     PRIMARY_VERIFIED → COMPLETED (when MFA not required)
     MFA_CHALLENGE → MFA_VERIFIED (on MFA_FACTOR_VERIFIED)
     MFA_CHALLENGE → FAILED (on MFA_FACTOR_FAILED + max retries)
     MFA_VERIFIED → COMPLETED (on AUTH_COMPLETED)
     Any → ABORTED (on TIMEOUT after 5 min)

2. AuthOrchestrationService:
   - initiateAuth(loginId, channelType, sourceIp, userAgent):
     * Resolve account from Identity Service (by loginId)
     * Verify account status (must be ACTIVE)
     * Create AUTH_TRANSACTIONS record in Oracle
     * Cache auth state in Redis (authn:txn:{txnId}, TTL 5 min)
     * Call Policy Service to determine required auth methods
     * Publish auth.started event
     * Return: txnId, available primary methods

   - submitPrimaryFactor(txnId, factorType, factorData):
     * Load state from Redis
     * Route to appropriate Credential Service method:
       - PASSWORD: call credentialService.verifyPassword()
       - FIDO: call credentialService.beginAuthentication() / completeAuthentication()
     * On success: transition to PRIMARY_VERIFIED, check if MFA required
     * On failure: increment attempt count, check lockout policy
       - If lockout threshold reached: lock account, publish auth.failed
     * Update Redis state and Oracle AUTH_TRANSACTIONS

   - submitMfaFactor(txnId, factorType, factorData):
     * Load state, verify in MFA_CHALLENGE state
     * Route to MFA verification:
       - TOTP: call credentialService.verifyTotp()
       - FIDO: (if used as second factor)
       - SOFTTOKEN: call credentialService.verifyPushResponse()
       - BACKUP_CODE: call credentialService.verifyBackupCode()
     * On success: transition to COMPLETED
     * Create session (call Session Service)
     * Issue JWT (call Token Service)
     * Publish auth.succeeded event
     * Update account lastLoginAt, lastLoginIp

   - getAuthStatus(txnId): return current state for client polling

   - Account lockout logic:
     * Track failedAttemptCount per account
     * When threshold exceeded (from PASSWORD_POLICIES):
       - Set LOCKED_UNTIL = now + lockout_duration
       - Set account status to LOCKED
       - Publish account.status.changed

3. Login flow controllers:
   - POST /api/v1/auth/login/initiate → {txnId, primaryMethods[]}
   - POST /api/v1/auth/login/primary → {txnId, state, mfaMethods[] or tokens}
   - POST /api/v1/auth/login/mfa → {txnId, state, tokens}
   - GET /api/v1/auth/login/{txnId}/status → {state}
   - POST /api/v1/auth/login/{txnId}/abort → cancel

4. Step-up authentication:
   - For sensitive operations (password change, credential enrollment):
   - POST /api/v1/auth/step-up/initiate → requires re-authentication
   - Verified via session.acr_level

Write unit tests:
- State machine: all valid transitions, invalid transition rejection
- Auth orchestration: password + TOTP flow, FIDO passwordless flow, SoftToken push flow
- Lockout logic: threshold, auto-unlock timer, manual unlock
- Policy resolution: different MFA requirements per policy binding
- Timeout/abort handling

Integration tests:
- End-to-end: initiate → primary (password) → MFA (TOTP) → session + JWT
- End-to-end: FIDO2 passwordless (primary + MFA in one step)
- Lockout: 5 failed attempts → locked → auto-unlock after duration
- Concurrent auth transactions for same account
- Redis state management: create, update, expire
```

---

### PROMPT 12 – Session, Token & Policy Services

```
Implement innait-session-service, innait-token-service, and innait-policy-service.

--- SESSION SERVICE ---

1. SessionService:
   - createSession(accountId, authTxnId, authMethodsUsed, acrLevel, sessionType, sessionContext):
     * Create SESSIONS record in Oracle
     * Create SESSION_CONTEXT record (IP, userAgent, geoCountry, etc.)
     * Cache session in Redis: session:{tenantId}:{sessionId}
     * Enforce max concurrent sessions per account (from system settings)
     * If exceeded: revoke oldest session (LRU)
     * Publish session.created event
     * Return sessionId
   - getSession(sessionId): load from Redis, fallback to Oracle
   - refreshSession(sessionId): extend expiry, create new REFRESH_TOKEN
   - revokeSession(sessionId, reason, revokedBy): set REVOKED, remove from Redis, publish
   - revokeAllSessions(accountId, reason): bulk revoke for termination/suspension
   - listActiveSessions(accountId) → List<SessionResponse>

2. Refresh token rotation:
   - REFRESH_TOKENS with token_family for replay detection
   - On refresh: mark old token used, generate new token in same family
   - If used token is reused: revoke entire token family (breach detection)

3. REST Controllers:
   - GET /api/v1/sessions/{sessionId}
   - DELETE /api/v1/sessions/{sessionId} (revoke)
   - GET /api/v1/sessions/account/{accountId} (list active)
   - PATCH /api/v1/sessions/{sessionId}/device-context (for future Device Trust)

--- TOKEN SERVICE ---

4. TokenService (using Nimbus JOSE+JWT):
   - issueAccessToken(sessionId, accountId, tenantId, roles, groups) → JWT:
     * Claims: sub=accountId, tenant_id, user_id, login_id, session_id, amr[], acr, roles[], groups[], iat, exp
     * Signing: RS256 using private key from Vault
     * TTL: from system settings (default 900s)
   - issueRefreshToken(sessionId) → opaque token (hashed, stored in REFRESH_TOKENS)
   - validateToken(jwt) → claims or throw
   - getJwks() → JWKS response (public keys for verification)
   - Key rotation:
     * Dual-key overlap: new key signs, old key verifies for 24h
     * Key ID (kid) in JWT header for key selection

5. REST Controllers:
   - POST /api/v1/tokens/issue (internal, called by Auth Orchestrator)
   - POST /api/v1/tokens/refresh
   - GET /.well-known/jwks.json → JWKS endpoint
   - POST /api/v1/tokens/revoke

--- POLICY SERVICE ---

6. PolicyService (SpEL-based):
   - resolvePasswordPolicy(accountId) → PasswordPolicy: resolve from binding hierarchy (account > group > role > tenant)
   - resolveMfaPolicy(accountId) → MfaPolicy: same resolution
   - resolveAuthPolicy(accountId, context) → AuthPolicyResult: evaluate SpEL rules
   - Policy binding resolution order: most specific wins (account > group > role > application > tenant)
   - Cache resolved policies in Redis (TTL 60s)

7. PolicyAdminService:
   - CRUD for PASSWORD_POLICIES, MFA_POLICIES, AUTH_POLICIES
   - CRUD for POLICY_BINDINGS (bind policy to target type + ID)
   - Policy simulator: given accountId, show which policies resolve

8. REST Controllers:
   - GET /api/v1/policies/resolve/password?accountId=...
   - GET /api/v1/policies/resolve/mfa?accountId=...
   - GET /api/v1/policies/resolve/auth?accountId=...&context=...
   - Full CRUD: /api/v1/policies/password/*, /api/v1/policies/mfa/*, /api/v1/policies/auth/*
   - POST /api/v1/policies/simulate → show resolved policies for account

Write unit tests per service:
- Session: creation, concurrent limit enforcement, refresh token rotation, family revocation
- Token: JWT issuance, claim assembly, signature, expiry, JWKS generation, key rotation
- Policy: binding resolution hierarchy, SpEL evaluation, cache hit/miss

Integration tests:
- Session + Redis: create, cache, retrieve, revoke, TTL expiry
- Token + Vault: key retrieval, signing, verification
- Policy resolution: multiple bindings, priority ordering, cache invalidation
```

---
## PHASE 2: SHARED PLATFORM SERVICES (Prompts 13–20)

---

### PROMPT 13 – Audit & Event Service

```
Implement innait-audit-service as a Kafka consumer that persists immutable audit events to Oracle.

1. Audit Kafka Consumer:
   - AuditEventConsumer @KafkaListener subscribing to ALL core topics:
     innait.identity.*, innait.credential.*, innait.authn.*, innait.session.*, innait.policy.*, innait.admin.*
   - Consumer group: innait-core-audit
   - auto.offset.reset: earliest, enable.auto.commit: false
   - On each event: map EventEnvelope to AUDIT_EVENTS record:
     * audit_event_id: new UUID
     * tenant_id, correlation_id from envelope
     * event_type, event_category (derive category from topic: authn.* → AUTHENTICATION, credential.* → CREDENTIAL, etc.)
     * actor_id, actor_type from envelope
     * action: derive from event_type (user.created → CREATE, account.role.assigned → ASSIGN)
     * result: SUCCESS (most events) or FAILURE (auth.failed)
     * detail: serialize full payload as JSON CLOB
     * service_name: derive from topic prefix
     * event_time: from envelope timestamp
   - Batch insert: accumulate up to 500 events or 5-second window, then batch INSERT

2. In-memory buffer for Kafka failures:
   - If Kafka consumer fails: buffer events in ConcurrentLinkedQueue (max 10,000, 5 min retention)
   - On reconnect: flush buffer to Oracle before resuming Kafka consumption
   - Health indicator: WARN if buffer > 0, CRITICAL if buffer > 5,000

3. AdminActionLogger:
   - Called by Admin BFF for all admin operations
   - Stores in ADMIN_ACTIONS with old_values / new_values JSON diff
   - Uses Jackson ObjectMapper to compute field-level diff

4. SecurityIncidentDetector:
   - Monitors auth.failed events for patterns:
     * Brute force: > 10 failures from same IP in 5 min → create SECURITY_INCIDENT
     * Credential stuffing: > 50 distinct accounts targeted from same IP → create SECURITY_INCIDENT
     * Impossible travel: auth from 2 geos > 500km apart within 30 min → create SECURITY_INCIDENT
   - Uses Redis counters for real-time pattern detection

5. Audit Query Service:
   - GET /api/v1/audit/events?category=&type=&actorId=&subjectId=&fromTime=&toTime=&page=&size=
   - GET /api/v1/audit/admin-actions?targetType=&targetId=&page=&size=
   - GET /api/v1/audit/security-incidents?severity=&status=&page=&size=
   - Read-only access, tenant-scoped via VPD
   - Uses jOOQ for complex queries with partition pruning on EVENT_TIME

6. Retention management:
   - @Scheduled nightly job: check configurable retention per event_category per tenant
   - Drop Oracle partitions older than retention period
   - Flashback Archive retains beyond partition drop

Write unit tests:
- Event-to-audit mapping for each event type
- Category derivation logic
- Admin action JSON diff computation
- Security incident detection patterns (brute force, credential stuffing)
- Buffer overflow handling

Integration tests:
- Kafka consume → Oracle persist → query retrieve end-to-end
- Buffer activation on simulated Kafka failure
- Partition-pruned queries on time-range filters
- Correlation ID tracing across multiple events
```

---

### PROMPT 14 – Notification Service

```
Implement innait-notification-service for email, SMS, and push notifications.

1. NotificationService:
   - sendEmail(tenantId, to, templateKey, templateVariables) → void
   - sendSms(tenantId, to, templateKey, templateVariables) → void
   - sendPush(tenantId, deviceToken, pushProvider, title, body, data) → void

2. Template engine:
   - NotificationTemplateService:
     * Templates stored in INNAIT_CONFIG.SYSTEM_SETTINGS or DB table
     * Per-tenant customizable templates (override defaults)
     * Template keys: welcome_email, otp_email, otp_sms, password_reset, account_locked, account_suspended, credential_enrolled, mfa_reminder
     * Variable substitution: {{displayName}}, {{otpCode}}, {{expiryMinutes}}, {{loginUrl}}, {{tenantName}}
     * Thymeleaf template engine for HTML emails

3. Email provider:
   - Spring Mail (JavaMailSender) for SMTP
   - Configurable per tenant via CONNECTORS table (connector_type: EMAIL_SMTP or EMAIL_API)
   - SendGrid/SES integration for API-based email

4. SMS provider:
   - REST client for SMS gateway
   - Configurable per tenant via CONNECTORS table (connector_type: SMS_GATEWAY)
   - Rate limiting: max 5 SMS per account per hour

5. Push provider:
   - FCM (Firebase Cloud Messaging) for Android
   - APNs for iOS
   - HMS for Huawei
   - Route based on SOFTTOKEN_CREDENTIALS.push_provider

6. Kafka consumer for notification triggers:
   - Subscribes to: user.created (welcome email), credential.enrolled, credential.revoked
   - Consumer group: innait-core-notification

7. REST Controllers (admin-facing):
   - GET /api/v1/notifications/templates → list templates
   - PUT /api/v1/notifications/templates/{templateKey} → update template
   - POST /api/v1/notifications/test → send test notification

Write unit tests:
- Template variable substitution (all templates)
- Email composition with HTML/plain text
- SMS message formatting with character limits
- Push payload construction for FCM/APNs/HMS
- Rate limiting enforcement

Integration tests:
- Email sending via GreenMail (embedded SMTP)
- SMS via WireMock (mock gateway)
- Template override per tenant
- Kafka trigger → notification sent
```

---

### PROMPT 15 – Admin/Config Service + Tenant Management

```
Implement innait-admin-config-service for tenant lifecycle, feature flags, connectors, and system settings.

1. TenantService:
   - createTenant(CreateTenantRequest) → TenantResponse: create TENANTS record, initialize default policies, clone feature flags from template, create default SUPER_ADMIN account
   - updateTenant(tenantId, UpdateTenantRequest)
   - getTenant(tenantId), listTenants(pageable)
   - Domain management: addDomain, verifyDomain (DNS TXT check), removeDomain, setPrimaryDomain
   - OrgUnit management: CRUD for organizational hierarchy

2. FeatureFlagService:
   - getFlag(tenantId, flagKey) → boolean (cached in Redis, TTL 60s)
   - setFlag(tenantId, flagKey, value): update DB, invalidate cache, publish event
   - listFlags(tenantId) → Map<String, Boolean>
   - Toggle: self_registration_enabled, passwordless_enabled, softtoken_enabled, iga_enabled, device_trust_enabled, federation_enabled, risk_based_auth_enabled, bulk_operations_enabled, dpdp_erasure_enabled

3. ConnectorService:
   - CRUD for connectors (LDAP, AD, SCIM, email, SMS)
   - testConnector(connectorId) → TestResult: attempt connection with stored config
   - Encrypted config storage: encrypt with Vault transit engine before storing in ENCRYPTED_CONFIG

4. SystemSettingsService:
   - getSetting(tenantId, key) → global or tenant override (tenant > global)
   - setSetting(tenantId, key, value): create tenant override
   - listSettings(tenantId) → merged global + tenant overrides

5. ApplicationService:
   - CRUD for application registry (used by IGA for entitlement-to-application mapping)

6. REST Controllers:
   - /api/v1/admin/tenants/* (SUPER_ADMIN only)
   - /api/v1/admin/tenants/{tenantId}/domains/*
   - /api/v1/admin/tenants/{tenantId}/org-units/*
   - /api/v1/admin/features/* (TENANT_ADMIN+)
   - /api/v1/admin/connectors/* (TENANT_ADMIN+)
   - /api/v1/admin/settings/* (TENANT_ADMIN+)
   - /api/v1/admin/applications/* (TENANT_ADMIN+)

Write unit tests:
- Tenant creation with all default data (policies, flags, admin account)
- Feature flag caching and invalidation
- Setting resolution hierarchy (tenant override > global)
- Connector config encryption/decryption
- Domain DNS verification logic

Integration tests:
- Full tenant lifecycle: create → configure → domains → org hierarchy
- Feature flag toggle → cache invalidation → consumer reads new value
- Connector test (LDAP mock via UnboundID in-memory server)
```

---

### PROMPT 16 – API Gateway (Spring Cloud Gateway)

```
Implement innait-api-gateway using Spring Cloud Gateway with reactive stack.

1. Gateway routes:
   - /api/v1/auth/** → auth-orchestrator
   - /api/v1/identity/** → identity-service
   - /api/v1/credentials/** → credential-service
   - /api/v1/sessions/** → session-service
   - /api/v1/tokens/** → token-service
   - /api/v1/policies/** → policy-service
   - /api/v1/audit/** → audit-service
   - /api/v1/admin/** → admin-config-service
   - /api/v1/self/** → admin-bff (self-service)
   - /api/v1/notifications/** → notification-service

2. Filters:
   - TenantResolutionFilter (pre):
     * Extract tenant from subdomain ({tenant}.api.innait.io) or X-Tenant-ID header
     * Validate against INNAIT_TENANT.TENANTS
     * Add X-Tenant-ID header to downstream request
   - JwtValidationFilter (pre):
     * Validate JWT signature via JWKS endpoint (cached)
     * Extract claims, add as headers: X-User-ID, X-Account-ID, X-Tenant-ID, X-Roles
     * Skip for public endpoints (/auth/login/*, /tokens/refresh, /.well-known/*)
   - RateLimitFilter (pre):
     * Per-IP rate limiting: configurable limit (default 10/min for login, 100/min for API)
     * Per-tenant rate limiting: configurable TPS
     * Uses Redis (ratelimit:{tenantId}:{ip})
     * Return 429 Too Many Requests with Retry-After header
   - CorrelationIdFilter (pre):
     * Generate or propagate X-Correlation-ID header
   - ResponseHeaderFilter (post):
     * Remove server version headers
     * Add security headers: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
     * Add Cache-Control: no-store for API responses
   - RequestLoggingFilter (pre/post):
     * Log: method, path, tenant, accountId, status, latency
     * Exclude sensitive paths from body logging

3. CORS configuration:
   - Per-tenant allowed origins (loaded from TENANT_DOMAINS)
   - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
   - Headers: Authorization, Content-Type, X-Tenant-ID, X-Correlation-ID
   - Credentials: true

4. Circuit breaker:
   - Resilience4j circuit breaker per downstream service
   - Fallback: 503 Service Unavailable with error envelope
   - Retry: 1 retry for 5xx errors (not for 4xx)

5. Health aggregation:
   - /actuator/health aggregates all downstream service health checks
   - Custom HealthIndicator for each downstream service

6. application.yml routes with predicates and filters

Write unit tests:
- Tenant resolution from subdomain and header
- JWT validation (valid, expired, invalid signature)
- Rate limiting (within limit, exceeded, window reset)
- CORS validation (allowed origin, disallowed origin)
- Correlation ID generation and propagation

Integration tests:
- Full request routing: gateway → service → response
- Rate limit enforcement with concurrent requests
- Circuit breaker activation and recovery
- Health endpoint aggregation
```

---

### PROMPT 17 – Admin BFF (Backend for Frontend)

```
Implement innait-admin-bff as the BFF layer for Angular Admin Console and Self-Service Portal.

1. Admin BFF endpoints aggregate multiple service calls:
   - GET /api/v1/bff/dashboard:
     * Parallel calls: Identity Service (user counts by status), Session Service (active session count), Audit Service (last 10 admin actions), Auth Orchestrator (auth success/fail rates)
     * Return: DashboardResponse with all widget data
   - GET /api/v1/bff/users/{userId}/detail:
     * Parallel calls: Identity (user profile), Identity (accounts), Identity (roles + groups), Credential (credential overview), Session (active sessions), Audit (user audit trail)
     * Return: UserDetailResponse with all tabs data

2. Self-service endpoints:
   - GET /api/v1/self/profile → current user profile
   - PATCH /api/v1/self/profile → update own profile (limited fields)
   - PATCH /api/v1/self/profile/email → change email with OTP verification
   - POST /api/v1/self/credentials/password/change → change own password
   - POST /api/v1/self/credentials/totp/enroll → enroll TOTP
   - POST /api/v1/self/credentials/fido/register → register FIDO key
   - GET /api/v1/self/sessions → list own active sessions
   - DELETE /api/v1/self/sessions/{sessionId} → revoke own session
   - GET /api/v1/self/activity → own audit trail

3. CSRF protection for BFF (Angular SPA):
   - CsrfTokenRequestHandler with CookieCsrfTokenRepository (HttpOnly=false for Angular HttpXsrfInterceptor)
   - Double-submit cookie pattern

4. File handling:
   - POST /api/v1/bff/users/import → accept CSV/XLSX, validate, delegate to Identity Service bulk API
   - GET /api/v1/bff/users/export → stream CSV/XLSX response
   - POST /api/v1/bff/reports/compliance → generate compliance report PDF

5. WebSocket for real-time:
   - /ws/admin/notifications → push admin alerts (new security incidents, lockout spikes)
   - Spring WebSocket with STOMP

Write unit tests:
- Dashboard aggregation (mock all service calls)
- Self-service permission enforcement (user can only access own data)
- CSRF token flow
- File upload validation (CSV format, required columns, max rows)

Integration tests:
- End-to-end: BFF → multiple services → aggregated response
- Self-service: profile view/edit, password change, session revoke
- File import: CSV upload → bulk create → progress tracking
```

---

### PROMPT 18 – Directory Connector (LDAP/AD)

```
Implement innait-directory-connector for LDAP/AD synchronization.

1. LdapSyncService:
   - fullSync(connectorId): query all users from LDAP, compare with InnaIT WIAM, create/update/disable
   - incrementalSync(connectorId): query changes since last sync (using uSNChanged or modifyTimestamp)
   - Mapping: LDAP attributes → InnaIT WIAM user fields (configurable per connector):
     * sAMAccountName → loginId
     * mail → email
     * givenName → firstName, sn → lastName
     * displayName → displayName
     * department → department
     * title → designation
     * employeeNumber → employeeNo
     * manager → managerUserId (resolve via DN lookup)
   - On sync: call Identity Service APIs (not direct DB write)
   - Assignment source: SYNC

2. Spring LDAP integration:
   - LdapContextSource configured from CONNECTORS table
   - TLS/SSL support, connection pooling
   - Encrypted bind credentials from Vault

3. Sync scheduler:
   - @Scheduled via cron expression from CONNECTORS.sync_schedule_cron
   - Track: last_sync_at, last_sync_status, records_created/updated/disabled/errors

4. SCIM 2.0 endpoint (for HR system push):
   - POST /scim/v2/Users → create user
   - PUT /scim/v2/Users/{id} → replace user
   - PATCH /scim/v2/Users/{id} → partial update
   - DELETE /scim/v2/Users/{id} → deactivate user
   - GET /scim/v2/Users?filter=... → search
   - SCIM schema compliance (User, Group resources)

5. REST Controllers:
   - POST /api/v1/connectors/{connectorId}/sync/full → trigger full sync
   - POST /api/v1/connectors/{connectorId}/sync/incremental → trigger incremental
   - GET /api/v1/connectors/{connectorId}/sync/status → last sync results
   - POST /api/v1/connectors/{connectorId}/test → test connectivity

Write unit tests:
- LDAP attribute mapping (all field combinations)
- User diff computation (new, changed, removed)
- SCIM request parsing and response formatting

Integration tests:
- LDAP sync using UnboundID in-memory LDAP server:
  * Pre-populate LDAP with 100 users
  * Run full sync → verify all created in Identity Service (mocked)
  * Modify 10 users in LDAP → incremental sync → verify updates
  * Disable 5 users in LDAP → sync → verify deactivated
- SCIM endpoint tests: create, update, delete, search
```

---

### PROMPT 19 – Self-Service Password Flows

```
Implement forgot-password and account-recovery flows.

1. ForgotPasswordService:
   - POST /api/v1/self/credentials/password/forgot:
     * Accept email/loginId
     * Timing-safe: always return 200 OK (never reveal if account exists)
     * If account found: generate OTP, send via email/SMS
     * OTP stored in Redis: otp:forgot:{accountId} TTL 300s
   - POST /api/v1/self/credentials/password/forgot/verify:
     * Verify OTP from Redis
     * Return one-time reset token (JWT with short TTL, specific audience)
   - POST /api/v1/self/credentials/password/forgot/reset:
     * Validate reset token
     * Set new password (enforce policy)
     * Clear mustChangePassword flag
     * Revoke all existing sessions
     * Publish credential event

2. AccountRecoveryService:
   - POST /api/v1/self/recovery:
     * Accept backup code
     * Verify via BackupCodeService
     * If valid: generate session with reduced ACR level
     * Redirect to MFA re-enrollment flow
   - This is the last-resort path when user loses all MFA devices

3. First-time onboarding flow:
   - Detected when: account status=PENDING or mustChangePassword=true or no MFA enrolled
   - POST /api/v1/self/onboarding/accept-terms → mark terms accepted
   - POST /api/v1/self/onboarding/set-password → initial password set
   - POST /api/v1/self/onboarding/enroll-mfa → trigger MFA enrollment
   - POST /api/v1/self/onboarding/complete → activate account if PENDING

Write unit tests:
- Forgot password: timing-safe response, OTP generation, rate limiting
- Account recovery: backup code verification, reduced ACR session
- Onboarding: state tracking, mandatory step enforcement

Integration tests:
- Full forgot password flow: request → email OTP → verify → reset → login with new password
- Account recovery: backup code → reduced session → MFA re-enroll
- Onboarding wizard: terms → password → MFA → complete → normal login
```

---

### PROMPT 20 – Comprehensive Backend Unit Test Suite

```
Create a comprehensive unit test suite covering all backend services with minimum 80% code coverage.

1. Test infrastructure:
   - TestSecurityConfig: mock JWT authentication for @WebMvcTest
   - TestTenantContext: utility to set/clear tenant context in tests
   - TestDataFactory: factory methods for creating test entities with realistic data:
     * createTestUser(overrides), createTestAccount(overrides)
     * createTestRole(), createTestGroup(), createTestEntitlement()
     * createTestPasswordPolicy(), createTestMfaPolicy()
     * All with random UUIDs and tenant-scoped

2. Unit tests per service (using Mockito):
   Identity Service:
   - UserServiceTest: 25+ tests covering create, update, all status transitions, soft/hard delete, restore, bulk
   - RoleServiceTest: CRUD, assign/remove, effective entitlement resolution (direct + group chain)
   - GroupServiceTest: CRUD, member management, role mapping

   Credential Service:
   - PasswordCredentialServiceTest: enroll, verify, change, history check, policy validation (15+ tests)
   - TotpCredentialServiceTest: enroll, confirm, verify (with time drift), revoke, KEK version handling
   - FidoCredentialServiceTest: register begin/complete, authenticate begin/complete, sign count validation
   - SoftTokenCredentialServiceTest: provision, activate, push challenge, verify signature
   - BackupCodeServiceTest: generate, verify, use, regenerate, count remaining

   Auth Orchestrator:
   - AuthOrchestrationServiceTest: all flows (pwd+TOTP, FIDO, SoftToken), lockout, timeout, abort
   - StateMachineTest: all valid transitions, all invalid transition rejections

   Session Service:
   - SessionServiceTest: create, refresh, revoke, max concurrent enforcement, token family rotation

   Token Service:
   - TokenServiceTest: issue, validate, expired, tampered, JWKS generation, key rotation overlap

   Policy Service:
   - PolicyServiceTest: resolution hierarchy (account > group > role > tenant), SpEL evaluation, cache

   Audit Service:
   - AuditEventConsumerTest: mapping for each event type, batch insertion, buffer handling
   - SecurityIncidentDetectorTest: brute force pattern, credential stuffing pattern

   Admin/Config Service:
   - TenantServiceTest: creation with defaults, domain management, DNS verification
   - FeatureFlagServiceTest: get/set with cache, invalidation
   - SystemSettingsServiceTest: global vs tenant override resolution

3. Controller unit tests (@WebMvcTest):
   - Each controller: test all endpoints with valid/invalid input, permission checks, response format
   - Verify ApiResponse envelope wrapping
   - Verify HTTP status codes match architecture spec

4. Coverage enforcement:
   - JaCoCo maven plugin configuration
   - Minimum thresholds: 80% line coverage, 75% branch coverage
   - Exclude: DTOs, configs, constants from coverage calculation

Generate test reports: mvn test jacoco:report → target/site/jacoco/index.html
```

---
## PHASE 3: ANGULAR 18+ FRONTEND (Prompts 21–35)

---

### PROMPT 21 – Angular Workspace Scaffold + Shared Libraries

```
Create an Angular 18+ monorepo workspace for InnaIT WIAM using Angular CLI.

Workspace: innait-wiam-ui
Applications:
- login-portal (standalone app, minimal bundle < 200KB)
- self-service-portal (standalone app, < 300KB initial)
- admin-console (standalone app, < 500KB initial)

Shared libraries (Angular library projects):
- @innait/core: HttpClient interceptors, auth service, tenant service, error handler, models
- @innait/ui: shared UI components (form controls, tables, charts, loading states)
- @innait/i18n: i18n service with English, Hindi, Tamil translation files

Setup:
- TypeScript 5.4+ strict mode (strict: true, strictNullChecks, noImplicitAny, noUncheckedIndexedAccess)
- Angular SSR disabled (pure SPA)
- Tailwind CSS (NO – use Angular Material or PrimeNG for enterprise consistency)
- PrimeNG 17+ for UI components (data tables, dialogs, menus, charts)
- ag-Grid for complex data tables (User List, Audit Log)
- ng2-charts (Chart.js wrapper) for dashboard visualizations
- ESLint + Prettier configured

@innait/core library:
1. AuthService:
   - login(loginId) → initiate auth flow
   - submitPrimary(txnId, type, data) → submit primary factor
   - submitMfa(txnId, type, data) → submit MFA
   - refreshToken() → call /api/v1/tokens/refresh
   - logout() → revoke session, clear state
   - getAuthState() → Observable<AuthState>
   - Token stored in HttpOnly cookie (set by server, not JS-accessible)

2. HttpInterceptors:
   - AuthInterceptor: add CSRF token from cookie (XSRF-TOKEN)
   - TenantInterceptor: add X-Tenant-ID header from TenantService
   - CorrelationInterceptor: add X-Correlation-ID header (UUID per request)
   - ErrorInterceptor: handle 401 → redirect login, 403 → denied page, 5xx → retry/error toast
   - LoadingInterceptor: track pending requests for global loading indicator

3. TenantService:
   - Extract tenant from subdomain: {tenant}.auth.innait.io or {tenant}.admin.innait.io
   - Store in BehaviorSubject, available app-wide
   - Load tenant branding after resolution (logo, colors, language)

4. Route Guards:
   - AuthGuard (canActivate): check authenticated, redirect to /login if not
   - RoleGuard: check user has required role(s)
   - MfaGuard: check session ACR level for sensitive operations
   - PermissionGuard: check specific permission

5. Models (matching OpenAPI spec):
   - ApiResponse<T>, PaginationMeta, ErrorDetail
   - User, Account, Role, Group, Entitlement, Session, AuditEvent
   - All frozen contract DTOs

6. Global ErrorHandler:
   - extends ErrorHandler
   - Log errors to console (dev) or remote logging endpoint (prod)
   - Display toast notification for user-facing errors

Write unit tests (Jasmine + Karma):
- AuthService: login flow state management, token refresh, logout cleanup
- HttpInterceptors: header injection, error handling, retry logic
- TenantService: subdomain extraction, branding load
- Guards: authenticated/unauthenticated redirects, role checking
```

---

### PROMPT 22 – Login Portal: 13 Screens

```
Implement the Login Portal Angular application (13 screens).

Routes:
/ → TenantInputComponent (auto-detect from URL or email domain)
/login → LoginIdFormComponent
/login/password → PasswordFormComponent
/login/fido → FidoAuthComponent
/login/totp → TotpInputComponent
/login/softtoken → SoftTokenWaitComponent
/login/backup-code → BackupCodeFormComponent
/login/mfa-select → MfaMethodSelectorComponent
/login/complete → AuthSuccessRedirectComponent
/login/locked → AccountLockedComponent
/login/password-expired → PasswordExpiredComponent
/login/onboarding → OnboardingWizardComponent
/login/error → ErrorPageComponent

Implement each screen:

1. TenantInputComponent: email/domain input → resolve tenant → load branding → navigate to /login
2. LoginIdFormComponent:
   - Input: login ID (email or username)
   - Call: POST /api/v1/auth/login/initiate
   - Show available primary methods → navigate to appropriate challenge screen
   - Security: autocomplete="username", no credential caching
3. PasswordFormComponent:
   - Input: password field with show/hide toggle, caps lock indicator
   - Call: POST /api/v1/auth/login/primary {type: PASSWORD, data: password}
   - On success: navigate to MFA or complete
   - On failure: show error, track attempts
4. FidoAuthComponent:
   - Call navigator.credentials.get() with options from server
   - WebAuthn API integration with platform authenticator detection
   - Fallback message if WebAuthn not supported
5. TotpInputComponent:
   - 6-digit input with auto-advance between fields
   - Countdown timer showing remaining validity
   - Auto-submit on 6th digit
6. SoftTokenWaitComponent:
   - Show "Waiting for approval on your device" with animation
   - Poll /api/v1/auth/login/{txnId}/status every 2 seconds
   - Timeout after 60 seconds with retry option
7. BackupCodeFormComponent: single text input for 8-character code
8. MfaMethodSelectorComponent: card-based selection of available MFA methods
9. AuthSuccessRedirectComponent: brief success message → redirect to requested URL
10. AccountLockedComponent: lockout message with countdown timer, admin contact info
11. PasswordExpiredComponent: force-change form with policy validation, strength meter
12. OnboardingWizardComponent: multi-step wizard (accept terms → set password → enroll MFA → test MFA → backup codes → complete)
13. ErrorPageComponent: contextual error display, no credential leak, retry button

Security controls:
- autocomplete="off" on all credential inputs
- No localStorage for any credential data
- Progressive delay after failed attempts
- Strict CSP: no inline scripts
- SRI on all external assets
- Timing-safe error messages (never reveal if login ID exists)
- Tenant branding displayed after resolution (phishing indicator)

Responsive: 320px, 768px, 1024px breakpoints, touch-optimized
Accessibility: WCAG 2.1 AA, keyboard navigation, screen reader, high contrast mode, 4.5:1 contrast
i18n: English (default), Hindi, Tamil – all strings externalized

Write unit tests for each component:
- Form validation (required, format, length)
- API call mocking (success, failure, timeout)
- Navigation flow (correct routing between screens)
- WebAuthn API mocking for FidoAuthComponent
- Accessibility: aria-labels, keyboard navigation, focus management
```

---

### PROMPT 23 – Self-Service Portal: 16 Screens

```
Implement the Self-Service Portal Angular application (16 screens).

Routes:
/self-service → DashboardComponent
/self-service/profile → ProfileViewEditComponent
/self-service/password → PasswordChangeComponent
/self-service/forgot-password → ForgotPasswordComponent
/self-service/mfa/totp → TotpEnrollmentComponent
/self-service/mfa/totp/manage → TotpManagementComponent
/self-service/mfa/fido → FidoRegistrationComponent
/self-service/mfa/fido/manage → FidoManagementComponent
/self-service/mfa/softtoken → SoftTokenActivationComponent
/self-service/mfa/softtoken/manage → SoftTokenManagementComponent
/self-service/mfa/backup-codes → BackupCodesComponent
/self-service/sessions → MySessionsComponent
/self-service/activity → MyActivityLogComponent
/self-service/access-request → AccessRequestComponent (IGA)
/self-service/access-requests → MyAccessRequestsComponent (IGA)
/self-service/recovery → AccountRecoveryComponent

Key implementations:
1. DashboardComponent: overview cards (active sessions count, credential status, recent activity)
2. ProfileViewEditComponent: view/edit with OTP verification for email/phone changes
3. PasswordChangeComponent: current password + new password + confirm, live policy validation, strength meter (zxcvbn)
4. TotpEnrollmentComponent: QR code display (using qrcode.js), manual entry option, 6-digit confirmation
5. FidoRegistrationComponent: navigator.credentials.create() with device label input, success animation
6. FidoManagementComponent: list registered devices (label, last used, sign count), revoke button
7. SoftTokenActivationComponent: QR scan for provisioning, PIN setup, first challenge test
8. BackupCodesComponent: generate/regenerate with print option, single display (masked after leaving)
9. MySessionsComponent: list active sessions with device/IP/location, revoke button per session
10. MyActivityLogComponent: timeline of auth events and profile changes with filters

MFA Enrollment Wizard (triggered on first login or admin-forced):
- Step 1: Choose MFA method (cards with icons)
- Step 2: Method-specific enrollment
- Step 3: Generate and acknowledge backup codes
- Step 4: Test enrolled method
- Step 5: Success → redirect

All screens use step-up authentication for sensitive operations (via MfaGuard).

Write unit tests for each component:
- Form validations
- QR code generation
- WebAuthn ceremony mocking
- Session list and revocation
- Step-up auth guard triggering
```

---

### PROMPT 24 – Admin Console: Dashboard + User Management

```
Implement the Admin Console Angular application – Dashboard and User Management modules.

DashboardModule:
1. AuthTrendsChartComponent: line chart (ng2-charts) showing daily success/failure over 30 days
2. ActiveSessionsGaugeComponent: real-time gauge count
3. MfaAdoptionChartComponent: donut chart (% with TOTP/FIDO/SoftToken/none)
4. CredentialEnrollmentBarComponent: bar chart by credential type
5. FailedLoginHeatmapComponent: heatmap showing failures by hour/day of week
6. AccountStatusPieComponent: pie chart (active/suspended/locked/disabled)
7. RecentAdminActionsComponent: last 10 actions in card format
8. LockoutAlertCardComponent: currently locked accounts with one-click unlock
9. SystemHealthComponent: service health status indicators (green/yellow/red)
All widgets call BFF dashboard API. Auto-refresh every 30 seconds. Skeleton loaders during fetch.

UserManagementModule:
1. UserListComponent:
   - ag-Grid server-side model with pagination, sorting, search
   - Filters: status, user_type, department (sidebar filter panel)
   - Bulk selection with action toolbar (suspend, disable, terminate, assign role)
   - Export button (CSV/XLSX)
   - Column config: display name, email, status, type, department, last login, created

2. UserCreateComponent:
   - Multi-step form wizard:
     Step 1: Profile (name, email, department, designation, user_type)
     Step 2: Account (login_id auto-generated from email, password options)
     Step 3: Credentials (enable pwd/fido/totp/softtoken per policy)
     Step 4: Roles & Groups (searchable multi-select with assignment source)
     Step 5: Review & Submit
   - Server-side validation on each step

3. UserDetailComponent:
   - Tabbed layout using PrimeNG TabView:
   - Profile Tab: view/edit fields, change history timeline
   - Accounts Tab: status badges, unlock button, force password change
   - Roles Tab: ag-Grid of assigned roles with source, assign/remove buttons with reason dialog
   - Groups Tab: group list, add/remove
   - Credentials Tab: password age, FIDO/TOTP/SoftToken status, admin actions (reset/revoke/force-enroll)
   - Sessions Tab: active sessions with force-logout
   - Audit Tab: ag-Grid of user audit events with filters
   - Access Tab: (IGA) effective entitlements, certification status (shown when iga_enabled=true)

4. BulkImportComponent:
   - CSV/Excel upload with drag-and-drop zone
   - Client-side validation preview (column mapping, format check)
   - Progress bar during import
   - Error report download

5. BulkOperationsComponent:
   - Select accounts → choose action → confirm dialog → progress → results

Write unit tests:
- ag-Grid server-side data source mocking
- Multi-step form validation across steps
- Tab content lazy loading
- Bulk selection and action dispatch
- Chart data transformation
```

---

### PROMPT 25 – Admin Console: Role, Group, Device, Policy Modules

```
Implement remaining Admin Console modules: Role & Group, Device & Credential, Policy Configuration.

RoleGroupModule:
1. RoleListComponent: ag-Grid with CRUD, status filter, type filter
2. RoleCreateComponent: form with code, name, type, description
3. RoleDetailComponent: tabs for Entitlements (map/unmap), Members (list/bulk assign/remove)
4. GroupListComponent: similar CRUD
5. GroupDetailComponent: Members tab, Mapped Roles tab
6. EntitlementCatalogComponent: full CRUD for entitlements, type filter, role mapping view

DeviceCredentialModule:
1. FidoInventoryComponent: tenant-wide ag-Grid (device label, AAGUID, account, status, last used), export
2. SoftTokenInventoryComponent: platform filter, push health indicator, suspend/revoke actions
3. CredentialOverviewComponent: password age distribution chart, MFA adoption rates, enrollment counts
4. BulkPasswordResetComponent: account selection → generate temps → trigger notification

PolicyModule:
1. AuthTypeConfigComponent: configure primary/secondary factors per tenant/group/role/app level
2. PasswordPolicyComponent: form with all policy fields, live preview of password requirements
3. MfaPolicyComponent: factor selection, step-up conditions, device remember days
4. AuthPolicyComponent: SpEL rule editor with syntax highlighting, test button
5. PolicyBindingsComponent: drag-to-reorder priority, bind to target (tenant/account/group/role/app)
6. PolicySimulatorComponent: select account → show resolved effective policies for all types

AuditSessionSettingsModule:
1. AuditLogViewerComponent: ag-Grid server-side with category/type/actor/date filters, export CSV/PDF
2. AdminActionHistoryComponent: changes with expandable old/new JSON diff display
3. SecurityIncidentsComponent: severity badges, investigation status, timeline
4. LoginAnalyticsComponent: success/fail trends, geo distribution map, top failed IPs
5. ComplianceReportComponent: MFA compliance %, password age compliance, access review status
6. ActiveSessionsComponent: tenant-wide session list, filter by user/IP, bulk force-logout
7. TenantSettingsComponent: name, contact, timezone, language dropdown
8. BrandingEditorComponent: logo upload, color picker, login background, live preview
9. DomainManagementComponent: add/verify/remove domains, DNS instructions dialog
10. FeatureFlagsComponent: toggle switches for each feature flag
11. NotificationTemplatesComponent: template list, editor with variable insertion, preview
12. ConnectorConfigComponent: wizard for LDAP/AD/SCIM/email/SMS, test connection button, sync schedule
13. SystemSettingsComponent: key-value editor for session timeout, OTP validity, rate limits

Write unit tests for each component:
- Form validation and submission
- Policy simulator results rendering
- SpEL editor syntax validation
- Chart data transformations
- Template variable substitution preview
```

---

### PROMPT 26 – Angular Cross-Cutting: Theme, i18n, Error Handling

```
Implement cross-cutting UI concerns for all three Angular applications.

1. Theming:
   - CSS custom properties for tenant-specific theming
   - ThemingService: load tenant branding from BFF, apply CSS variables dynamically
   - Dark mode toggle with prefers-color-scheme detection
   - White-label capability: tenant can override logo, primary/secondary colors, login background
   - PrimeNG theme customization to match tenant colors

2. Internationalization (i18n):
   - ngx-translate for runtime language switching
   - Translation files: en.json, hi.json, ta.json
   - All user-visible strings externalized (NO hardcoded text)
   - Date/number formatting via Angular LOCALE_ID
   - Tenant-configurable default language

3. Error handling:
   - Global ErrorHandler service
   - Toast notification service (PrimeNG Toast):
     * Success (green), Warning (yellow), Error (red), Info (blue)
     * Auto-dismiss after 5 seconds, manual dismiss
   - HTTP error mapping: 400 → validation toast, 401 → redirect login, 403 → access denied page, 404 → not found page, 429 → rate limit message, 500+ → generic error with retry
   - Offline detection with reconnection banner

4. Performance:
   - Lazy loading for all feature modules
   - Virtual scrolling (CDK ScrollingModule) for long lists
   - ag-Grid server-side row model (no client-side pagination)
   - Service Worker for caching static assets
   - Bundle size budgets: login < 200KB, self-service < 300KB, admin < 500KB
   - OnPush change detection strategy on all components

5. Security:
   - HttpOnly JWT cookie (no JS access to tokens)
   - CSRF double-submit pattern (CookieXsrfTokenRepository)
   - Route guards on all authenticated routes
   - Idle timeout: custom IdleService with configurable timeout → auto-logout
   - No eval() anywhere (AOT compilation enforces this)
   - SRI hashes on all script/style tags in index.html
   - Source maps excluded in production builds

6. Responsive design:
   - Breakpoints: 320–767px (mobile), 768–1023px (tablet), 1024px+ (desktop), 1440px+ (wide)
   - Touch-optimized for mobile screens
   - PrimeNG responsive table/grid configurations

Write unit tests:
- ThemingService: CSS variable application, dark mode toggle
- i18n: language switching, fallback to English
- ErrorHandler: each HTTP error code → correct behavior
- IdleService: timeout detection, reset on activity
- Performance: verify lazy loading routes configured correctly
```

---

### PROMPT 27 – Angular E2E Test Suite (Cypress)

```
Create comprehensive E2E tests for all Angular applications using Cypress 13+.

1. Setup:
   - Cypress configuration for all 3 apps
   - Custom commands: cy.login(loginId, password), cy.loginWithTotp(loginId, password, totpSecret), cy.loginAsAdmin(), cy.selectTenant(tenantCode)
   - API mocking with cy.intercept() for backend services
   - Test data fixtures: users.json, roles.json, policies.json

2. Login Portal E2E Tests (12 tests):
   - TC-L01: Successful password + TOTP login → redirected to dashboard
   - TC-L02: Invalid password → error message displayed, no credential leak
   - TC-L03: Account locked after 5 failures → locked screen with countdown
   - TC-L04: FIDO2 passwordless login (mocked WebAuthn)
   - TC-L05: MFA method selection when multiple methods available
   - TC-L06: Backup code login (emergency recovery)
   - TC-L07: Password expired → force change form → new password → login
   - TC-L08: First-time onboarding wizard complete flow
   - TC-L09: SoftToken push wait screen with timeout
   - TC-L10: Tenant branding loads correctly (logo, colors)
   - TC-L11: Responsive: mobile layout renders correctly at 375px width
   - TC-L12: Accessibility: keyboard-only navigation through entire login flow

3. Self-Service Portal E2E Tests (10 tests):
   - TC-S01: View and edit profile (name fields)
   - TC-S02: Change email with OTP verification
   - TC-S03: Change password (old → new with policy validation)
   - TC-S04: Enroll TOTP (QR display → confirm code)
   - TC-S05: Register FIDO key (mocked WebAuthn ceremony)
   - TC-S06: Generate backup codes (display once, count displayed)
   - TC-S07: View active sessions → revoke a session
   - TC-S08: View activity log with date filter
   - TC-S09: MFA enrollment wizard (forced by admin)
   - TC-S10: Idle timeout → automatic logout

4. Admin Console E2E Tests (18 tests):
   - TC-A01: Dashboard loads with all widgets populated
   - TC-A02: User list: search, filter by status, paginate
   - TC-A03: Create user: complete 5-step wizard
   - TC-A04: User detail: view all tabs, edit profile
   - TC-A05: Assign role to user with reason
   - TC-A06: Suspend user → verify session revoked indicator
   - TC-A07: Terminate user → verify cascade confirmation dialog
   - TC-A08: Bulk import CSV → preview → submit → progress → results
   - TC-A09: Bulk action: select 3 users → suspend all
   - TC-A10: Password policy: edit and save
   - TC-A11: MFA policy: configure allowed methods
   - TC-A12: Policy simulator: select user → view resolved policies
   - TC-A13: Audit log: filter by category + date range → export CSV
   - TC-A14: Active sessions: search by user → force logout
   - TC-A15: Tenant settings: update timezone, save
   - TC-A16: Feature flags: toggle iga_enabled
   - TC-A17: Connector config: LDAP wizard → test connection
   - TC-A18: Role CRUD: create → assign entitlements → assign members

5. Cross-cutting E2E Tests (5 tests):
   - TC-X01: Permission matrix: HELPDESK cannot access user delete
   - TC-X02: Tenant isolation: TENANT_A admin cannot see TENANT_B users
   - TC-X03: CSRF protection: forged request rejected
   - TC-X04: Deep link: unauthenticated user redirected to login → after login returns to original URL
   - TC-X05: i18n: switch language to Tamil → verify all strings translated

Generate Cypress test files with clear describe/it blocks, meaningful assertions, and page object pattern for maintainability.
```

---

## PHASE 4: IGA MODULE (Prompts 28–32)

---

### PROMPT 28 – IGA Spring Boot Services Scaffold

```
Create the IGA module as a separate Maven project (innait-wiam-iga) with its own Flyway, K8s namespace, and Kafka consumer groups.

Project structure:
- innait-iga-access-request: request submission, approval execution
- innait-iga-certification: campaign management, reviewer assignment, decisions
- innait-iga-sod-engine: SoD rule management, violation detection
- innait-iga-jml-engine: Joiner-Mover-Leaver automation
- innait-iga-reconciliation: state comparison, drift detection
- innait-iga-risk-engine: access risk scoring
- innait-iga-admin: IGA configuration, schedules

Each service:
- Spring Boot 3.3.x, Java 21
- Own Flyway for INNAIT_IGA schema (independent versioning from core)
- Kafka consumer group: innait-iga-{service}
- REST client to core /api/v1/* endpoints with Resilience4j circuit breaker
- @JsonIgnoreProperties(ignoreUnknown=true) on all core DTOs (forward compatibility)

Core integration pattern:
- CoreApiClient: Feign/RestClient for core REST APIs with tenant_id JWT
- Read users, accounts, roles, entitlements from core
- Write: assign/revoke roles via core API (source=IGA)
- Kafka subscription: user.created, user.updated, account.terminated, account.role.assigned/removed, auth.succeeded/failed

Feature flag: iga_enabled must be true for IGA services to process events.

Write integration tests verifying:
- IGA services start independently from core (circuit breaker in OPEN state = graceful degradation)
- Core operates identically with IGA namespace deleted
- Kafka consumer groups independent from core consumer groups
```

---

### PROMPT 29 – IGA: JML Engine + Access Request + Certification

```
Implement the three primary IGA workflows.

1. JML Engine (innait-iga-jml-engine):
   - Kafka consumer for: user.created (Joiner), user.updated (Mover), account.terminated (Leaver)
   - JML_RULES table: trigger_field, trigger_value → action (assign role, remove role, notify)
   - Joiner: on user.created, match user_type + department → apply birthright roles via core API
   - Mover: on user.updated with dept/designation change → remove old dept roles, assign new
   - Leaver: on account.terminated → close open access requests, archive IGA records
   - JML_EVENTS: record all JML processing for audit trail

2. Access Request (innait-iga-access-request):
   - POST /api/v1/iga/access-requests: submit request (role/entitlement/group)
   - Approval workflow: multi-level (manager → resource owner → security)
   - APPROVAL_TASKS with SLA tracking and escalation
   - On approval: call core API to assign role (source=IGA)
   - On rejection: notify requester
   - Self-service integration: /api/v1/self/access-requests

3. Certification (innait-iga-certification):
   - Create campaign: select type (manager/application/role), schedule, assign reviewers
   - Snapshot: at campaign start, read all roles/entitlements from core, store in CERTIFICATION_ITEMS
   - Review: each reviewer sees their items, makes approve/revoke/delegate decisions
   - On revoke decision: call core API to remove role (source=IGA_CERTIFICATION)
   - Campaign completion: statistics, compliance percentage

Write unit tests:
- JML rule matching for each phase (joiner, mover, leaver)
- Access request state machine (pending → approved/rejected → fulfilled)
- Approval workflow level progression and escalation
- Certification snapshot creation and decision processing
```

---

### PROMPT 30 – IGA: SoD Engine + Reconciliation + Risk

```
Implement SoD, Reconciliation, and Risk scoring IGA services.

1. SoD Engine (innait-iga-sod-engine):
   - SOD_RULES: left_entitlement_code + right_entitlement_code = conflict pair
   - Preventive SoD: intercept before role assignment, check for conflicts
     * IGA checks BEFORE calling core API → core never sees conflicting request
   - Detective SoD: monitor account.role.assigned Kafka events AFTER core processes
     * If conflict detected: create SOD_VIOLATION, notify
   - Exception management: approve exception with expiry date
   - REST: CRUD for rules, list violations, manage exceptions

2. Reconciliation (innait-iga-reconciliation):
   - Scheduled comparison: IGA expected state vs core actual state
   - Read all accounts/roles from core API
   - Compare against IGA records (access requests, JML rules)
   - Detect drift: roles assigned without IGA record → flag as manual/unknown
   - Detect orphans: accounts without matching HR record
   - RECONCILIATION_RUNS and ORPHAN_ACCOUNTS tables
   - Auto-remediation option: remove unauthorized roles

3. Risk Engine (innait-iga-risk-engine):
   - Kafka consumer for: auth.succeeded, auth.failed, credential.enrolled/revoked
   - Per-user risk scoring based on:
     * Number of privileged roles
     * MFA adoption (no MFA = higher risk)
     * Failed auth frequency
     * Access anomalies (unusual hours, new locations)
   - RISK_SCORES table with score_factors JSON
   - Risk-based triggers: flag users above threshold for review

4. IGA Angular Console (14 screens):
   - /admin/iga/dashboard, /admin/iga/access-requests, /admin/iga/certifications, 
     /admin/iga/certifications/:id/review, /admin/iga/sod/rules, /admin/iga/sod/violations,
     /admin/iga/jml/*, /admin/iga/reconciliation, /admin/iga/orphan-accounts,
     /admin/iga/risk, /admin/iga/reports
   - Feature-flagged: only rendered when iga_enabled=true
   - Separate Angular build, integrated into admin navigation via lazy loading

Write unit tests:
- SoD conflict detection (preventive and detective)
- Reconciliation drift detection algorithms
- Risk score computation with various factor combinations
- IGA dashboard data aggregation
```

---

## PHASE 5: INTEGRATION TESTING (Prompts 31–35)

---

### PROMPT 31 – Backend Integration Test Suite (Testcontainers)

```
Create comprehensive Spring Boot integration tests using Testcontainers for all services.

1. Test infrastructure:
   - IntegrationTestBase class with @SpringBootTest:
     * Testcontainers: Oracle XE 21, Redis 7, Kafka (Confluent)
     * @DynamicPropertySource for container connection URLs
     * TestRestTemplate or WebTestClient for API calls
     * Shared containers (singleton pattern for speed)
   - TestJwtGenerator: generate valid JWTs for different roles (SUPER_ADMIN, TENANT_ADMIN, USER_ADMIN, HELPDESK, regular user)
   - TestDataSeeder: create test tenant, users, accounts, roles, groups, policies via API

2. Identity Service Integration Tests (15 tests):
   - IT01: Create user → verify Oracle record + Kafka event published
   - IT02: Full user lifecycle: create → activate → suspend → reactivate → terminate → soft delete → hard delete
   - IT03: Role assignment with all sources (MANUAL, SYNC, POLICY, IGA)
   - IT04: Effective entitlement resolution: user → role → entitlement + user → group → role → entitlement
   - IT05: Bulk import 100 users from CSV → verify all created
   - IT06: Concurrent user update → optimistic locking conflict handled
   - IT07: Tenant isolation: TENANT_A API cannot read TENANT_B users (VPD active)
   - IT08: Soft delete filter: deleted users excluded from list/search
   - IT09: Permission matrix: HELPDESK cannot delete users
   - IT10: Frozen API contract: verify response matches OpenAPI spec exactly

3. Credential Service Integration Tests (10 tests):
   - IT11: Password lifecycle: enroll → verify → change → history check → policy violation
   - IT12: TOTP lifecycle: enroll → confirm → verify → revoke
   - IT13: FIDO2 registration and authentication (WebAuthn4J test utilities)
   - IT14: Backup code: generate → use 3 → regenerate → old codes invalid
   - IT15: Password lockout: 5 wrong attempts → account locked
   - IT16: KEK version handling: credential encrypted with v1, verify after v2 rotation

4. Auth Orchestrator Integration Tests (8 tests):
   - IT17: Full login: initiate → password → TOTP → session + JWT issued
   - IT18: FIDO2 passwordless login end-to-end
   - IT19: Failed auth: wrong password → Kafka auth.failed published
   - IT20: Lockout: 5 failures → locked → auto-unlock after duration → successful login
   - IT21: Concurrent auth: 2 sessions for same account → both succeed (within limit)
   - IT22: Step-up auth for sensitive operation

5. Cross-service Integration Tests (5 tests):
   - IT23: Termination cascade: terminate account → verify sessions revoked + credentials revoked + roles removed + events published
   - IT24: Policy change → cache invalidation → new policy effective on next auth
   - IT25: Admin action → audit trail contains old/new values

Write all tests with clear setup, execution, and verification phases. Use AssertJ for fluent assertions. Tag with @Tag("integration") for selective execution.
```

---

### PROMPT 32 – Kafka Event Contract Tests

```
Create contract tests verifying all Kafka event schemas match the frozen specifications.

1. Event Schema Validation Tests:
   - For each event type, verify:
     * All required fields present and non-null
     * Field types match JSON Schema (UUID format, ISO-8601 dates, enum values)
     * schema_version = "v1"
     * Kafka headers: tenant_id and correlation_id present
   - Events: user.created, user.updated, account.role.assigned, account.role.removed, account.terminated, auth.succeeded, auth.failed

2. Consumer Compatibility Tests:
   - Test that consumers handle unknown fields gracefully (@JsonIgnoreProperties)
   - Test that consumers handle new enum values without error
   - Test consumer behavior when optional fields are null
   - Simulate v2 event with extra fields → v1 consumer still processes correctly

3. Producer Idempotency Tests:
   - Verify event_id is unique per event
   - Verify correlation_id propagates across service boundaries
   - Verify tenant_id in payload matches Kafka header

4. Event Ordering Tests:
   - Events for same tenant arrive in order (same partition key)
   - user.created arrives before account.role.assigned for same user

5. Dead Letter Topic Tests:
   - Malformed event → DLT, consumer continues
   - Deserialization failure → DLT with error metadata

Use @EmbeddedKafka and Spring Kafka test utilities. Validate against the delivered JSON Schema files.
```

---

### PROMPT 33 – API Contract Tests (OpenAPI Compliance)

```
Create API contract tests verifying all REST endpoints match the frozen OpenAPI 3.1 specification.

1. Load the delivered innait-wiam-api-v1.yaml OpenAPI spec.

2. For each frozen endpoint, verify:
   - HTTP method and path match
   - Request body schema matches (required fields, types, enums)
   - Response body schema matches (all frozen fields present with correct types)
   - HTTP status codes match spec (200, 201, 400, 401, 403, 404, 409)
   - Response envelope: {status, data, error, meta} structure

3. Specific frozen contract tests:
   - GET /api/v1/identity/users/{userId}: all 17 fields present with correct types
   - GET /api/v1/identity/accounts/{accountId}/roles: roles array with all 8 fields
   - POST /api/v1/identity/accounts/{accountId}/roles: 201 with role assignment record
   - DELETE /api/v1/identity/accounts/{accountId}/roles/{roleId}: accepts removal request body
   - GET /api/v1/identity/accounts/{accountId}/entitlements: flat entitlement list with 7 fields
   - PATCH /api/v1/identity/accounts/{accountId}/status: accepts status + reason + changed_by

4. Backward compatibility tests:
   - Add an unknown field to request → server ignores it (no error)
   - Response may contain additional fields not in original spec (forward compatible)
   - Enum fields accept new values without breaking

5. Tools:
   - Use springdoc-openapi to auto-generate spec from controllers
   - Compare auto-generated spec against delivered spec
   - Use RestAssured or MockMvc with JSON schema validation

Generate test report showing contract compliance percentage.
```

---

### PROMPT 34 – Tenant Isolation Test Suite

```
Create dedicated tenant isolation tests covering all layers.

1. Oracle VPD Tests (6 tests):
   - TI-VPD-01: Tenant A session reads USERS → only Tenant A rows
   - TI-VPD-02: Tenant A attempts INSERT with Tenant B TENANT_ID → blocked by VPD
   - TI-VPD-03: Tenant A attempts UPDATE on Tenant B account → 0 rows affected
   - TI-VPD-04: Tenant A attempts DELETE on Tenant B role → 0 rows affected
   - TI-VPD-05: No tenant context → 0 rows returned (not error)
   - TI-VPD-06: DBA session → full access (maintenance path)

2. Spring Security Tests (4 tests):
   - TI-SEC-01: JWT with Tenant A → GET user from Tenant B → 404
   - TI-SEC-02: JWT with Tenant A → POST role on Tenant B account → 403
   - TI-SEC-03: JWT with no tenant_id claim → 401
   - TI-SEC-04: JWT with tampered tenant_id → 401 (signature invalid)

3. Redis Isolation Tests (2 tests):
   - TI-REDIS-01: Session key contains tenant prefix
   - TI-REDIS-02: Tenant A session lookup cannot return Tenant B session

4. Kafka Isolation Tests (2 tests):
   - TI-KAFKA-01: All events carry tenant_id in header
   - TI-KAFKA-02: IGA consumer only processes events for configured tenant

5. Data leak prevention:
   - Search endpoint: search term from Tenant A never returns Tenant B results
   - Export endpoint: CSV export only contains Tenant A data
   - Audit endpoint: audit events scoped to tenant

Run with 2 test tenants (TENANT_A, TENANT_B) pre-seeded with distinct data.
```

---

### PROMPT 35 – Performance Test Suite (Gatling)

```
Create a Gatling 3.10+ performance test suite for InnaIT WIAM.

1. Setup:
   - Gatling with Scala DSL
   - Environment configuration: target URL, tenant, user pool
   - User feeder: CSV with 10,000 test accounts (pre-seeded via bulk import)
   - Auth token cache: authenticate once, reuse JWT for subsequent requests

2. Scenarios:
   - PasswordTotpLogin: initiate → password → TOTP → receive JWT (60% of traffic)
   - FidoLogin: initiate → FIDO assert (simulated) → receive JWT (25%)
   - SoftTokenLogin: initiate → password → push wait → verify (10%)
   - PasswordOnlyLogin: initiate → password → JWT (5%)
   - UserCrud: create user → update → assign role → get entitlements (admin traffic)
   - AuditQuery: search audit events with date range (read-heavy)
   - SessionList: list active sessions for account (read-heavy)

3. Load profiles:
   - Baseline: ramp to 500 TPS over 5 min, hold 15 min
   - Target: ramp to 1,000 TPS (2x peak) over 5 min, hold 60 min
   - Stress: ramp to 2,500 TPS over 10 min, observe breaking point
   - Soak: 500 TPS for 4 hours (memory leak detection)

4. Assertions:
   - Global success rate > 99.9%
   - p50 < 200ms, p95 < 500ms, p99 < 2000ms
   - No errors at target load (1,000 TPS)
   - Memory stable during soak (no upward trend)

5. Gatling reports:
   - HTML report with response time distributions, TPS charts, error analysis
   - Custom metrics: per-flow latency, per-service breakdown

Generate: simulation classes, feeders, protocol configuration, and CI integration script.
```

---
## PHASE 6: DEVOPS, CI/CD & INFRASTRUCTURE (Prompts 36–45)

---

### PROMPT 36 – Docker Multi-Stage Builds

```
Create production-optimized Dockerfiles for all InnaIT WIAM services.

Spring Boot services (template for all 11):
- Stage 1: Maven build with layer caching
  FROM maven:3.9-eclipse-temurin-21 AS build
  COPY pom.xml, COPY src, RUN mvn clean package -DskipTests -pl innait-{service} -am
- Stage 2: Runtime
  FROM eclipse-temurin:21-jre-alpine
  RUN addgroup -S innait && adduser -S innait -G innait
  COPY --from=build layers/dependencies, spring-boot-loader, application
  USER innait
  EXPOSE {port}
  HEALTHCHECK CMD curl -f http://localhost:{port}/actuator/health || exit 1
  ENTRYPOINT ["java", "-XX:+UseG1GC", "-XX:MaxRAMPercentage=75.0", "org.springframework.boot.loader.launch.JarLauncher"]

Angular SPAs:
- Stage 1: Node build
  FROM node:20-alpine AS build
  RUN npm ci && npm run build -- --configuration=production
- Stage 2: Nginx
  FROM nginx:alpine
  COPY nginx.conf (with SRI headers, CSP, compression, SPA fallback)
  COPY --from=build dist/{app}/browser /usr/share/nginx/html
  Generate SRI hashes for all JS/CSS files at build time

Spring Cloud Gateway:
- Same as Spring Boot but with reactive Netty (no Tomcat)

docker-compose.yml for local development:
- All services + Oracle XE + Redis + Kafka (Confluent) + Vault (dev mode)
- Network: innait-network
- Volumes: oracle-data, redis-data, kafka-data
- Environment files: .env.dev with all connection strings

Create .dockerignore files for each module.
Generate build script: build-all.sh that builds all images with version tags.
```

---

### PROMPT 37 – Kubernetes Helm Chart Completion

```
Complete the Helm chart (building on delivered evidence pack) with all remaining templates.

1. ConfigMaps:
   - application-common.yml: shared Spring Boot config (Kafka, Redis, Vault URLs)
   - Per-service overrides: service-specific port, database schema

2. Secrets (ExternalSecret with Vault CSI):
   - innait-oracle-credentials (username/password from Vault)
   - innait-redis-credentials
   - innait-kafka-credentials
   - innait-jwt-signing-key

3. PodDisruptionBudgets:
   - All services: maxUnavailable=1 (ensure HA during rolling updates)
   - Gateway: maxUnavailable=0 (zero downtime)

4. ServiceMonitor (Prometheus Operator):
   - Per-service: scrape /actuator/prometheus every 15s
   - Custom metrics: auth_transactions_total, auth_latency_seconds, session_active_count

5. Ingress (nginx-ingress):
   - TLS termination with cert-manager
   - Rate limiting annotations
   - ModSecurity WAF rules (OWASP CRS)
   - Path-based routing to services

6. CronJobs:
   - innait-purge-login-attempts: daily at 02:00
   - innait-purge-session-events: daily at 03:00
   - innait-audit-partition-maintenance: weekly

7. Rolling update strategy:
   - maxSurge: 25%, maxUnavailable: 0 (zero downtime)
   - Readiness gate: pod must pass readiness probe before receiving traffic

8. Init containers:
   - wait-for-oracle: check Oracle connectivity before service start
   - wait-for-redis: check Redis Sentinel before service start
   - flyway-migrate: run migrations before app starts (for services owning schemas)

Generate values-dev.yaml, values-staging.yaml, values-prod.yaml with environment-specific overrides.
```

---

### PROMPT 38 – CI/CD Pipeline (GitLab CI)

```
Create a complete GitLab CI/CD pipeline for InnaIT WIAM.

.gitlab-ci.yml stages:
1. build: Maven compile + unit tests + JaCoCo coverage
2. test: Integration tests with Testcontainers (Oracle, Redis, Kafka)
3. security: Trivy container scan + OWASP dependency-check + SonarQube analysis
4. package: Docker build + push to registry
5. deploy-staging: Helm upgrade to staging namespace
6. e2e-test: Cypress E2E tests against staging
7. performance: Gatling performance test against staging
8. deploy-prod: Manual approval gate → Helm upgrade to production

Pipeline features:
- Parallel jobs per service module (identity, credential, auth, etc.)
- Cache: Maven .m2 repository, npm node_modules, Docker layer cache
- Artifacts: JaCoCo reports, Cypress screenshots/videos, Gatling HTML reports
- Quality gates: fail if coverage < 80%, fail if security critical/high findings
- Rollback: automatic if health check fails post-deploy

Per-service pipeline variables:
- SERVICE_NAME, DOCKER_IMAGE, HELM_RELEASE, K8S_NAMESPACE

Environment-specific:
- staging: auto-deploy on main branch merge
- production: manual approval required, blue-green deployment option

Generate complete .gitlab-ci.yml with all stages, jobs, and scripts.
```

---

### PROMPT 39 – Monitoring: Grafana Dashboards + Alerts

```
Create Grafana dashboards and Prometheus alert rules for InnaIT WIAM.

1. Auth Metrics Dashboard:
   - Auth success/failure rate (line chart, 5-min windows)
   - Auth latency percentiles (p50, p95, p99)
   - Auth TPS by flow type (password, FIDO, SoftToken)
   - Failed login heatmap (hour x day)
   - Active auth transactions count

2. Database Health Dashboard:
   - Oracle connection pool: active, idle, max
   - Oracle query latency (p50, p95)
   - Tablespace usage (% used per schema)
   - Slow query count (> 1s)

3. Redis Dashboard:
   - Memory usage vs maxmemory
   - Hit/miss ratio
   - Connected clients
   - Key count by namespace
   - Sentinel status

4. Kafka Dashboard:
   - Consumer group lag per topic
   - Message throughput (msg/sec)
   - Broker disk usage
   - Partition leader distribution

5. Service Health Dashboard:
   - Pod status (running, pending, failed) per service
   - CPU/memory usage per service
   - Restart count (last 24h)
   - HTTP error rate (4xx, 5xx)

6. Prometheus Alert Rules:
   - P1 Critical: auth_success_rate < 95% for 5 min, jwt_signing_failure any, audit_write_failure any
   - P2 High: auth_latency_p99 > 2000ms for 5 min, oracle_connections > 80% max, redis_memory > 80%, kafka_consumer_lag > 10000 for 10 min, pod_restarts > 3 in 30 min
   - P3 Medium: oracle_disk > 85%, cert_expiry < 14 days

7. PagerDuty/OpsGenie integration:
   - P1 → immediate page
   - P2 → 5-min delay then page
   - P3 → email notification

Generate: Grafana JSON dashboard definitions, Prometheus PrometheusRule CRDs, AlertmanagerConfig.
```

---

### PROMPT 40 – Vault Secret Management Setup

```
Create HashiCorp Vault configuration for InnaIT WIAM secret management.

1. Vault policies:
   - innait-wiam-read: read secrets in secret/data/innait/*
   - innait-wiam-admin: full CRUD on secret/data/innait/*
   - Per-service policies: identity-service reads only oracle + kafka + redis secrets

2. Secret paths:
   - secret/data/innait/oracle: username, password, jdbc_url
   - secret/data/innait/redis: password, sentinel_password
   - secret/data/innait/kafka: sasl_username, sasl_password
   - secret/data/innait/jwt: private_key (RSA 2048), public_key, kid
   - secret/data/innait/kek: current_version, keys (map of version → AES-256 key)
   - secret/data/innait/tde: wallet_password

3. Dynamic secrets (for database):
   - Vault Database secret engine for Oracle
   - Lease TTL: 1 hour, max TTL: 24 hours
   - Spring Boot Vault lease renewal

4. Transit engine (for connector config encryption):
   - Key: innait-connector-key
   - Encrypt/decrypt connector passwords before DB storage

5. PKI engine (for internal TLS):
   - Root CA: innait-internal-ca
   - Intermediate CA: innait-wiam-ca
   - Auto-issue certificates for inter-service mTLS (future)

6. Kubernetes auth method:
   - Service account binding per K8s namespace
   - innait-core namespace → innait-wiam-read policy
   - innait-iga namespace → innait-wiam-read policy

Generate: Vault policy HCL files, secret seed scripts, Kubernetes auth configuration.
```

---

### PROMPT 41 – Spring Boot Application Configurations (All Environments)

```
Create complete application.yml configurations for all services across all environments.

For each service, create:
- application.yml (shared defaults)
- application-dev.yml (local development)
- application-staging.yml (staging environment)
- application-prod.yml (production)

Common configuration (all services):
- server.port: service-specific (8081-8092)
- spring.datasource: Oracle JDBC with HikariCP (min=5, max=30, connectionTimeout=30s)
- spring.jpa: hibernate ddl-auto=validate, show-sql=false, open-in-view=false
- spring.kafka: bootstrap-servers, producer/consumer config
- spring.redis: sentinel configuration
- spring.cloud.vault: address, authentication, secret paths
- management.endpoints: expose health, prometheus, info
- management.health: show-details=always
- logging: structured JSON format, correlation-id in MDC

Service-specific:
- identity-service: spring.flyway.schemas=INNAIT_IDENTITY, event publishing topics
- credential-service: vault KEK path, Argon2id parameters
- auth-orchestrator: state machine config, lockout settings, Redis auth transaction TTL
- session-service: spring.session.redis.namespace, max concurrent sessions
- token-service: JWT signing key vault path, access/refresh token TTLs
- policy-service: SpEL engine config, policy cache TTL
- audit-service: Kafka consumer group config, batch size, buffer config
- api-gateway: route definitions, rate limit config, CORS origins
- admin-bff: CSRF config, file upload limits

Environment differences:
- dev: H2/Oracle XE, single Redis, single Kafka, debug logging
- staging: Oracle RAC, Redis Sentinel, 3-broker Kafka, info logging
- prod: Oracle RAC+DG, Redis 6-node Sentinel, 3-broker Kafka, warn logging, Vault dynamic secrets

Generate all YAML files with comments explaining each setting.
```

---

### PROMPT 42 – Observability: Structured Logging + Distributed Tracing

```
Implement structured logging and distributed tracing across all services.

1. Structured logging (Logback + JSON):
   - logback-spring.xml with JSON encoder (LogstashEncoder)
   - Fields: timestamp, level, logger, message, tenant_id, correlation_id, user_id, service_name, trace_id, span_id
   - MDC (Mapped Diagnostic Context): set tenant_id, correlation_id, user_id from request filters
   - Log levels per env: dev=DEBUG, staging=INFO, prod=WARN
   - Sensitive data masking: password, token, secret never logged

2. Distributed tracing:
   - Micrometer Tracing + OpenTelemetry (OTLP exporter)
   - Trace propagation: W3C TraceContext headers
   - Auto-instrument: Spring Web, Spring Data, Kafka, Redis
   - Custom spans: @Observed on key service methods (auth flow, credential verify, policy resolve)
   - Trace → Kafka header propagation (for cross-service tracing via events)

3. ELK integration:
   - Filebeat sidecar in K8s pods → Elasticsearch
   - Kibana dashboards for log search and correlation
   - Index pattern: innait-wiam-{service}-{date}

4. Spring Boot Actuator endpoints:
   - /actuator/health (liveness + readiness separate)
   - /actuator/prometheus (Micrometer metrics)
   - /actuator/info (build version, git commit)
   - /actuator/loggers (dynamic log level change)
   - Security: actuator endpoints accessible only from K8s internal network

Generate: logback-spring.xml for all services, OpenTelemetry configuration, custom Micrometer metrics registration.
```

---

## PHASE 7: MODULE SMOKE & FINAL VALIDATION (Prompts 43–50)

---

### PROMPT 43 – Module Integration Smoke Tests

```
Create module integration smoke tests proving the core platform operates correctly in all deployment configurations.

5 configurations to test:
1. C1: Core Only (Foundation) – No optional modules
2. C2: Core + IGA Module
3. C3: Core + Federation (stub)
4. C4: Core + IGA + Federation
5. C5: Full Stack (all modules including Device Trust and Password Manager stubs)

For each configuration:
1. Startup test:
   - Deploy via Helm with configuration-specific values
   - Verify all services reach READY state within 60 seconds
   - Verify /actuator/health returns UP for all services
   - Log startup times per service

2. Functional smoke tests (14 core tests):
   - F01: Password + TOTP login end-to-end
   - F02: FIDO2 registration and login
   - F03: SoftToken provisioning and auth
   - F04: User CRUD (create, read, update, soft-delete)
   - F05: Role assignment with source=MANUAL
   - F06: Group creation and member management
   - F07: Policy resolution (password + MFA + auth)
   - F08: Session management (create, list, revoke)
   - F09: Admin console login and dashboard data
   - F10: Self-service: profile view + password change
   - F11: Bulk user import (50 users)
   - F12: Audit trail: events persisted for all operations
   - F13: Account termination cascade
   - F14: Kafka events published for all lifecycle operations

3. C2-specific: IGA reads core data, assigns role via core API, receives Kafka events
4. C2 reverse: delete IGA namespace → verify core zero-impact (all F01-F14 still pass)
5. C5-specific: Device Trust stub writes to device_context_id column; policy engine ignores unknown conditions

Test framework: JUnit 5 + RestAssured, orchestrated by shell script that cycles through configurations.
Generate: test classes, Helm values per config, orchestration script, result reporting.
```

---

### PROMPT 44 – HA/DR Failover Test Automation

```
Create automated HA/DR failover test scripts.

1. Oracle Data Guard Switchover Test:
   - Script: trigger DGMGRL switchover command
   - During switchover: run continuous auth traffic (100 TPS via curl loop)
   - Measure: switchover time, application downtime, transaction loss
   - Verify: audit trail continuity (no correlation_id gaps)
   - Pass criteria: switchover < 30s, app downtime < 60s, zero data loss

2. Redis Sentinel Failover Test:
   - Script: SIGKILL redis master process
   - Measure: Sentinel detection time, failover time, session cache miss rate
   - Verify: sessions recoverable from Oracle fallback
   - Pass criteria: failover < 10s, session loss < 1%

3. Kafka Broker Failure Test:
   - Script: kill one of 3 brokers
   - Measure: partition leader election time, consumer lag peak, recovery time
   - Verify: zero message loss, audit events continuous
   - Pass criteria: election < 10s, zero message loss

4. Full DR Switchover Test:
   - Script: orchestrate Oracle DG + Redis + Kafka failover in sequence
   - Measure: total RTO from initiation to first successful auth
   - Verify: end-to-end auth flow works on DR site
   - Pass criteria: RTO < 15 min, RPO < 1 min

5. K8s Pod Failure Test:
   - Script: kubectl delete pod for each service (one at a time)
   - Verify: K8s auto-restart, service recovers, zero auth failures during restart
   - Measure: time to ready per service

Generate: bash scripts, expected result templates, pass/fail evaluation logic.
```

---

### PROMPT 45 – Security Test Automation

```
Create automated security validation scripts.

1. OWASP ZAP Automated Scan:
   - ZAP Docker container scanning all API endpoints
   - Authentication: use valid JWT for authenticated scan
   - Target: all /api/v1/* endpoints
   - Report: HTML + JSON with finding severity

2. Dependency vulnerability scan:
   - OWASP dependency-check Maven plugin
   - Scan all Maven dependencies for known CVEs
   - Fail build on CVSS >= 7.0 (critical/high)
   - Suppression file for false positives

3. Container image scan:
   - Trivy scan on all Docker images
   - Report: vulnerabilities in OS packages and application dependencies
   - Fail on critical findings

4. TLS configuration test:
   - testssl.sh against all HTTPS endpoints
   - Verify: TLS 1.2+ only, strong ciphers, no weak protocols
   - Verify: HSTS header, certificate validity

5. Secret detection:
   - git-secrets / trufflehog scan on repository
   - Verify: no hardcoded passwords, API keys, or secrets in code
   - Pre-commit hook for prevention

6. JWT security test:
   - Test: expired token rejected
   - Test: token with wrong signature rejected
   - Test: token with modified claims (tenant_id) rejected
   - Test: algorithm confusion attack (alg=none) rejected

7. Rate limiting test:
   - Send 100 requests in 10 seconds to /api/v1/auth/login/initiate
   - Verify: 429 returned after limit exceeded
   - Verify: Retry-After header present

8. CSRF test:
   - Send request without CSRF token to BFF endpoint → 403
   - Send request with valid CSRF token → 200

Generate: CI-integrated scripts, ZAP scan configuration, security report template.
```

---

## PHASE 8: DOCUMENTATION & FINALIZATION (Prompts 46–62)

---

### PROMPT 46 – API Documentation (SpringDoc OpenAPI)

```
Configure SpringDoc OpenAPI for auto-generated API documentation.

1. SpringDoc configuration per service:
   - springdoc.api-docs.path=/api-docs
   - springdoc.swagger-ui.path=/swagger-ui.html
   - Group by tag: Identity, Credential, Auth, Session, Token, Policy, Audit, Admin

2. Custom annotations on all controllers:
   - @Operation(summary, description, tags)
   - @ApiResponse for all status codes (200, 201, 400, 401, 403, 404, 409)
   - @Schema on all DTOs with examples
   - @Parameter on all path/query params

3. Security scheme: bearerAuth JWT with tenant_id claim

4. Frozen contract marking: custom x-stability: "frozen" extension on IGA-consumed endpoints

5. API Gateway aggregation:
   - /swagger-ui.html at gateway level aggregates all service API docs
   - Service selection dropdown

6. Contract comparison:
   - Script to compare auto-generated spec against delivered innait-wiam-api-v1.yaml
   - Report any deviations as contract violations

Generate: SpringDoc configuration classes, annotated controllers, comparison script.
```

---

### PROMPT 47 – Developer README + Quickstart

```
Create comprehensive developer documentation.

1. README.md (root):
   - Project overview and architecture summary
   - Prerequisites: Java 21, Maven 3.9+, Docker, Node 20+, Angular CLI 18+
   - Quick start: docker-compose up → all services running
   - Service port map
   - Module dependency diagram
   - Link to architecture documents

2. CONTRIBUTING.md:
   - Branch naming: feature/{service}/{description}, bugfix/{service}/{description}
   - Commit message format: feat(identity): add bulk import
   - PR template with checklist (tests, coverage, docs, migration)
   - Code review guidelines

3. docs/DEVELOPMENT.md:
   - Local setup instructions step-by-step
   - Running individual services
   - Running tests (unit, integration, e2e)
   - Database migration instructions
   - Kafka topic creation
   - Vault dev mode setup

4. docs/ARCHITECTURE.md:
   - Service map with interactions
   - Data flow diagrams
   - Authentication flow sequence diagram
   - IGA integration pattern

5. docs/TESTING.md:
   - Test strategy overview
   - Unit test conventions
   - Integration test setup (Testcontainers)
   - E2E test execution
   - Performance test execution

6. docs/DEPLOYMENT.md:
   - Helm chart usage
   - Environment configuration
   - Secret management
   - Monitoring setup
   - Runbook references

Generate all markdown files with clear formatting and practical examples.
```

---

### PROMPT 48 – Database Migration Validation Suite

```
Create a test suite that validates all Flyway migrations execute correctly.

1. Migration execution test per schema:
   - Start with empty Oracle XE (Testcontainers)
   - Run Flyway migrate for each schema
   - Verify: all tables created with correct columns, types, constraints
   - Verify: all indexes exist with correct column lists
   - Verify: all CHECK constraints enforce correct enum values
   - Verify: all foreign keys present with correct references
   - Verify: seed data populated (roles, flags, settings)

2. Schema validation queries:
   - Query USER_TAB_COLUMNS to verify column existence and types
   - Query USER_CONSTRAINTS to verify PKs, FKs, CHECKs
   - Query USER_INDEXES to verify index existence
   - Query table row counts for seed data

3. Zero-downtime migration test:
   - Simulate V002 migration (add column): verify app still works with V001 schema
   - Simulate V003 migration (populate column): verify backward compatibility
   - Pattern: add column → populate → enforce NOT NULL in next release

4. Rollback test:
   - Apply V001 → verify
   - Apply V002 → verify
   - Undo V002 (manual rollback script) → verify V001 state restored

5. Performance test:
   - Run migrations against schema with production-like data volume (1M users, 5M audit events)
   - Measure migration execution time
   - Verify index creation time acceptable

Generate: test classes, validation query files, expected schema metadata fixtures.
```

---

### PROMPT 49 – Secret Rotation Test Suite

```
Create tests validating all secret rotation procedures work with zero downtime.

1. JWT Signing Key Rotation:
   - Generate new RS256 key pair in Vault
   - Add new key to JWKS endpoint (kid2)
   - Token Service starts signing with kid2
   - Verify: tokens signed with kid1 still verify (old key in JWKS for 24h)
   - After 24h: remove kid1 from JWKS
   - Verify: new logins get kid2 tokens, old kid1 tokens expire naturally

2. Oracle DB Password Rotation:
   - Vault generates new Oracle credentials
   - Spring Boot connection pool refreshes via Vault lease renewal
   - Verify: zero connection errors during rotation
   - Verify: all services reconnect with new credentials

3. Redis Password Rotation:
   - Update Redis AUTH password in Vault
   - Lettuce client reconnects automatically
   - Verify: session cache operations continue without interruption

4. TOTP KEK Rotation:
   - Add new KEK version (v2) in Vault
   - Existing TOTP credentials (encrypted with v1) still decrypt correctly
   - New enrollments encrypt with v2
   - Verify: migration script can re-encrypt v1 credentials to v2

5. TLS Certificate Rotation:
   - cert-manager renews certificate
   - K8s Ingress hot-reloads new cert
   - Verify: zero TLS errors during rotation
   - Verify: HSTS preload continues working

Generate: rotation scripts, verification test cases, zero-downtime validation logic.
```

---

### PROMPT 50 – Incident Runbook Drill Automation

```
Create automated incident simulation and measurement scripts.

1. Total Auth Outage Drill:
   - Script: kubectl scale deployment auth-orchestrator --replicas=0
   - Measure: time to PagerDuty alert, time to auto-recovery (K8s restart)
   - Verify: auth flow resumes, audit trail continuous
   - Cleanup: restore replicas

2. Credential Stuffing Drill:
   - Script: JMeter sending 500 req/sec failed logins from 50 unique IPs
   - Measure: time to detection (Kafka auth.failed spike), time to mitigation (rate limit)
   - Verify: legitimate users can still login from non-attacking IPs
   - Cleanup: remove WAF blocks

3. Secret Compromise Drill:
   - Script: rotate JWT signing key, revoke all sessions
   - Measure: key rotation time, session revocation time, re-auth time
   - Verify: no unauthorized access during window
   - Cleanup: confirm new key operational

4. Audit Trail Failure Drill:
   - Script: kubectl scale deployment kafka-broker-0 --replicas=0
   - Measure: buffer activation time, buffer event count, recovery time
   - Verify: zero audit gaps via correlation_id continuity check
   - Cleanup: restore Kafka broker

5. Measurement framework:
   - Each drill records: detection_time, response_time, mttr, impact_summary
   - Results stored as JSON for evidence pack
   - Pass/fail criteria per drill

Generate: drill scripts, measurement collectors, result reporters, evidence formatters.
```

---

### PROMPTS 51–62 – Remaining Specialized Prompts

---

### PROMPT 51 – Angular Unit Test Coverage (Jasmine/Karma)
```
Write unit tests for all Angular components achieving 80%+ coverage.
Every component, service, pipe, directive, and guard must have tests.
Use TestBed, HttpClientTestingModule, RouterTestingModule.
Test: input validation, output emission, service method calls, template rendering, error states.
Configure Karma with headless Chrome, coverage reporter (Istanbul), and threshold enforcement.
```

### PROMPT 52 – DPDP Act Compliance Implementation
```
Implement DPDP Act compliance features: consent tracking, data flow mapping, right-to-erasure workflow, anonymization pipeline, purpose limitation enforcement. Create DPDP consent tables, consent API endpoints, anonymization service that replaces PII with pseudonymous identifiers while preserving audit trail integrity.
```

### PROMPT 53 – Directory Connector Integration Tests
```
Create integration tests for LDAP/AD sync and SCIM 2.0 endpoints using UnboundID in-memory LDAP server. Test full sync (500 users), incremental sync (delta changes), user disable on LDAP delete, attribute mapping, sync error handling, SCIM create/update/delete/search.
```

### PROMPT 54 – Admin Console Component Tests (Angular Testing Library)
```
Write component tests using Angular Testing Library for all admin console components. Test user interactions (click, type, select) rather than implementation details. Use screen queries (getByRole, getByText). Test accessibility (aria attributes, keyboard navigation, focus management). Minimum 85% coverage on admin-console project.
```

### PROMPT 55 – Kafka Consumer Resilience Tests
```
Test Kafka consumer resilience: deserialization failures → DLT, broker disconnection → reconnect, consumer rebalance → no message loss, poison pill handling, offset management (no duplicate processing). Use Testcontainers Kafka with fault injection.
```

### PROMPT 56 – Oracle Performance Optimization
```
Implement Oracle-specific performance optimizations: jOOQ for complex analytics queries, Oracle Text index tuning for admin search, partition pruning verification for audit queries, connection pool monitoring (HikariCP metrics), explain plan validation for critical queries. Create query performance test suite with realistic data volumes (1M users, 10M audit events).
```

### PROMPT 57 – Redis Session Failover Tests
```
Test Redis session management under failure conditions: Sentinel failover → sessions recoverable, master crash → Oracle fallback → Redis recovery → cache warm, Redis memory limit → eviction policy (volatile-lru) behavior, concurrent session access under load, session serialization/deserialization with all fields.
```

### PROMPT 58 – Angular Accessibility Audit
```
Create WCAG 2.1 AA compliance test suite for all Angular apps. Test with axe-core (integrated with Cypress). Verify: keyboard navigation for all workflows, screen reader compatibility (ARIA labels on all interactive elements), color contrast (4.5:1 minimum), focus management on route changes, error announcement for form validation, high contrast mode support. Generate accessibility audit report.
```

### PROMPT 59 – Cross-Browser Compatibility Tests
```
Create cross-browser E2E tests using Playwright (multi-browser support). Test all critical flows in: Chrome 120+, Firefox 120+, Safari 17+, Edge 120+. Test responsive layouts at 375px (mobile), 768px (tablet), 1440px (desktop). Verify: login flow, admin console data tables, chart rendering, file upload, WebAuthn ceremony (Chrome only for WebAuthn).
```

### PROMPT 60 – Load Test: Multi-Tenant Concurrent
```
Create Gatling multi-tenant load test simulating 10 tenants with different sizes simultaneously. Tenant A: 5,000 users, 500 TPS. Tenant B: 1,000 users, 100 TPS. Tenants C-J: 100 users, 10 TPS each. Verify: tenant isolation under load (no cross-tenant data), fair resource allocation, no single-tenant monopolization. Measure per-tenant latency distribution.
```

### PROMPT 61 – Comprehensive Test Report Generator
```
Create a test report aggregation tool that collects results from all test layers: JaCoCo (unit coverage), Testcontainers (integration), Cypress (E2E), Gatling (performance), ZAP (security), axe-core (accessibility). Generate a single HTML/PDF report with: overall pass rate, coverage %, test count by type, failed test details, performance metrics, security findings, accessibility violations. This report serves as the final evidence artifact for 100% readiness.
```

### PROMPT 62 – Production Readiness Checklist Validator
```
Create an automated production readiness checklist validator that verifies all go-live requirements from the Architecture Closure Pack (Section 5.6). Script checks:
- Oracle RAC/Data Guard: DGMGRL show configuration → status OK
- RMAN backup: verify latest backup within 24h
- VPD policies: query DBA_POLICIES → all schemas covered
- TDE: verify INNAIT_CREDENTIAL tablespace encrypted
- Flashback Archive: verify INNAIT_AUDIT tables enrolled
- Vault: /sys/health → sealed=false, ha_enabled=true
- JWT JWKS: GET /.well-known/jwks.json → valid keys returned
- TLS: all endpoints respond with valid certificate
- WAF: ModSecurity rules loaded → OWASP CRS active
- K8s: all pods Running, HPA configured, network policies active
- Redis: Sentinel quorum healthy, failover tested
- Kafka: all topics created, replication factor=3, ISR=3
- Prometheus: all ServiceMonitors active, alerts configured
- Grafana: all dashboards loaded
- ELK: log ingestion active for all services
- Flyway: all migrations applied in staging/prod
- Secret rotation: all secrets within rotation schedule
Generate: checklist validator script, HTML report with red/green per item.
```

---

# END OF PLAYBOOK
# Total: 62 Prompts across 8 Phases
# Estimated Development: 2 developers × 36 weeks (matching architecture Phase 1-4 roadmap)
