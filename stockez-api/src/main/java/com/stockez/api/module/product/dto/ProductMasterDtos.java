package com.stockez.api.module.product.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

public class ProductMasterDtos {

    @Data
    public static class CreateMasterRequest {
        @NotBlank(message = "Type is required")
        private String type;

        @NotBlank(message = "Name is required")
        @Size(min = 1, max = 150)
        private String name;

        @Size(max = 50)
        private String value;

        private UUID parentId; // required for SUB_CATEGORY, null for all others

        private Integer sortOrder;
    }

    @Data
    public static class MasterResponse {
        private UUID id;
        private String type;
        private String name;
        private String value;
        private UUID parentId;
        private String parentName; // derived from parentMaster.getName() — always fresh
        private boolean active;
        private Integer sortOrder;
        private Instant createdAt;
    }
}
