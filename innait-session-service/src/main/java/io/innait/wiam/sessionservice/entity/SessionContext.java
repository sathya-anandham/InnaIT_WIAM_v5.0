package io.innait.wiam.sessionservice.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "SESSION_CONTEXT")
public class SessionContext {

    @Id
    @Column(name = "SESSION_CONTEXT_ID", columnDefinition = "RAW(16)", updatable = false, nullable = false)
    private UUID sessionContextId;

    @Column(name = "SESSION_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID sessionId;

    @Column(name = "TENANT_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID tenantId;

    @Column(name = "IP_ADDRESS", length = 45, nullable = false)
    private String ipAddress;

    @Column(name = "USER_AGENT", length = 1000)
    private String userAgent;

    @Column(name = "DEVICE_FINGERPRINT", length = 512)
    private String deviceFingerprint;

    @Column(name = "GEO_COUNTRY", length = 3)
    private String geoCountry;

    @Column(name = "GEO_REGION", length = 100)
    private String geoRegion;

    @Column(name = "GEO_CITY", length = 100)
    private String geoCity;

    @Column(name = "GEO_LATITUDE", precision = 10, scale = 7)
    private BigDecimal geoLatitude;

    @Column(name = "GEO_LONGITUDE", precision = 10, scale = 7)
    private BigDecimal geoLongitude;

    @Column(name = "DEVICE_TRUST_SCORE", precision = 5, scale = 2)
    private BigDecimal deviceTrustScore;

    @Column(name = "CREATED_AT", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        if (sessionContextId == null) sessionContextId = UUID.randomUUID();
        createdAt = Instant.now();
    }

    // Getters and setters

    public UUID getSessionContextId() { return sessionContextId; }
    public void setSessionContextId(UUID sessionContextId) { this.sessionContextId = sessionContextId; }

    public UUID getSessionId() { return sessionId; }
    public void setSessionId(UUID sessionId) { this.sessionId = sessionId; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }

    public String getUserAgent() { return userAgent; }
    public void setUserAgent(String userAgent) { this.userAgent = userAgent; }

    public String getDeviceFingerprint() { return deviceFingerprint; }
    public void setDeviceFingerprint(String deviceFingerprint) { this.deviceFingerprint = deviceFingerprint; }

    public String getGeoCountry() { return geoCountry; }
    public void setGeoCountry(String geoCountry) { this.geoCountry = geoCountry; }

    public String getGeoRegion() { return geoRegion; }
    public void setGeoRegion(String geoRegion) { this.geoRegion = geoRegion; }

    public String getGeoCity() { return geoCity; }
    public void setGeoCity(String geoCity) { this.geoCity = geoCity; }

    public BigDecimal getGeoLatitude() { return geoLatitude; }
    public void setGeoLatitude(BigDecimal geoLatitude) { this.geoLatitude = geoLatitude; }

    public BigDecimal getGeoLongitude() { return geoLongitude; }
    public void setGeoLongitude(BigDecimal geoLongitude) { this.geoLongitude = geoLongitude; }

    public BigDecimal getDeviceTrustScore() { return deviceTrustScore; }
    public void setDeviceTrustScore(BigDecimal deviceTrustScore) { this.deviceTrustScore = deviceTrustScore; }

    public Instant getCreatedAt() { return createdAt; }
}
