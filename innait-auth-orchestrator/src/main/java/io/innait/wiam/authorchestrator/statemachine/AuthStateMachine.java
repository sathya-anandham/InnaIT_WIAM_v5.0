package io.innait.wiam.authorchestrator.statemachine;

import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.Map;
import java.util.Set;

/**
 * Finite state machine for authentication flows.
 * Uses an EnumMap-based approach for per-transaction state management
 * with Redis-backed persistence.
 */
@Component
public class AuthStateMachine {

    private static final Map<AuthState, Map<AuthEvent, AuthState>> TRANSITIONS;

    static {
        TRANSITIONS = new EnumMap<>(AuthState.class);

        // INITIATED → PRIMARY_CHALLENGE (on LOGIN_ID_SUBMITTED)
        TRANSITIONS.put(AuthState.INITIATED, Map.of(
                AuthEvent.LOGIN_ID_SUBMITTED, AuthState.PRIMARY_CHALLENGE,
                AuthEvent.AUTH_ABORTED, AuthState.ABORTED,
                AuthEvent.TIMEOUT, AuthState.ABORTED
        ));

        // PRIMARY_CHALLENGE → PRIMARY_VERIFIED or FAILED
        TRANSITIONS.put(AuthState.PRIMARY_CHALLENGE, Map.of(
                AuthEvent.PRIMARY_FACTOR_VERIFIED, AuthState.PRIMARY_VERIFIED,
                AuthEvent.PRIMARY_FACTOR_FAILED, AuthState.FAILED,
                AuthEvent.AUTH_ABORTED, AuthState.ABORTED,
                AuthEvent.TIMEOUT, AuthState.ABORTED
        ));

        // PRIMARY_VERIFIED → MFA_CHALLENGE or COMPLETED
        TRANSITIONS.put(AuthState.PRIMARY_VERIFIED, Map.of(
                AuthEvent.MFA_CHALLENGE_ISSUED, AuthState.MFA_CHALLENGE,
                AuthEvent.AUTH_COMPLETED, AuthState.COMPLETED,
                AuthEvent.AUTH_ABORTED, AuthState.ABORTED,
                AuthEvent.TIMEOUT, AuthState.ABORTED
        ));

        // MFA_CHALLENGE → MFA_VERIFIED or FAILED
        TRANSITIONS.put(AuthState.MFA_CHALLENGE, Map.of(
                AuthEvent.MFA_FACTOR_VERIFIED, AuthState.MFA_VERIFIED,
                AuthEvent.MFA_FACTOR_FAILED, AuthState.FAILED,
                AuthEvent.AUTH_ABORTED, AuthState.ABORTED,
                AuthEvent.TIMEOUT, AuthState.ABORTED
        ));

        // MFA_VERIFIED → COMPLETED
        TRANSITIONS.put(AuthState.MFA_VERIFIED, Map.of(
                AuthEvent.AUTH_COMPLETED, AuthState.COMPLETED,
                AuthEvent.AUTH_ABORTED, AuthState.ABORTED,
                AuthEvent.TIMEOUT, AuthState.ABORTED
        ));

        // Terminal states: no transitions out
        TRANSITIONS.put(AuthState.COMPLETED, Map.of());
        TRANSITIONS.put(AuthState.FAILED, Map.of());
        TRANSITIONS.put(AuthState.ABORTED, Map.of());
    }

    /**
     * Attempt a state transition.
     *
     * @return the new state if the transition is valid
     * @throws IllegalStateException if the transition is not allowed
     */
    public AuthState transition(AuthState currentState, AuthEvent event) {
        Map<AuthEvent, AuthState> allowedTransitions = TRANSITIONS.get(currentState);
        if (allowedTransitions == null || !allowedTransitions.containsKey(event)) {
            throw new IllegalStateException(
                    String.format("Invalid transition: %s + %s", currentState, event));
        }
        return allowedTransitions.get(event);
    }

    /**
     * Check if a transition is valid without executing it.
     */
    public boolean canTransition(AuthState currentState, AuthEvent event) {
        Map<AuthEvent, AuthState> allowedTransitions = TRANSITIONS.get(currentState);
        return allowedTransitions != null && allowedTransitions.containsKey(event);
    }

    /**
     * Get all valid events for a given state.
     */
    public Set<AuthEvent> getValidEvents(AuthState state) {
        Map<AuthEvent, AuthState> transitions = TRANSITIONS.get(state);
        return transitions != null ? transitions.keySet() : Set.of();
    }

    /**
     * Check if a state is terminal (no transitions out).
     */
    public boolean isTerminal(AuthState state) {
        Map<AuthEvent, AuthState> transitions = TRANSITIONS.get(state);
        return transitions == null || transitions.isEmpty();
    }
}
