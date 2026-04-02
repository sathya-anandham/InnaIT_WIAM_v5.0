package io.innait.wiam.authorchestrator.statemachine;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import static org.assertj.core.api.Assertions.*;

class AuthStateMachineTest {

    private AuthStateMachine stateMachine;

    @BeforeEach
    void setUp() {
        stateMachine = new AuthStateMachine();
    }

    // ---- Valid Transitions ----

    @Nested
    class ValidTransitions {

        @Test
        void initiatedToChallenge() {
            AuthState result = stateMachine.transition(AuthState.INITIATED, AuthEvent.LOGIN_ID_SUBMITTED);
            assertThat(result).isEqualTo(AuthState.PRIMARY_CHALLENGE);
        }

        @Test
        void primaryChallengeToVerified() {
            AuthState result = stateMachine.transition(AuthState.PRIMARY_CHALLENGE, AuthEvent.PRIMARY_FACTOR_VERIFIED);
            assertThat(result).isEqualTo(AuthState.PRIMARY_VERIFIED);
        }

        @Test
        void primaryChallengeToFailed() {
            AuthState result = stateMachine.transition(AuthState.PRIMARY_CHALLENGE, AuthEvent.PRIMARY_FACTOR_FAILED);
            assertThat(result).isEqualTo(AuthState.FAILED);
        }

        @Test
        void primaryVerifiedToMfaChallenge() {
            AuthState result = stateMachine.transition(AuthState.PRIMARY_VERIFIED, AuthEvent.MFA_CHALLENGE_ISSUED);
            assertThat(result).isEqualTo(AuthState.MFA_CHALLENGE);
        }

        @Test
        void primaryVerifiedToCompletedWhenNoMfa() {
            AuthState result = stateMachine.transition(AuthState.PRIMARY_VERIFIED, AuthEvent.AUTH_COMPLETED);
            assertThat(result).isEqualTo(AuthState.COMPLETED);
        }

        @Test
        void mfaChallengeToMfaVerified() {
            AuthState result = stateMachine.transition(AuthState.MFA_CHALLENGE, AuthEvent.MFA_FACTOR_VERIFIED);
            assertThat(result).isEqualTo(AuthState.MFA_VERIFIED);
        }

        @Test
        void mfaChallengeToFailed() {
            AuthState result = stateMachine.transition(AuthState.MFA_CHALLENGE, AuthEvent.MFA_FACTOR_FAILED);
            assertThat(result).isEqualTo(AuthState.FAILED);
        }

        @Test
        void mfaVerifiedToCompleted() {
            AuthState result = stateMachine.transition(AuthState.MFA_VERIFIED, AuthEvent.AUTH_COMPLETED);
            assertThat(result).isEqualTo(AuthState.COMPLETED);
        }

        @Test
        void fullPasswordPlusTotpFlow() {
            AuthState s = AuthState.INITIATED;
            s = stateMachine.transition(s, AuthEvent.LOGIN_ID_SUBMITTED);
            assertThat(s).isEqualTo(AuthState.PRIMARY_CHALLENGE);

            s = stateMachine.transition(s, AuthEvent.PRIMARY_FACTOR_VERIFIED);
            assertThat(s).isEqualTo(AuthState.PRIMARY_VERIFIED);

            s = stateMachine.transition(s, AuthEvent.MFA_CHALLENGE_ISSUED);
            assertThat(s).isEqualTo(AuthState.MFA_CHALLENGE);

            s = stateMachine.transition(s, AuthEvent.MFA_FACTOR_VERIFIED);
            assertThat(s).isEqualTo(AuthState.MFA_VERIFIED);

            s = stateMachine.transition(s, AuthEvent.AUTH_COMPLETED);
            assertThat(s).isEqualTo(AuthState.COMPLETED);
        }

        @Test
        void fidoPasswordlessFlow() {
            AuthState s = AuthState.INITIATED;
            s = stateMachine.transition(s, AuthEvent.LOGIN_ID_SUBMITTED);
            s = stateMachine.transition(s, AuthEvent.PRIMARY_FACTOR_VERIFIED);
            s = stateMachine.transition(s, AuthEvent.AUTH_COMPLETED);
            assertThat(s).isEqualTo(AuthState.COMPLETED);
        }
    }

    // ---- Abort/Timeout from Any Non-Terminal State ----

    @Nested
    class AbortAndTimeout {

        @Test
        void abortFromInitiated() {
            assertThat(stateMachine.transition(AuthState.INITIATED, AuthEvent.AUTH_ABORTED))
                    .isEqualTo(AuthState.ABORTED);
        }

        @Test
        void abortFromPrimaryChallenge() {
            assertThat(stateMachine.transition(AuthState.PRIMARY_CHALLENGE, AuthEvent.AUTH_ABORTED))
                    .isEqualTo(AuthState.ABORTED);
        }

        @Test
        void abortFromPrimaryVerified() {
            assertThat(stateMachine.transition(AuthState.PRIMARY_VERIFIED, AuthEvent.AUTH_ABORTED))
                    .isEqualTo(AuthState.ABORTED);
        }

        @Test
        void abortFromMfaChallenge() {
            assertThat(stateMachine.transition(AuthState.MFA_CHALLENGE, AuthEvent.AUTH_ABORTED))
                    .isEqualTo(AuthState.ABORTED);
        }

        @Test
        void abortFromMfaVerified() {
            assertThat(stateMachine.transition(AuthState.MFA_VERIFIED, AuthEvent.AUTH_ABORTED))
                    .isEqualTo(AuthState.ABORTED);
        }

