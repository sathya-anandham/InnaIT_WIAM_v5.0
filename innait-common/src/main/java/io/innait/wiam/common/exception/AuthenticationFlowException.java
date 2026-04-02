package io.innait.wiam.common.exception;

public class AuthenticationFlowException extends RuntimeException {

    private final String errorCode;
    private final String flowStep;

    public AuthenticationFlowException(String errorCode, String flowStep, String message) {
        super(message);
        this.errorCode = errorCode;
        this.flowStep = flowStep;
    }

    public AuthenticationFlowException(String errorCode, String flowStep, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
        this.flowStep = flowStep;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public String getFlowStep() {
        return flowStep;
    }
}
