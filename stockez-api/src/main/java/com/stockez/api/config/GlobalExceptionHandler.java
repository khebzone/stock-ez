package com.stockez.api.config;

import com.stockez.common.exception.StockEzException;
import com.stockez.common.response.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.HashMap;
import java.util.Map;

/**
 * Global exception handler — catches ALL exceptions and returns
 * consistent ApiResponse format. No raw stack traces ever exposed.
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(StockEzException.class)
    public ResponseEntity<ApiResponse<Void>> handleStockEzException(StockEzException ex) {
        log.warn("Business exception: {} - {}", ex.getErrorCode(), ex.getMessage());
        return ResponseEntity.status(ex.getStatus())
                .body(ApiResponse.error(ex.getMessage(), ex.getErrorCode()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleValidationException(
            MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach(error -> {
            String field = ((FieldError) error).getField();
            errors.put(field, error.getDefaultMessage());
        });
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.<Map<String, String>>builder()
                        .success(false)
                        .message("Validation failed")
                        .errorCode("VALIDATION_ERROR")
                        .data(errors)
                        .build());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleDataIntegrity(DataIntegrityViolationException ex) {
        log.warn("Data integrity violation: {}", ex.getMessage());
        String msg = ex.getRootCause() != null ? ex.getRootCause().getMessage() : ex.getMessage();

        // Parse the constraint name and return a human-readable field error
        Map<String, String> fieldErrors = new HashMap<>();
        String userMessage = "Duplicate entry. This record already exists.";
        String field = "name";

        if (msg != null) {
            if (msg.contains("value too long for type") || msg.contains("too long for column")) {
                java.util.regex.Matcher limitMatcher =
                    java.util.regex.Pattern.compile("varying\\((\\d+)\\)").matcher(msg);
                String limit = limitMatcher.find() ? limitMatcher.group(1) : "";
                String outerMsg = ex.getMessage() != null ? ex.getMessage().toLowerCase() : "";
                String hint = "";
                if (outerMsg.contains("suppliers")) {
                    if ("15".equals(limit))      hint = " Check: Phone, Alt Phone, GSTIN, or Bank IFSC (max 15 characters each).";
                    else if ("20".equals(limit)) hint = " Check: GSTIN, Alt Phone, FSSAI Number, or Bank IFSC (max 20 characters each).";
                } else if (outerMsg.contains("customers")) {
                    hint = "15".equals(limit)
                        ? " Check: Phone, Alt Phone, or GSTIN (max 15 characters each)."
                        : " Check all customer fields for values that exceed their limits.";
                } else if (outerMsg.contains("vehicles")) {
                    hint = " Check the Insurance Number field (max 50 characters).";
                } else if (outerMsg.contains("products")) {
                    hint = " Check all product fields for values that exceed their limits.";
                }
                userMessage = "A value is too long" + (limit.isEmpty() ? "" : " (max " + limit + " characters)") + "." + hint;
                field = "value";
            } else if (msg.contains("uq_route_name_active_per_tenant") || msg.contains("uq_route_name_per_tenant")) {
                userMessage = "A route with this name already exists. Please use a different name.";
                field = "name";
            } else if (msg.contains("uq_place_name_active_per_route") || msg.contains("uq_place_name_per_route")) {
                userMessage = "A stop with this name already exists in this route. Please use a different name.";
                field = "name";
            } else if (msg.contains("uq_customer_phone_active_per_tenant") || msg.contains("uq_customer_phone_per_tenant")) {
                userMessage = "A customer with this mobile number already exists.";
                field = "phone";
            } else if (msg.contains("unique_route_per_day")) {
                userMessage = "This route is already allocated for the selected date.";
                field = "routeId";
            } else if (msg.contains("users") && msg.contains("phone")) {
                userMessage = "A user with this mobile number already exists.";
                field = "phone";
            } else if (msg.contains("uq_supplier_phone_per_tenant")) {
                userMessage = "A supplier with this phone number already exists.";
                field = "phone";
            }
        }

        fieldErrors.put(field, userMessage);
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.<Map<String, String>>builder()
                        .success(false)
                        .message(userMessage)
                        .errorCode("DUPLICATE_ENTRY")
                        .data(fieldErrors)
                        .build());
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingHeader(MissingRequestHeaderException ex) {
        log.warn("Missing required header: {}", ex.getHeaderName());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("Required header missing: " + ex.getHeaderName(), "MISSING_HEADER"));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingParam(MissingServletRequestParameterException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("Required parameter missing: " + ex.getParameterName(), "MISSING_PARAM"));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("Invalid value for '" + ex.getName() + "': " + ex.getValue(), "TYPE_MISMATCH"));
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiResponse<Void>> handleBadCredentials(BadCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.error("Invalid phone or password", "INVALID_CREDENTIALS"));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error("Access denied — you do not have permission for this action", "ACCESS_DENIED"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGenericException(Exception ex) {
        log.error("Unexpected error [{}]: {}", ex.getClass().getSimpleName(), ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("An unexpected error occurred: " + ex.getMessage(), "INTERNAL_ERROR"));
    }
}
