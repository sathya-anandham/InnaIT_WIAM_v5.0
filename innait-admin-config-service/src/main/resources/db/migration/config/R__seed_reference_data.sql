-- ============================================================================
-- InnaIT WIAM 5.0 - Repeatable: Seed Feature Flags and System Settings
-- ============================================================================

-- Default Feature Flags (system-level, TENANT_ID = all-zeros)
MERGE INTO FEATURE_FLAGS tgt
USING (
    SELECT HEXTORAW('00000000000000000000000000000000') AS TENANT_ID, 'self_registration_enabled' AS FLAG_KEY, 0 AS FLAG_VALUE, 'Allow user self-registration' AS DESCRIPTION FROM DUAL UNION ALL
    SELECT HEXTORAW('00000000000000000000000000000000'), 'passwordless_enabled', 0, 'Enable passwordless authentication' FROM DUAL UNION ALL
    SELECT HEXTORAW('00000000000000000000000000000000'), 'iga_enabled', 0, 'Enable identity governance features' FROM DUAL UNION ALL
    SELECT HEXTORAW('00000000000000000000000000000000'), 'adaptive_mfa_enabled', 0, 'Enable adaptive/risk-based MFA' FROM DUAL UNION ALL
    SELECT HEXTORAW('00000000000000000000000000000000'), 'directory_sync_enabled', 0, 'Enable directory synchronization' FROM DUAL UNION ALL
    SELECT HEXTORAW('00000000000000000000000000000000'), 'sso_enabled', 1, 'Enable SSO federation' FROM DUAL UNION ALL
    SELECT HEXTORAW('00000000000000000000000000000000'), 'audit_export_enabled', 0, 'Enable audit log export/SIEM integration' FROM DUAL
) src ON (tgt.TENANT_ID = src.TENANT_ID AND tgt.FLAG_KEY = src.FLAG_KEY)
WHEN NOT MATCHED THEN INSERT (FEATURE_FLAG_ID, TENANT_ID, FLAG_KEY, FLAG_VALUE, DESCRIPTION, CREATED_AT, UPDATED_AT)
VALUES (SYS_GUID(), src.TENANT_ID, src.FLAG_KEY, src.FLAG_VALUE, src.DESCRIPTION, SYSTIMESTAMP, SYSTIMESTAMP);

-- Default System Settings
MERGE INTO SYSTEM_SETTINGS tgt
USING (
    SELECT NULL AS TENANT_ID, 'session.idle.timeout.minutes' AS SETTING_KEY, '30' AS SETTING_VALUE, 'NUMBER' AS VALUE_TYPE, 'Session idle timeout in minutes' AS DESCRIPTION FROM DUAL UNION ALL
    SELECT NULL, 'session.absolute.timeout.hours', '12', 'NUMBER', 'Session absolute timeout in hours' FROM DUAL UNION ALL
    SELECT NULL, 'otp.validity.seconds', '300', 'NUMBER', 'OTP validity duration in seconds' FROM DUAL UNION ALL
    SELECT NULL, 'otp.max.attempts', '3', 'NUMBER', 'Maximum OTP verification attempts' FROM DUAL UNION ALL
    SELECT NULL, 'rate.limit.login.per.minute', '10', 'NUMBER', 'Login rate limit per account per minute' FROM DUAL UNION ALL
    SELECT NULL, 'rate.limit.api.per.minute', '60', 'NUMBER', 'API rate limit per client per minute' FROM DUAL UNION ALL
    SELECT NULL, 'jwt.access.token.ttl.seconds', '900', 'NUMBER', 'Access token TTL in seconds (15 min)' FROM DUAL UNION ALL
    SELECT NULL, 'jwt.refresh.token.ttl.seconds', '86400', 'NUMBER', 'Refresh token TTL in seconds (24 hours)' FROM DUAL UNION ALL
    SELECT NULL, 'jwt.id.token.ttl.seconds', '3600', 'NUMBER', 'ID token TTL in seconds (1 hour)' FROM DUAL UNION ALL
    SELECT NULL, 'magic.link.ttl.seconds', '600', 'NUMBER', 'Magic link validity in seconds' FROM DUAL UNION ALL
    SELECT NULL, 'backup.codes.count', '10', 'NUMBER', 'Number of backup codes to generate' FROM DUAL
) src ON (NVL(tgt.TENANT_ID, HEXTORAW('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')) = NVL(src.TENANT_ID, HEXTORAW('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')) AND tgt.SETTING_KEY = src.SETTING_KEY)
WHEN NOT MATCHED THEN INSERT (SETTING_ID, TENANT_ID, SETTING_KEY, SETTING_VALUE, VALUE_TYPE, DESCRIPTION, CREATED_AT, UPDATED_AT)
VALUES (SYS_GUID(), src.TENANT_ID, src.SETTING_KEY, src.SETTING_VALUE, src.VALUE_TYPE, src.DESCRIPTION, SYSTIMESTAMP, SYSTIMESTAMP);