        @Test
        void timeoutFromInitiated() {
            assertThat(stateMachine.transition(AuthState.INITIATED, AuthEvent.TIMEOUT))
                    .isEqualTo(AuthState.ABORTED);
        }

        @Test
        void timeoutFromPrimaryChallenge() {
            assertThat(stateMachine.transition(AuthState.PRIMARY_CHALLENGE, AuthEvent.TIMEOUT))
                    .isEqualTo(AuthState.ABORTED);
        }

        @Test
        void timeoutFromMfaChallenge() {
            assertThat(stateMachine.transition(AuthState.MFA_CHALLENGE, AuthEvent.TIMEOUT))
                    .isEqualTo(AuthState.ABORTED);
        }
    }

    // ---- Invalid Transitions ----

    @Nested
    class InvalidTransitions {

        @Test
        void initiatedCannotReceivePrimaryVerified() {
            assertThatThrownBy(() -> stateMachine.transition(AuthState.INITIATED, AuthEvent.PRIMARY_FACTOR_VERIFIED))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Invalid transition");
        }

        @Test
        void primaryChallengeCannotReceiveMfaVerified() {
            assertThatThrownBy(() -> stateMachine.transition(AuthState.PRIMARY_CHALLENGE, AuthEvent.MFA_FACTOR_VERIFIED))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        void completedCannotTransition() {
            assertThatThrownBy(() -> stateMachine.transition(AuthState.COMPLETED, AuthEvent.AUTH_ABORTED))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        void failedCannotTransition() {
            assertThatThrownBy(() -> stateMachine.transition(AuthState.FAILED, AuthEvent.AUTH_ABORTED))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        void abortedCannotTransition() {
            assertThatThrownBy(() -> stateMachine.transition(AuthState.ABORTED, AuthEvent.LOGIN_ID_SUBMITTED))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        void mfaChallengeCannotReceivePrimaryVerified() {
            assertThatThrownBy(() -> stateMachine.transition(AuthState.MFA_CHALLENGE, AuthEvent.PRIMARY_FACTOR_VERIFIED))
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        void primaryVerifiedCannotReceiveMfaVerified() {
            assertThatThrownBy(() -> stateMachine.transition(AuthState.PRIMARY_VERIFIED, AuthEvent.MFA_FACTOR_VERIFIED))
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    // ---- Terminal State Checks ----

    @Nested
    class TerminalStates {

        @Test
        void completedIsTerminal() {
            assertThat(stateMachine.isTerminal(AuthState.COMPLETED)).isTrue();
        }

        @Test
        void failedIsTerminal() {
            assertThat(stateMachine.isTerminal(AuthState.FAILED)).isTrue();
        }

        @Test
        void abortedIsTerminal() {
            assertThat(stateMachine.isTerminal(AuthState.ABORTED)).isTrue();
        }

        @Test
        void initiatedIsNotTerminal() {
            assertThat(stateMachine.isTerminal(AuthState.INITIATED)).isFalse();
        }

        @Test
        void primaryChallengeIsNotTerminal() {
            assertThat(stateMachine.isTerminal(AuthState.PRIMARY_CHALLENGE)).isFalse();
        }

        @Test
        void mfaChallengeIsNotTerminal() {
            assertThat(stateMachine.isTerminal(AuthState.MFA_CHALLENGE)).isFalse();
        }
    }

    // ---- canTransition ----

    @Nested
    class CanTransition {

        @Test
        void validTransitionReturnsTrue() {
            assertThat(stateMachine.canTransition(AuthState.INITIATED, AuthEvent.LOGIN_ID_SUBMITTED)).isTrue();
        }

        @Test
        void invalidTransitionReturnsFalse() {
            assertThat(stateMachine.canTransition(AuthState.INITIATED, AuthEvent.MFA_FACTOR_VERIFIED)).isFalse();
        }

        @Test
        void terminalStateReturnsFalse() {
            assertThat(stateMachine.canTransition(AuthState.COMPLETED, AuthEvent.AUTH_ABORTED)).isFalse();
        }
    }

    // ---- getValidEvents ----

    @Nested
    class GetValidEvents {

        @Test
        void initiatedHasLoginIdAndAbortAndTimeout() {
            assertThat(stateMachine.getValidEvents(AuthState.INITIATED))
                    .containsExactlyInAnyOrder(
                            AuthEvent.LOGIN_ID_SUBMITTED,
                            AuthEvent.AUTH_ABORTED,
                            AuthEvent.TIMEOUT
                    );
        }

        @Test
        void completedHasNoEvents() {
            assertThat(stateMachine.getValidEvents(AuthState.COMPLETED)).isEmpty();
        }

        @Test
        void mfaChallengeHasCorrectEvents() {
            assertThat(stateMachine.getValidEvents(AuthState.MFA_CHALLENGE))
                    .containsExactlyInAnyOrder(
                            AuthEvent.MFA_FACTOR_VERIFIED,
                            AuthEvent.MFA_FACTOR_FAILED,
                            AuthEvent.AUTH_ABORTED,
                            AuthEvent.TIMEOUT
                    );
        }
    }

    // ---- All states are covered ----

    @ParameterizedTest
    @EnumSource(AuthState.class)
    void allStatesHaveTransitionsDefined(AuthState state) {
        // Should not throw — all states have entries in TRANSITIONS map
        assertThat(stateMachine.getValidEvents(state)).isNotNull();
    }
}
