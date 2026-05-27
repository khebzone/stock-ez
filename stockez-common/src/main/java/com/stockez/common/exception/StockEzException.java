package com.stockez.common.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * Base exception for all StockEz business exceptions.
 */
@Getter
public class StockEzException extends RuntimeException {

    private final String errorCode;
    private final HttpStatus status;

    public StockEzException(String message, String errorCode, HttpStatus status) {
        super(message);
        this.errorCode = errorCode;
        this.status = status;
    }
}
