package io.innait.wiam.common.security;

import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public class InnaITAuthenticationToken extends AbstractAuthenticationToken {

    private static final long serialVersionUID = 1L;

    private final String subject;
    private final UUID tenantId;
    private final UUID userId;
    private final String loginId;
    private final UUID sessionId;
    private final ArrayList<String> roles;
    private final ArrayList<String> groups;
    private final ArrayList<String> amr;
    private final String acr;
    private final String rawToken;

    @SuppressWarnings("this-escape")
    public InnaITAuthenticationToken(String subject,
                                     UUID tenantId,
                                     UUID userId,
                                     String loginId,
                                     UUID sessionId,
                                     List<String> roles,
                                     List<String> groups,
                                     List<String> amr,
                                     String acr,
                                     String rawToken,
                                     Collection<? extends GrantedAuthority> authorities) {
        super(authorities);
        this.subject = subject;
        this.tenantId = tenantId;
        this.userId = userId;
        this.loginId = loginId;
        this.sessionId = sessionId;
        this.roles = roles != null ? new ArrayList<>(roles) : new ArrayList<>();
        this.groups = groups != null ? new ArrayList<>(groups) : new ArrayList<>();
        this.amr = amr != null ? new ArrayList<>(amr) : new ArrayList<>();
        this.acr = acr;
        this.rawToken = rawToken;
        setAuthenticated(true);
    }

    @Override
    public Object getCredentials() {
        return rawToken;
    }

    @Override
    public Object getPrincipal() {
        return subject;
    }

    public String getSubject() {
        return subject;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getLoginId() {
        return loginId;
    }

    public UUID getSessionId() {
        return sessionId;
    }

    public List<String> getRoles() {
        return roles;
    }

    public List<String> getGroups() {
        return groups;
    }

    public List<String> getAmr() {
        return amr;
    }

    public String getAcr() {
        return acr;
    }
}
