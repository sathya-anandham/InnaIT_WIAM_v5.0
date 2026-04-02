package io.innait.wiam.adminbff.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "wiam.services")
public class BffProperties {

    private String identityUrl;
    private String credentialUrl;
    private String authUrl;
    private String sessionUrl;
    private String policyUrl;
    private String auditUrl;
    private String notificationUrl;
    private String configUrl;
    private String tokenUrl;

    public String getIdentityUrl() { return identityUrl; }
    public void setIdentityUrl(String identityUrl) { this.identityUrl = identityUrl; }
    public String getCredentialUrl() { return credentialUrl; }
    public void setCredentialUrl(String credentialUrl) { this.credentialUrl = credentialUrl; }
    public String getAuthUrl() { return authUrl; }
    public void setAuthUrl(String authUrl) { this.authUrl = authUrl; }
    public String getSessionUrl() { return sessionUrl; }
    public void setSessionUrl(String sessionUrl) { this.sessionUrl = sessionUrl; }
    public String getPolicyUrl() { return policyUrl; }
    public void setPolicyUrl(String policyUrl) { this.policyUrl = policyUrl; }
    public String getAuditUrl() { return auditUrl; }
    public void setAuditUrl(String auditUrl) { this.auditUrl = auditUrl; }
    public String getNotificationUrl() { return notificationUrl; }
    public void setNotificationUrl(String notificationUrl) { this.notificationUrl = notificationUrl; }
    public String getConfigUrl() { return configUrl; }
    public void setConfigUrl(String configUrl) { this.configUrl = configUrl; }
    public String getTokenUrl() { return tokenUrl; }
    public void setTokenUrl(String tokenUrl) { this.tokenUrl = tokenUrl; }
}
