package io.innait.wiam.common.security;

import io.innait.wiam.common.context.TenantContext;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TenantSecurityFilterTest {

    @Mock
    private DataSource dataSource;

    @Mock
    private Connection connection;

    @Mock
    private PreparedStatement preparedStatement;

    @Mock
    private FilterChain filterChain;

    private TenantSecurityFilter filter;

    @BeforeEach
    void setUp() {
        filter = new TenantSecurityFilter();
        ReflectionTestUtils.setField(filter, "dataSource", dataSource);
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    @Test
    void shouldSetTenantContextFromAuthentication() throws Exception {
        UUID tenantId = UUID.randomUUID();
        setUpAuthentication(tenantId);
        setUpDataSource();

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        // TenantContext is cleared in finally block, so verify VPD call happened
        verify(preparedStatement).setString(1, tenantId.toString());
        verify(preparedStatement).execute();
    }

    @Test
    void shouldCallVpdContextWithTenantId() throws Exception {
        UUID tenantId = UUID.randomUUID();
        setUpAuthentication(tenantId);
        setUpDataSource();

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilterInternal(request, response, filterChain);

        verify(connection).prepareStatement("BEGIN INNAIT_SECURITY.SET_TENANT_CONTEXT(?); END;");
        verify(preparedStatement).setString(1, tenantId.toString());
        verify(preparedStatement).execute();
        verify(connection).close();
    }

    @Test
    void shouldClearTenantContextAfterFilterChain() throws Exception {
        UUID tenantId = UUID.randomUUID();
        setUpAuthentication(tenantId);
        setUpDataSource();

        // Verify tenant is set during filter chain execution
        doAnswer(invocation -> {
            assertThat(TenantContext.getTenantId()).isEqualTo(tenantId);
            return null;
        }).when(filterChain).doFilter(any(), any());

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilterInternal(request, response, filterChain);

        // After filter completes, tenant context should be cleared
        assertThat(TenantContext.getTenantId()).isNull();
    }

    @Test
    void shouldClearTenantContextEvenOnException() throws Exception {
        UUID tenantId = UUID.randomUUID();
        setUpAuthentication(tenantId);
        setUpDataSource();

        doThrow(new RuntimeException("downstream error")).when(filterChain).doFilter(any(), any());

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        try {
            filter.doFilterInternal(request, response, filterChain);
        } catch (RuntimeException ignored) {
            // expected
        }

        assertThat(TenantContext.getTenantId()).isNull();
    }

    @Test
    void shouldSkipTenantContextWhenNoAuthentication() throws Exception {
        // No authentication set in SecurityContext
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        verifyNoInteractions(dataSource);
        assertThat(TenantContext.getTenantId()).isNull();
    }

    @Test
    void shouldHandleVpdFailureGracefully() throws Exception {
        UUID tenantId = UUID.randomUUID();
        setUpAuthentication(tenantId);
        when(dataSource.getConnection()).thenThrow(new SQLException("VPD unavailable"));

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        // Should not throw - VPD failure is logged as warning
        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
    }

    private void setUpAuthentication(UUID tenantId) {
        var token = new InnaITAuthenticationToken(
                "user@innait.io", tenantId, UUID.randomUUID(), "user", UUID.randomUUID(),
                List.of("USER"), List.of(), List.of("pwd"), "aal1", "jwt-token",
                List.of(new SimpleGrantedAuthority("ROLE_USER"))
        );
        SecurityContextHolder.getContext().setAuthentication(token);
    }

    private void setUpDataSource() throws SQLException {
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.prepareStatement(anyString())).thenReturn(preparedStatement);
    }
}
