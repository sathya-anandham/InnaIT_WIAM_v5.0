package io.innait.wiam.authorchestrator.controller;

import io.innait.wiam.common.dto.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Login Portal flow contract endpoint.
 * Returns the expected API interaction sequence for the login portal UI
 * to implement magic link bootstrap login and FIDO onboarding flows.
 *
 * <h2>Magic Link Login Flow</h2>
 * <pre>
 * 1. POST /api/v1/auth/login/initiate         → { txnId, state: "PRIMARY_CHALLENGE", primaryMethods: ["MAGIC_LINK"] }
 * 2. POST /api/v1/auth/login/magic-link/send   → { txnId, state: "MAGIC_LINK_SENT", expiresAt }
 *    → UI shows "Check your email" page at /login/magic-link-sent
 * 3. GET  /api/v1/auth/login/magic-link/verify?token=... → { txnId, state: "ONBOARDING_REQUIRED", verified, bootstrapSessionId, onboardingRequired }
 *    → UI redirects to /login/onboarding
 * </pre>
 *
 * <h2>Onboarding / FIDO Enrollment Flow</h2>
 * <pre>
 * 4. POST /api/v1/auth/bootstrap/session/validate → { sessionId, accountId, tenantId, type: "BOOTSTRAP", valid }
 * 5. POST /api/v1/auth/bootstrap/{txnId}/fido-enrollment/start → { txnId, state: "FIDO_ENROLLMENT_IN_PROGRESS" }
 * 6. POST /api/v1/credentials/fido/register/device-aware/begin  → { txnId, publicKeyCredentialCreationOptions }
 *    → UI invokes navigator.credentials.create()
 * 7. POST /api/v1/credentials/fido/register/device-aware/complete → { credentialId, displayName, status }
 * 8. POST /api/v1/auth/bootstrap/{txnId}/fido-enrollment/complete → { txnId, state: "COMPLETED" }
 *    → Bootstrap session is expired, user receives full authenticated session
 * </pre>
 */
@RestController
@RequestMapping("/api/v1/auth/portal")
public class LoginPortalFlowController {

    @GetMapping("/flows/magic-link-bootstrap")
    public ApiResponse<Map<String, Object>> getMagicLinkBootstrapFlow() {
        Map<String, Object> flow = new LinkedHashMap<>();

        // Step 1: Initiate auth — returns MAGIC_LINK as primary method if bootstrap-eligible
        flow.put("step1_initiate", Map.of(
                "method", "POST",
                "path", "/api/v1/auth/login/initiate",
                "request", Map.of(
                        "loginId", "{user_email}",
                        "channelType", "WEB",
                        "sourceIp", "{client_ip}",
                        "userAgent", "{user_agent}"),
                "response", Map.of(
                        "txnId", "{uuid}",
                        "state", "PRIMARY_CHALLENGE",
                        "availableMethods", List.of("MAGIC_LINK")),
                "uiRoute", "/login"
        ));

        // Step 2: Send magic link
        flow.put("step2_send_magic_link", Map.of(
                "method", "POST",
                "path", "/api/v1/auth/login/magic-link/send",
                "request", Map.of(
                        "txnId", "{txnId_from_step1}",
                        "accountId", "{resolved_account_id}",
                        "email", "{user_email}"),
                "response", Map.of(
                        "txnId", "{uuid}",
                        "state", "MAGIC_LINK_SENT",
                        "expiresAt", "{iso8601_timestamp}"),
                "uiRoute", "/login/magic-link-sent"
        ));

        // Step 3: Verify magic link (user clicks link in email)
        flow.put("step3_verify_magic_link", Map.of(
                "method", "GET",
                "path", "/api/v1/auth/login/magic-link/verify?token={magic_link_token}",
                "response", Map.of(
                        "txnId", "{uuid}",
                        "state", "ONBOARDING_REQUIRED",
                        "verified", true,
                        "bootstrapSessionId", "{uuid}",
                        "onboardingRequired", true),
                "uiRoute", "/login/onboarding"
        ));

        // Step 4: Validate bootstrap session
        flow.put("step4_validate_bootstrap_session", Map.of(
                "method", "POST",
                "path", "/api/v1/auth/bootstrap/session/validate",
                "request", Map.of("sessionId", "{bootstrapSessionId_from_step3}"),
                "response", Map.of(
                        "sessionId", "{uuid}",
                        "accountId", "{uuid}",
                        "tenantId", "{uuid}",
                        "type", "BOOTSTRAP",
                        "valid", true),
                "uiAction", "Show assigned FIDO device and enrollment instructions"
        ));

        // Step 5: Start FIDO enrollment
        flow.put("step5_start_fido_enrollment", Map.of(
                "method", "POST",
                "path", "/api/v1/auth/bootstrap/{txnId}/fido-enrollment/start",
                "response", Map.of(
                        "txnId", "{uuid}",
                        "state", "FIDO_ENROLLMENT_IN_PROGRESS"),
                "uiAction", "Transition UI to FIDO enrollment view"
        ));

        // Step 6: Begin FIDO registration (device-aware)
        flow.put("step6_fido_register_begin", Map.of(
                "method", "POST",
                "path", "/api/v1/credentials/fido/register/device-aware/begin",
                "request", Map.of(
                        "accountId", "{accountId}",
                        "deviceId", "{assigned_device_id}",
                        "displayName", "{device_display_name}"),
                "response", Map.of(
                        "txnId", "{uuid}",
                        "publicKeyCredentialCreationOptions", "{webauthn_json}"),
                "uiAction", "Call navigator.credentials.create(options)"
        ));

        // Step 7: Complete FIDO registration
        flow.put("step7_fido_register_complete", Map.of(
                "method", "POST",
                "path", "/api/v1/credentials/fido/register/device-aware/complete",
                "request", Map.of(
                        "accountId", "{accountId}",
                        "deviceId", "{assigned_device_id}",
                        "txnId", "{txnId_from_step6}",
                        "credentialId", "{from_webauthn_response}",
                        "attestationObject", "{base64url}",
                        "clientDataJSON", "{base64url}"),
                "response", Map.of(
                        "credentialId", "{uuid}",
                        "displayName", "{string}",
                        "status", "ACTIVE"),
                "sideEffects", List.of(
                        "Device status → ACTIVE",
                        "Assignment status → ACTIVE",
                        "Bootstrap state: FIDO_ENROLLED=1, BOOTSTRAP_ENABLED=0, FIRST_LOGIN_PENDING=0")
        ));

        // Step 8: Complete enrollment in auth orchestrator
        flow.put("step8_complete_fido_enrollment", Map.of(
                "method", "POST",
                "path", "/api/v1/auth/bootstrap/{txnId}/fido-enrollment/complete",
                "response", Map.of(
                        "txnId", "{uuid}",
                        "state", "COMPLETED"),
                "sideEffects", List.of(
                        "Bootstrap session expired",
                        "Auth result recorded as SUCCESS",
                        "Auth tokens issued"),
                "uiRoute", "/dashboard (full authenticated session)"
        ));

        return ApiResponse.success(flow);
    }
}
