package io.innait.wiam.common.security;

import io.innait.wiam.common.context.TenantContext;
import org.springframework.security.access.PermissionEvaluator;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.io.Serializable;
import java.util.UUID;

@Component
public class TenantAwarePermissionEvaluator implements PermissionEvaluator {

    @Override
    public boolean hasPermission(Authentication authentication, Object targetDomainObject, Object permission) {
        if (!(authentication instanceof InnaITAuthenticationToken token)) {
            return false;
        }
        UUID contextTenant = TenantContext.getTenantId();
        if (contextTenant != null && !contextTenant.equals(token.getTenantId())) {
            return false;
        }
        return hasRolePermission(token, String.valueOf(permission));
    }

    @Override
    public boolean hasPermission(Authentication authentication, Serializable targetId,
                                 String targetType, Object permission) {
        if (!(authentication instanceof InnaITAuthenticationToken token)) {
            return false;
        }
        UUID contextTenant = TenantContext.getTenantId();
        if (contextTenant != null && !contextTenant.equals(token.getTenantId())) {
            return false;
        }
        return hasRolePermission(token, String.valueOf(permission));
    }

    private boolean hasRolePermission(InnaITAuthenticationToken token, String permission) {
        return token.getRoles().contains(permission);
    }
}
