-- ============================================================================
-- InnaIT WIAM 5.0 - INNAIT_IDENTITY Schema
-- V002: Add missing domain columns for entity layer
-- ============================================================================

--------------------------------------------------------
-- USERS: add employee/HR fields and audit columns
--------------------------------------------------------
ALTER TABLE USERS ADD (
    EMPLOYEE_NO          VARCHAR2(50),
    PHONE_COUNTRY_CODE   VARCHAR2(5),
    PHONE_NUMBER         VARCHAR2(30),
    DEPARTMENT           VARCHAR2(100),
    DESIGNATION          VARCHAR2(100),
    CREATED_BY           RAW(16),
    UPDATED_BY           RAW(16)
);

CREATE INDEX IDX_USR_EMPNO ON USERS (TENANT_ID, EMPLOYEE_NO);
CREATE INDEX IDX_USR_DEPT ON USERS (TENANT_ID, DEPARTMENT);

--------------------------------------------------------
-- ACCOUNTS: add soft-delete, auth tracking, audit columns
--------------------------------------------------------
ALTER TABLE ACCOUNTS ADD (
    IS_DELETED           NUMBER(1) DEFAULT 0 NOT NULL,
    DELETED_AT           TIMESTAMP WITH TIME ZONE,
    LAST_LOGIN_IP        VARCHAR2(50),
    PASSWORD_CHANGED_AT  TIMESTAMP WITH TIME ZONE,
    MUST_CHANGE_PASSWORD NUMBER(1) DEFAULT 0 NOT NULL,
    CREATED_BY           RAW(16),
    UPDATED_BY           RAW(16)
);

ALTER TABLE ACCOUNTS ADD CONSTRAINT CHK_ACCT_DELETED CHECK (IS_DELETED IN (0, 1));
ALTER TABLE ACCOUNTS ADD CONSTRAINT CHK_ACCT_MUST_CHG CHECK (MUST_CHANGE_PASSWORD IN (0, 1));
CREATE INDEX IDX_ACCT_DELETED ON ACCOUNTS (TENANT_ID, IS_DELETED);
