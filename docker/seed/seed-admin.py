"""
InnaIT WIAM Seed Script
-----------------------
Seeds the Oracle database with:
  - A demo tenant
  - A SUPER_ADMIN role
  - An admin user + account
  - A BCrypt password credential

Runs after all services are healthy.
"""
import os
import sys
import time
import uuid
import bcrypt
import oracledb

# ── Configuration from environment ──────────────────────────────────────────
ORACLE_HOST     = os.getenv("ORACLE_HOST", "innait-oracle-db")
ORACLE_PORT     = int(os.getenv("ORACLE_PORT", "1521"))
ORACLE_SERVICE  = os.getenv("ORACLE_SERVICE", "FREEPDB1")
ORACLE_USER     = os.getenv("ORACLE_WIAM_USER", "wiam")
ORACLE_PASSWORD = os.getenv("ORACLE_WIAM_PASSWORD", "WiamAdmin2025")

TENANT_CODE     = os.getenv("SEED_TENANT_CODE", "demo")
TENANT_NAME     = os.getenv("SEED_TENANT_NAME", "Demo Organization")
ADMIN_EMAIL     = os.getenv("SEED_ADMIN_EMAIL", "admin@demo.local")
ADMIN_PASSWORD  = os.getenv("SEED_ADMIN_PASSWORD", "Admin@12345")
ADMIN_FIRSTNAME = os.getenv("SEED_ADMIN_FIRSTNAME", "System")
ADMIN_LASTNAME  = os.getenv("SEED_ADMIN_LASTNAME", "Admin")

MAX_RETRIES = 30
RETRY_DELAY = 10  # seconds


def wait_for_oracle():
    """Retry connection until Oracle is ready."""
    dsn = oracledb.makedsn(ORACLE_HOST, ORACLE_PORT, service_name=ORACLE_SERVICE)
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            conn = oracledb.connect(user=ORACLE_USER, password=ORACLE_PASSWORD, dsn=dsn)
            conn.close()
            print(f"Oracle ready after {attempt} attempt(s).")
            return
        except oracledb.Error as e:
            print(f"[{attempt}/{MAX_RETRIES}] Oracle not ready yet: {e}. Retrying in {RETRY_DELAY}s...")
            time.sleep(RETRY_DELAY)
    print("Oracle did not become ready in time. Exiting.")
    sys.exit(1)


def wait_for_schemas(conn):
    """Wait until Flyway has created the required schemas."""
    required_tables = [
        ("INNAIT_TENANT", "TENANTS"),
        ("INNAIT_IDENTITY", "USERS"),
        ("INNAIT_IDENTITY", "ACCOUNTS"),
        ("INNAIT_IDENTITY", "ROLES"),
        ("INNAIT_IDENTITY", "ACCOUNT_ROLE_MAP"),
        ("INNAIT_CREDENTIAL", "PASSWORD_CREDENTIALS"),
    ]
    for attempt in range(1, MAX_RETRIES + 1):
        cursor = conn.cursor()
        try:
            missing = []
            for schema, table in required_tables:
                cursor.execute(
                    "SELECT COUNT(*) FROM all_tables WHERE owner = :1 AND table_name = :2",
                    [schema, table]
                )
                if cursor.fetchone()[0] == 0:
                    missing.append(f"{schema}.{table}")
            if not missing:
                print("All required tables are present.")
                return
            print(f"[{attempt}/{MAX_RETRIES}] Waiting for Flyway tables: {missing}. Retrying in {RETRY_DELAY}s...")
        except oracledb.Error as e:
            print(f"[{attempt}/{MAX_RETRIES}] Schema check error: {e}")
        finally:
            cursor.close()
        time.sleep(RETRY_DELAY)
    print("Required schemas/tables did not appear in time. Exiting.")
    sys.exit(1)


def uuid_to_raw16(u: uuid.UUID) -> bytes:
    """Convert a Python UUID to Oracle RAW(16) bytes."""
    return u.bytes


def already_seeded(conn) -> bool:
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT COUNT(*) FROM INNAIT_TENANT.TENANTS WHERE TENANT_CODE = :1",
            [TENANT_CODE]
        )
        return cursor.fetchone()[0] > 0
    finally:
        cursor.close()


