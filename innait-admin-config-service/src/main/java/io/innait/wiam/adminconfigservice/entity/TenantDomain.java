package io.innait.wiam.adminconfigservice.entity;

import io.innait.wiam.common.entity.BaseEntity;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "TENANT_DOMAINS")
@AttributeOverride(name = "id", column = @Column(name = "DOMAIN_ID", columnDefinition = "RAW(16)"))
public class TenantDomain extends BaseEntity {

    @Column(name = "DOMAIN_NAME", nullable = false, length = 255)
    private String domainName;

    @Enumerated(EnumType.STRING)
    @Column(name = "VERIFICATION_STATUS", nullable = false, length = 20)
    private DomainVerificationStatus verificationStatus = DomainVerificationStatus.PENDING;

    @Column(name = "VERIFICATION_TOKEN", length = 255)
    private String verificationToken;

    @Column(name = "VERIFIED_AT")
    private Instant verifiedAt;

    @Column(name = "IS_PRIMARY", nullable = false)
    private boolean primary;

    protected TenantDomain() {}

    public TenantDomain(String domainName) {
        this.domainName = domainName;
        this.verificationToken = "innait-verify-" + UUID.randomUUID();
        this.verificationStatus = DomainVerificationStatus.PENDING;
    }

    // Getters
    public String getDomainName() { return domainName; }
    public DomainVerificationStatus getVerificationStatus() { return verificationStatus; }
    public String getVerificationToken() { return verificationToken; }
    public Instant getVerifiedAt() { return verifiedAt; }
    public boolean isPrimary() { return primary; }

    // Setters
    public void setPrimary(boolean primary) { this.primary = primary; }

    public void markVerified() {
        this.verificationStatus = DomainVerificationStatus.VERIFIED;
        this.verifiedAt = Instant.now();
    }

    public void markFailed() {
        this.verificationStatus = DomainVerificationStatus.FAILED;
    }

    public void markExpired() {
        this.verificationStatus = DomainVerificationStatus.EXPIRED;
    }
}
