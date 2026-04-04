package io.innait.wiam.common.security;

import io.innait.wiam.common.context.TenantContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.sql.DataSource;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.UUID;

@Component
public class TenantSecurityFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(TenantSecurityFilter.class);
    private static final String VPD_CALL = "BEGIN INNAIT_SECURITY.SET_TENANT_CONTEXT(?); END;";

    @Autowired(required = false)
    private DataSource dataSource;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth instanceof InnaITAuthenticationToken token && token.getTenantId() != null) {
                UUID tenantId = token.getTenantId();
                TenantContext.setTenantId(tenantId);
                setVpdContext(tenantId);
            }
            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }

    private void setVpdContext(UUID tenantId) {
        if (dataSource == null) return;
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(VPD_CALL)) {
            ps.setString(1, tenantId.toString());
            ps.execute();
        } catch (SQLException e) {
            log.warn("Failed to set Oracle VPD tenant context: {}", e.getMessage());
        }
    }
}
