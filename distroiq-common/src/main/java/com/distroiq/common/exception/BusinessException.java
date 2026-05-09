package com.distroiq.common.exception;

import org.springframework.http.HttpStatus;

public class BusinessException extends DistroIQException {
    public BusinessException(String message, String errorCode) {
        super(message, errorCode, HttpStatus.BAD_REQUEST);
    }
}
