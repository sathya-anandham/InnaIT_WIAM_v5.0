#!/bin/bash
# Creates the 'wiam' application user in FREEPDB1.
# Flyway will automatically create individual schema users (INNAIT_IDENTITY etc.)
# when each Spring Boot service starts, using wiam's DBA privileges.
set -e

WIAM_PASS="${ORACLE_WIAM_PASSWORD:-WiamAdmin2025}"

echo "Creating wiam user in FREEPDB1..."
sqlplus -s "sys/${ORACLE_PASSWORD}@//localhost:1521/FREEPDB1 AS SYSDBA" <<EOF
WHENEVER SQLERROR EXIT SQL.SQLCODE

CREATE USER wiam IDENTIFIED BY "${WIAM_PASS}"
  DEFAULT TABLESPACE USERS
  TEMPORARY TABLESPACE TEMP
  QUOTA UNLIMITED ON USERS;

GRANT DBA TO wiam;

COMMIT;
EXIT;
EOF

echo "Oracle WIAM user created successfully."
