package io.innait.wiam.credentialservice.entity;

import io.innait.wiam.common.entity.BaseEntity;
import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(name = "AUTH_MAGIC_LINK_EVENTS")
@AttributeOverride(name = "id", column = @Column(name = "MAGIC_LINK_EVENT_ID", columnDefinition = "RAW(16)"))
public class AuthMagicLinkEvent extends BaseEntity {

    @Column(name = "ACCOUNT_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID accountId;

    @Column(name = "USER_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID userId;

    @Column(name = "AUTH_TXN_ID", columnDefinition = "RAW(16)")
    private UUID authTxnId;

    @Enumerated(EnumType.STRING)
    @Column(name = "EVENT_STATUS", nullable = false, length = 20)
    private MagicLinkEventStatus eventStatus;

    @Column(name = "IP_ADDRESS", length = 100)
    private String ipAddress;

    @Column(name = "USER_AGENT", length = 1000)
    private String userAgent;

    @Lob
    @Column(name = "DETAIL")
    private String detail;

    // Getters and setters

    public UUID getAccountId() { return accountId; }
    public void setAccountId(UUID accountId) { this.accountId = accountId; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public UUID getAuthTxnId() { return authTxnId; }
    public void setAuthTxnId(UUID authTxnId) { this.authTxnId = authTxnId; }

    public MagicLinkEventStatus getEventStatus() { return eventStatus; }
    public void setEventStatus(MagicLinkEventStatus eventStatus) { this.eventStatus = eventStatus; }

    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }

    public String getUserAgent() { return userAgent; }
    public void setUserAgent(String userAgent) { this.userAgent = userAgent; }

    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }
}
