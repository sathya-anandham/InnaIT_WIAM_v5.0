package io.innait.wiam.common.filter;

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
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class TenantContextFilterTest {

    private TenantContextFilter filter;

    @Mock
    private FilterChain filterChain;

    @BeforeEach
    void setUp() {
        filter = new TenantContextFilter();
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldSetTenantIdFromHeader() throws Exception {
        UUID tenantId = UUID.randomUUID();
        AtomicReference<UUID> captured = new AtomicReference<>();

        doAnswer(inv -> { captured.set(TenantContext.getTenantId()); return null; })
                .when(filterChain).doFilter(any(), any());

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Tenant-ID", tenantId.toString());

        filter.doFilterInternal(request, new MockHttpServletResponse(), filterChain);

        assertThat(captured.get()).isEqualTo(tenantId);
    }

    @Test
    void shouldSetTenantIdFromAuthenticationWhenNoHeader() throws Exception {
        UUID tenantId = UUID.randomUUID();
        AtomicReference<UUID> captured = new AtomicReference<>();

        TenantContextFilter.TenantAware tenantAware = () -> tenantId;
        Authentication auth = new TestingAuthenticationToken("user", null);
        auth.setAuthenticated(true);
        ((TestingAuthenticationToken) auth).setDetails(tenantAware);
        SecurityContextHolder.getContext().setAuthentication(auth);

        doAnswer(inv -> { captured.set(TenantContext.getTenantId()); return null; })
                .when(filterChain).doFilter(any(), any());

        filter.doFilterInternal(new MockHttpServletRequest(), new MockHttpServletResponse(), filterChain);

        assertThat(captured.get()).isEqualTo(tenantId);
    }

    @Test
    void shouldNotSetTenantIdWhenNoHeaderAndNoAuth() throws Exception {
        AtomicReference<UUID> captured = new AtomicReference<>();

        doAnswer(inv -> { captured.set(TenantContext.getTenantId()); return null; })
                .when(filterChain).doFilter(any(), any());

        filter.doFilterInternal(new MockHttpServletRequest(), new MockHttpServletResponse(), filterChain);

        assertThat(captured.get()).isNull();
    }

    @Test
    void shouldIgnoreAuthDetailsIfNotTenantAware() throws Exception {
        Authentication auth = new TestingAuthenticationToken("user", null);
        auth.setAuthenticated(true);
        ((TestingAuthenticationToken) auth).setDetails("not-tenant-aware");
        SecurityContextHolder.getContext().setAuthentication(auth);

        AtomicReference<UUID> captured = new AtomicReference<>();
        doAnswer(inv -> { captured.set(TenantContext.getTenantId()); return null; })
                .when(filterChain).doFilter(any(), any());

        filter.doFilterInternal(new MockHttpServletRequest(), new MockHttpServletResponse(), filterChain);

        assertThat(captured.get()).isNull();
    }

    @Test
    void shouldClearTenantContextAfterChain() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Tenant-ID", UUID.randomUUID().toString());

        filter.doFilterInternal(request, new MockHttpServletResponse(), filterChain);

        assertThat(TenantContext.getTenantId()).isNull();
        verify(filterChain).doFilter(any(), any());
    }

    @Test
    void shouldClearTenantContextEvenOnException() throws Exception {
        doAnswer(inv -> { throw new RuntimeException("error"); })
                .when(filterChain).doFilter(any(), any());

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Tenant-ID", UUID.randomUUID().toString());

        try {
            filter.doFilterInternal(request, new MockHttpServletResponse(), filterChain);
        } catch (RuntimeException ignored) {
        }

        assertThat(TenantContext.getTenantId()).isNull();
    }

    @Test
    void shouldSkipBlankTenantHeader() throws Exception {
        AtomicReference<UUID> captured = new AtomicReference<>();
        doAnswer(inv -> { captured.set(TenantContext.getTenantId()); return null; })
                .when(filterChain).doFilter(any(), any());

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Tenant-ID", "   ");

        filter.doFilterInternal(request, new MockHttpServletResponse(), filterChain);

        assertThat(captured.get()).isNull();
    }
}