def seed(conn):
    tenant_id  = uuid.uuid4()
    user_id    = uuid.uuid4()
    account_id = uuid.uuid4()
    role_id    = uuid.uuid4()
    pw_cred_id = uuid.uuid4()

    # BCrypt hash (cost 12)
    password_hash = bcrypt.hashpw(
        ADMIN_PASSWORD.encode("utf-8"),
        bcrypt.gensalt(rounds=12)
    ).decode("utf-8")

    tid  = uuid_to_raw16(tenant_id)
    uid  = uuid_to_raw16(user_id)
    aid  = uuid_to_raw16(account_id)
    rid  = uuid_to_raw16(role_id)
    pwid = uuid_to_raw16(pw_cred_id)

    cursor = conn.cursor()
    try:
        # 1. Tenant
        cursor.execute("""
            INSERT INTO INNAIT_TENANT.TENANTS
              (TENANT_ID, TENANT_CODE, TENANT_NAME, STATUS, SUBSCRIPTION_TIER, BRANDING_CONFIG)
            VALUES
              (:1, :2, :3, 'ACTIVE', 'ENTERPRISE', '{}')
        """, [tid, TENANT_CODE, TENANT_NAME])

        # 2. User
        cursor.execute("""
            INSERT INTO INNAIT_IDENTITY.USERS
              (USER_ID, TENANT_ID, EMAIL, FIRST_NAME, LAST_NAME, DISPLAY_NAME,
               USER_TYPE, STATUS, IS_DELETED)
            VALUES
              (:1, :2, :3, :4, :5, :6, 'EMPLOYEE', 'ACTIVE', 0)
        """, [uid, tid, ADMIN_EMAIL, ADMIN_FIRSTNAME, ADMIN_LASTNAME,
              f"{ADMIN_FIRSTNAME} {ADMIN_LASTNAME}"])

        # 3. Account
        cursor.execute("""
            INSERT INTO INNAIT_IDENTITY.ACCOUNTS
              (ACCOUNT_ID, USER_ID, TENANT_ID, LOGIN_ID, ACCOUNT_STATUS, IS_PASSWORD_ENABLED)
            VALUES
              (:1, :2, :3, :4, 'ACTIVE', 1)
        """, [aid, uid, tid, ADMIN_EMAIL])

        # 4. SUPER_ADMIN role
        cursor.execute("""
            INSERT INTO INNAIT_IDENTITY.ROLES
              (ROLE_ID, TENANT_ID, ROLE_CODE, ROLE_NAME, ROLE_TYPE, IS_SYSTEM, STATUS)
            VALUES
              (:1, :2, 'SUPER_ADMIN', 'Super Administrator', 'ADMIN', 1, 'ACTIVE')
        """, [rid, tid])

        # 5. Account → Role mapping
        arm_id = uuid_to_raw16(uuid.uuid4())
        cursor.execute("""
            INSERT INTO INNAIT_IDENTITY.ACCOUNT_ROLE_MAP
              (ACCOUNT_ROLE_ID, ACCOUNT_ID, ROLE_ID, TENANT_ID,
               ASSIGNMENT_SOURCE, IS_ACTIVE)
            VALUES
              (:1, :2, :3, :4, 'MANUAL', 1)
        """, [arm_id, aid, rid, tid])

        # 6. Password credential (BCrypt)
        cursor.execute("""
            INSERT INTO INNAIT_CREDENTIAL.PASSWORD_CREDENTIALS
              (PASSWORD_CRED_ID, ACCOUNT_ID, TENANT_ID, PASSWORD_HASH,
               HASH_ALGORITHM, IS_ACTIVE, MUST_CHANGE, CREDENTIAL_STATUS)
            VALUES
              (:1, :2, :3, :4, 'BCRYPT', 1, 0, 'ACTIVE')
        """, [pwid, aid, tid, password_hash])

        conn.commit()
        print(f"""
============================================================
  Seed completed successfully!

  Tenant     : {TENANT_CODE}  ({tenant_id})
  Admin user : {ADMIN_EMAIL}
  Password   : {ADMIN_PASSWORD}
  Role       : SUPER_ADMIN

  Login at   : http://localhost:4200
              (enter '{TENANT_CODE}' as organization)
============================================================
""")
    except oracledb.IntegrityError as e:
        print(f"IntegrityError (data may already exist): {e}")
        conn.rollback()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()


def main():
    print("InnaIT WIAM Seed Script starting...")
    wait_for_oracle()

    dsn  = oracledb.makedsn(ORACLE_HOST, ORACLE_PORT, service_name=ORACLE_SERVICE)
    conn = oracledb.connect(user=ORACLE_USER, password=ORACLE_PASSWORD, dsn=dsn)
    try:
        wait_for_schemas(conn)
        if already_seeded(conn):
            print(f"Tenant '{TENANT_CODE}' already exists. Skipping seed.")
        else:
            seed(conn)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
