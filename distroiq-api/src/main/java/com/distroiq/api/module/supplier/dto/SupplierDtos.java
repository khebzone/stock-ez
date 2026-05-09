package com.distroiq.api.module.supplier.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class SupplierDtos {

    @Data
    public static class CreateSupplierRequest {
        @NotBlank @Size(max = 200) public String name;
        @Size(max = 100)           public String contactPerson;
        @NotBlank @Size(max = 15)  public String phone;
        @Size(max = 15)            public String altPhone;
        @Size(max = 100)           public String email;
        @Size(max = 500)           public String address;
        @Size(max = 100)           public String city;
        @Size(max = 50)            public String state;
        @Size(max = 15)            public String gstin;
        @Size(max = 20)            public String fssaiNumber;
        @Size(max = 100)           public String bankName;
        @Size(max = 30)            public String bankAccount;
        @Size(max = 15)            public String bankIfsc;
    }

    @Data
    public static class UpdateSupplierRequest {
        @NotBlank @Size(max = 200) public String name;
        @Size(max = 100)           public String contactPerson;
        @NotBlank @Size(max = 15)  public String phone;
        @Size(max = 15)            public String altPhone;
        @Size(max = 100)           public String email;
        @Size(max = 500)           public String address;
        @Size(max = 100)           public String city;
        @Size(max = 50)            public String state;
        @Size(max = 15)            public String gstin;
        @Size(max = 20)            public String fssaiNumber;
        @Size(max = 100)           public String bankName;
        @Size(max = 30)            public String bankAccount;
        @Size(max = 15)            public String bankIfsc;
        public Boolean active;
    }

    @Data
    public static class SupplierResponse {
        public UUID id;
        public String name;
        public String contactPerson;
        public String phone;
        public String altPhone;
        public String email;
        public String address;
        public String city;
        public String state;
        public String gstin;
        public String fssaiNumber;
        public String bankName;
        public String bankAccount;
        public String bankIfsc;
        public boolean active;
        public Instant createdAt;
    }

    @Data
    public static class ImportResult {
        private int created;
        private int skipped;
        private List<String> errors;
    }
}
