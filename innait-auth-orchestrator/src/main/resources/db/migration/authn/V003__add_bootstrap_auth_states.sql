-- ============================================================================
-- InnaIT WIAM 5.0 - INNAIT_AUTHN Schema
-- V003: Add bootstrap/magic-link auth states and MAGIC_LINK factor type
-- ============================================================================

ALTER TABLE AUTH_TRANSACTIONS DROP CONSTRAINT CHK_ATXN_STATE;

ALTER TABLE AUTH_TRANSACTIONS ADD CONSTRAINT CHK_ATXN_STATE
    CHECK (CURRENT_STATE IN (
        'INITIATED','IDENTIFIER_COLLECTED','PRIMARY_CHALLENGE','PRIMARY_VERIFIED',
        'MFA_REQUIRED','MFA_CHALLENGE','MFA_VERIFIED',
        'MAGIC_LINK_SENT','ONBOARDING_REQUIRED','FIDO_ENROLLMENT_IN_PROGRESS',
        'COMPLETED','FAILED','ABORTED'
    ));

-- CHK_AC_TYPE already includes MAGIC_LINK from V001 - no change needed
