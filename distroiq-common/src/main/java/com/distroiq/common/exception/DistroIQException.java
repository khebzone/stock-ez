package com.distroiq.common.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * Base exception for all DistroIQ business exceptions.
 */
@Getter
public class DistroIQException extends RuntimeException {

    private final String errorCode;
    private final HttpStatus status;

    public DistroIQException(String message, String errorCode, HttpStatus status) {
        super(message);
        this.errorCode = errorCode;
        this.status = status;
    }
}
