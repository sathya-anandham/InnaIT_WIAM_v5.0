package io.innait.wiam.credentialservice.entity;

import io.innait.wiam.common.entity.BaseEntity;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ACCOUNT_BOOTSTRAP_STATE")
@AttributeOverride(name = "id", column = @Column(name = "BOOTSTRAP_STATE_ID", columnDefinition = "RAW(16)"))
public class AccountBootstrapState extends BaseEntity {

    @Column(name = "ACCOUNT_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID accountId;

    @Column(name = "USER_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "BOOTSTRAP_METHOD", nullable = false, length = 30)
    private BootstrapMethod bootstrapMethod = BootstrapMethod.MAGIC_LINK;

    @Column(name = "BOOTSTRAP_ENABLED", nullable = false)
    private boolean bootstrapEnabled = true;

    @Column(name = "FIRST_LOGIN_PENDING", nullable = false)
    private boolean firstLoginPending = true;

    @Column(name = "FIDO_ENROLLED", nullable = false)
    private boolean fidoEnrolled = false;

    @Column(name = "MAGIC_LINK_LAST_SENT_AT")
    private Instant magicLinkLastSentAt;

    @Column(name = "MAGIC_LINK_LAST_VERIFIED_AT")
    private Instant magicLinkLastVerifiedAt;

    @Column(name = "MAGIC_LINK_EXPIRES_AT")
    private Instant magicLinkExpiresAt;

    @Column(name = "MAGIC_LINK_USED_AT")
    private Instant magicLinkUsedAt;

    @Column(name = "LAST_MAGIC_LINK_TXN_ID", columnDefinition = "RAW(16)")
    private UUID lastMagicLinkTxnId;

    // Getters and setters

    public UUID getAccountId() { return accountId; }
    public void setAccountId(UUID accountId) { this.accountId = accountId; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public BootstrapMethod getBootstrapMethod() { return bootstrapMethod; }
    public void setBootstrapMethod(BootstrapMethod bootstrapMethod) { this.bootstrapMethod = bootstrapMethod; }

    public boolean isBootstrapEnabled() { return bootstrapEnabled; }
    public void setBootstrapEnabled(boolean bootstrapEnabled) { this.bootstrapEnabled = bootstrapEnabled; }

    public boolean isFirstLoginPending() { return firstLoginPending; }
    public void setFirstLoginPending(boolean firstLoginPending) { this.firstLoginPending = firstLoginPending; }

    public boolean isFidoEnrolled() { return fidoEnrolled; }
    public void setFidoEnrolled(boolean fidoEnrolled) { this.fidoEnrolled = fidoEnrolled; }

    public Instant getMagicLinkLastSentAt() { return magicLinkLastSentAt; }
    public void setMagicLinkLastSentAt(Instant magicLinkLastSentAt) { this.magicLinkLastSentAt = magicLinkLastSentAt; }

    public Instant getMagicLinkLastVerifiedAt() { return magicLinkLastVerifiedAt; }
    public void setMagicLinkLastVerifiedAt(Instant magicLinkLastVerifiedAt) { this.magicLinkLastVerifiedAt = magicLinkLastVerifiedAt; }

    public Instant getMagicLinkExpiresAt() { return magicLinkExpiresAt; }
    public void setMagicLinkExpiresAt(Instant magicLinkExpiresAt) { this.magicLinkExpiresAt = magicLinkExpiresAt; }

    public Instant getMagicLinkUsedAt() { return magicLinkUsedAt; }
    public void setMagicLinkUsedAt(Instant magicLinkUsedAt) { this.magicLinkUsedAt = magicLinkUsedAt; }

    public UUID getLastMagicLinkTxnId() { return lastMagicLinkTxnId; }
    public void setLastMagicLinkTxnId(UUID lastMagicLinkTxnId) { this.lastMagicLinkTxnId = lastMagicLinkTxnId; }
}
