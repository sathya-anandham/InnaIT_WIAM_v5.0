-- ============================================================================
-- InnaIT WIAM 5.0 - INNAIT_AUTHN Schema
-- V002: Add MFA_VERIFIED and ABORTED states to AUTH_TRANSACTIONS
-- ============================================================================

ALTER TABLE AUTH_TRANSACTIONS DROP CONSTRAINT CHK_ATXN_STATE;

ALTER TABLE AUTH_TRANSACTIONS ADD CONSTRAINT CHK_ATXN_STATE
    CHECK (CURRENT_STATE IN (
        'INITIATED','IDENTIFIER_COLLECTED','PRIMARY_CHALLENGE','PRIMARY_VERIFIED',
        'MFA_REQUIRED','MFA_CHALLENGE','MFA_VERIFIED','COMPLETED','FAILED','ABORTED'
    ));
