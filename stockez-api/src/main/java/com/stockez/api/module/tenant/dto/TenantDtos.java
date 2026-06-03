package com.stockez.api.module.tenant.dto;

import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.tenant.entity.TenantSettings;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public class TenantDtos {

    @Data
    public static class CreateTenantRequest {
        @NotBlank(message = "Name is required")
        @Size(max = 100)
        private String name;

        @NotBlank(message = "Subdomain is required")
        @Pattern(regexp = "^[a-z0-9-]+$", message = "Subdomain can only contain lowercase letters, numbers, and hyphens")
        @Size(max = 100)
        private String subdomain;

        @NotBlank(message = "Owner name is required")
        @Size(max = 50)
        private String ownerName;

        @NotBlank(message = "Phone is required")
        @Pattern(regexp = "^[6-9]\\d{9}$", message = "Enter a valid 10-digit Indian phone number")
        private String phone;

        @NotBlank(message = "Email is required")
        @Email(message = "Enter a valid email")
        private String email;

        private String gstin;
        private String address;
        private String city;
        private String state;

        @NotBlank(message = "Admin phone is required")
        @Pattern(regexp = "^[6-9]\\d{9}$", message = "Enter a valid 10-digit Indian phone number")
        private String adminPhone;

        @NotBlank(message = "Initial password is required")
        @Size(min = 6, message = "Password must be at least 6 characters")
        private String adminPassword;

        private Tenant.TenantStatus status;

        private Instant trialEndsAt;
    }

    @Data
    public static class UpdateTenantRequest {
        @NotBlank @Size(max = 100) private String name;
        @NotBlank @Size(max = 50) private String ownerName;
        @NotBlank @Pattern(regexp = "^[6-9]\\d{9}$") private String phone;
        @NotBlank @Email private String email;
        private String gstin;
        private String address;
        private String city;
        private String state;
        private Tenant.TenantStatus status;
        private Instant trialEndsAt;
    }

    @Data
    public static class TenantResponse {
        private UUID id;
        private String name;
        private String subdomain;
        private String ownerName;
        private String phone;
        private String email;
        private String gstin;
        private String fssaiNumber;
        private String panNumber;
        private String address;
        private String city;
        private String state;
        private String pinCode;
        private Tenant.TenantStatus status;
        private String logoUrl;
        private Instant trialEndsAt;
        private Instant createdAt;
    }

    @Data
    public static class TenantStats {
        private long total;
        private long active;
        private long trial;
        private long suspended;
        private long inactive;
    }

    @Data
    public static class CompanyProfileRequest {
        @NotBlank @Size(max = 100) private String name;
        @NotBlank @Size(max = 50)  private String ownerName;
        @NotBlank @Pattern(regexp = "^[6-9]\\d{9}$", message = "Enter a valid 10-digit mobile number") private String phone;
        @NotBlank @Email           private String email;
        @Size(max = 500)           private String address;
        @Size(max = 100)           private String city;
        @Size(max = 50)            private String state;
        @Size(max = 10)            private String pinCode;
        @Size(max = 15)            private String gstin;
        @Size(max = 20)            private String fssaiNumber;
        @Size(max = 10)            private String panNumber;
        @Size(max = 500)           private String logoUrl;
    }

    @Data
    public static class WorkflowSettingsRequest {
        private boolean invoiceApprovalRequired;
        private boolean picklistEnabled;
        private boolean goodsReturnApprovalRequired;
        private TenantSettings.CreditLimitEnforcement creditLimitEnforcement;
        private BigDecimal maxDiscountPercent;
        private boolean lockBillingAfterCheckout;
        private boolean separateDeliveryAllocation;
    }

    @Data
    public static class WorkflowSettingsResponse {
        private boolean invoiceApprovalRequired;
        private boolean picklistEnabled;
        private boolean goodsReturnApprovalRequired;
        private TenantSettings.CreditLimitEnforcement creditLimitEnforcement;
        private BigDecimal maxDiscountPercent;
        private boolean lockBillingAfterCheckout;
        private boolean separateDeliveryAllocation;
    }
}
