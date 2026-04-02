package io.innait.wiam.adminconfigservice.entity;

import io.innait.wiam.common.entity.BaseEntity;
import jakarta.persistence.*;

@Entity
@Table(name = "APPLICATIONS")
@AttributeOverride(name = "id", column = @Column(name = "APP_ID", columnDefinition = "RAW(16)"))
public class Application extends BaseEntity {

    @Column(name = "APP_CODE", nullable = false, length = 100)
    private String appCode;

    @Column(name = "APP_NAME", nullable = false, length = 255)
    private String appName;

    @Enumerated(EnumType.STRING)
    @Column(name = "APP_TYPE", nullable = false, length = 30)
    private AppType appType;

    @Enumerated(EnumType.STRING)
    @Column(name = "STATUS", nullable = false, length = 20)
    private AppStatus status = AppStatus.ACTIVE;

    @Column(name = "APP_URL", length = 2000)
    private String appUrl;

    @Column(name = "DESCRIPTION", length = 1000)
    private String description;

    protected Application() {}

    public Application(String appCode, String appName, AppType appType,
                       String appUrl, String description) {
        this.appCode = appCode;
        this.appName = appName;
        this.appType = appType;
        this.appUrl = appUrl;
        this.description = description;
    }

    // Getters
    public String getAppCode() { return appCode; }
    public String getAppName() { return appName; }
    public AppType getAppType() { return appType; }
    public AppStatus getStatus() { return status; }
    public String getAppUrl() { return appUrl; }
    public String getDescription() { return description; }

    // Setters
    public void setAppName(String appName) { this.appName = appName; }
    public void setAppType(AppType appType) { this.appType = appType; }
    public void setStatus(AppStatus status) { this.status = status; }
    public void setAppUrl(String appUrl) { this.appUrl = appUrl; }
    public void setDescription(String description) { this.description = description; }
}
