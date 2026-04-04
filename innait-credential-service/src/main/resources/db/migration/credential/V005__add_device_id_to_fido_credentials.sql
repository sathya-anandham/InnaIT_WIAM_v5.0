-- ============================================================================
-- InnaIT WIAM 5.0 - INNAIT_CREDENTIAL Schema
-- V005: Add DEVICE_ID to FIDO_CREDENTIALS for device registry linkage
-- ============================================================================

ALTER TABLE FIDO_CREDENTIALS ADD (
    DEVICE_ID RAW(16)
);

CREATE INDEX IDX_FIDO_DEVICE ON FIDO_CREDENTIALS (DEVICE_ID);
