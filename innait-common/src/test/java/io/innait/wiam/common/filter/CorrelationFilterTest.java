package io.innait.wiam.common.filter;

import io.innait.wiam.common.context.CorrelationContext;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class CorrelationFilterTest {

    private CorrelationFilter filter;

    @Mock
    private FilterChain filterChain;

    @BeforeEach
    void setUp() {
        filter = new CorrelationFilter();
        CorrelationContext.clear();
    }

    @AfterEach
    void tearDown() {
        CorrelationContext.clear();
    }

    @Test
    void shouldExtractCorrelationIdFromHeader() throws Exception {
        UUID correlationId = UUID.randomUUID();
        AtomicReference<UUID> captured = new AtomicReference<>();

        doAnswer(inv -> {
            captured.set(CorrelationContext.getCorrelationId());
            return null;
        }).when(filterChain).doFilter(any(), any());

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Correlation-ID", correlationId.toString());
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilterInternal(request, response, filterChain);

        assertThat(captured.get()).isEqualTo(correlationId);
        assertThat(response.getHeader("X-Correlation-ID")).isEqualTo(correlationId.toString());
    }

    @Test
    void shouldGenerateCorrelationIdWhenNotProvided() throws Exception {
        AtomicReference<UUID> captured = new AtomicReference<>();

        doAnswer(inv -> {
            captured.set(CorrelationContext.getCorrelationId());
            return null;
        }).when(filterChain).doFilter(any(), any());

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilterInternal(request, response, filterChain);

        assertThat(captured.get()).isNotNull();
        assertThat(response.getHeader("X-Correlation-ID")).isEqualTo(captured.get().toString());
    }

    @Test
    void shouldGenerateNewIdForInvalidUuid() throws Exception {
        AtomicReference<UUID> captured = new AtomicReference<>();

        doAnswer(inv -> {
            captured.set(CorrelationContext.getCorrelationId());
            return null;
        }).when(filterChain).doFilter(any(), any());

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Correlation-ID", "not-a-valid-uuid");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilterInternal(request, response, filterChain);

        assertThat(captured.get()).isNotNull();
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void shouldClearContextAfterChain() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Correlation-ID", UUID.randomUUID().toString());
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilterInternal(request, response, filterChain);

        assertThat(CorrelationContext.getCorrelationId()).isNull();
    }

    @Test
    void shouldClearContextEvenOnException() throws Exception {
        doAnswer(inv -> { throw new RuntimeException("downstream error"); })
                .when(filterChain).doFilter(any(), any());

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Correlation-ID", UUID.randomUUID().toString());
        MockHttpServletResponse response = new MockHttpServletResponse();

        try {
            filter.doFilterInternal(request, response, filterChain);
        } catch (RuntimeException ignored) {
        }

        assertThat(CorrelationContext.getCorrelationId()).isNull();
    }

    @Test
    void shouldSetResponseHeaderWithCorrelationId() throws Exception {
        UUID correlationId = UUID.randomUUID();
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Correlation-ID", correlationId.toString());
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilterInternal(request, response, filterChain);

        assertThat(response.getHeader("X-Correlation-ID")).isEqualTo(correlationId.toString());
    }
}
