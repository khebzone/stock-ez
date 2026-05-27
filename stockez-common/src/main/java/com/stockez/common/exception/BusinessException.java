package com.stockez.common.exception;

import org.springframework.http.HttpStatus;

public class BusinessException extends StockEzException {
    public BusinessException(String message, String errorCode) {
        super(message, errorCode, HttpStatus.BAD_REQUEST);
    }
}
