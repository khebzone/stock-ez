package com.distroiq.api.module.payment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

public class PaymentMethodDtos {

    @Data
    public static class CreateRequest {
        @NotBlank(message = "Name is required")
        @Size(max = 100)
        private String name;

        @NotNull(message = "Mode is required")
        @Size(max = 30)
        private String mode; // CASH, UPI, CHEQUE, NEFT, RTGS, CREDIT

        private Integer sortOrder;
    }

    @Data
    public static class Response {
        private UUID id;
        private String name;
        private String mode;
        private boolean active;
        private Integer sortOrder;
        private Instant createdAt;
    }
}
