package io.innait.wiam.common.exception;

import io.innait.wiam.common.dto.ApiResponse;
import jakarta.persistence.OptimisticLockException;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

import org.springframework.core.MethodParameter;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void shouldHandleResourceNotFound() {
        var ex = new ResourceNotFoundException("User", UUID.randomUUID().toString());
        var response = handler.handleNotFound(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody().error().code()).isEqualTo("NOT_FOUND");
    }

    @Test
    void shouldHandleTenantMismatch() {
        var ex = new TenantMismatchException(UUID.randomUUID(), UUID.randomUUID());
        var response = handler.handleTenantMismatch(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody().error().code()).isEqualTo("TENANT_MISMATCH");
        assertThat(response.getBody().error().message()).isEqualTo("Access denied");
    }

    @Test
    void shouldHandleConcurrencyException() {
        var ex = new ConcurrencyException("User", UUID.randomUUID().toString());
        var response = handler.handleConcurrency(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().error().code()).isEqualTo("CONCURRENCY_CONFLICT");
    }

    @Test
    void shouldHandleOptimisticLock() {
        var ex = new OptimisticLockException("stale");
        var response = handler.handleOptimisticLock(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().error().code()).isEqualTo("OPTIMISTIC_LOCK");
    }

    @Test
    void shouldHandleAuthenticationFlowException() {
        var ex = new AuthenticationFlowException("MFA_REQUIRED", "mfa-challenge", "Multi-factor authentication required");
        var response = handler.handleAuthFlow(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody().error().code()).isEqualTo("MFA_REQUIRED");
        assertThat(response.getBody().error().message()).isEqualTo("Multi-factor authentication required");
    }

    @Test
    @SuppressWarnings("unchecked")
    void shouldHandleConstraintViolation() {
        ConstraintViolation<Object> violation = mock(ConstraintViolation.class);
        when(violation.getMessage()).thenReturn("must not be blank");
        var ex = new ConstraintViolationException(Set.of(violation));

        var response = handler.handleConstraintViolation(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().error().code()).isEqualTo("VALIDATION_ERROR");
        assertThat(response.getBody().error().message()).contains("must not be blank");
    }

    @Test
    void shouldHandleMethodArgumentNotValid() {
        BindingResult bindingResult = mock(BindingResult.class);
        FieldError fieldError = new FieldError("user", "email", "must be a valid email");
        when(bindingResult.getFieldErrors()).thenReturn(List.of(fieldError));

        MethodParameter methodParameter = mock(MethodParameter.class);
        var ex = new MethodArgumentNotValidException(methodParameter, bindingResult);
        var response = handler.handleValidation(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().error().code()).isEqualTo("VALIDATION_ERROR");
        assertThat(response.getBody().error().message()).contains("email: must be a valid email");
    }

    @Test
    void shouldHandleAccessDenied() {
        var ex = new AccessDeniedException("Forbidden");
        var response = handler.handleAccessDenied(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody().error().code()).isEqualTo("ACCESS_DENIED");
    }

    @Test
    void shouldHandleAuthenticationException() {
        var ex = new BadCredentialsException("Bad credentials");
        var response = handler.handleAuthentication(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody().error().code()).isEqualTo("UNAUTHORIZED");
    }

    @Test
    void shouldHandleGenericException() {
        var ex = new RuntimeException("Something went wrong");
        var response = handler.handleGeneric(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody().error().code()).isEqualTo("INTERNAL_ERROR");
        assertThat(response.getBody().error().message()).isEqualTo("An unexpected error occurred");
    }

    @Test
    void allResponsesShouldHaveErrorStatus() {
        var response = handler.handleGeneric(new RuntimeException("test"));
        assertThat(response.getBody().status()).isEqualTo(ApiResponse.Status.ERROR);
        assertThat(response.getBody().data()).isNull();
    }
}
