package io.innait.wiam.common.filter;

import io.innait.wiam.common.context.CorrelationContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationFilter extends OncePerRequestFilter {

    public static final String CORRELATION_HEADER = "X-Correlation-ID";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            String correlationHeader = request.getHeader(CORRELATION_HEADER);
            UUID correlationId;
            if (correlationHeader != null && !correlationHeader.isBlank()) {
                try {
                    correlationId = UUID.fromString(correlationHeader.trim());
                } catch (IllegalArgumentException e) {
                    correlationId = UUID.randomUUID();
                }
            } else {
                correlationId = UUID.randomUUID();
            }

            CorrelationContext.setCorrelationId(correlationId);
            response.setHeader(CORRELATION_HEADER, correlationId.toString());

            filterChain.doFilter(request, response);
        } finally {
            CorrelationContext.clear();
        }
    }
}
