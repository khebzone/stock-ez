package com.stockez.api.module.imports;

import com.stockez.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/import")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Import", description = "Bulk data import via Excel")
public class ImportController {

    private final ImportService importService;

    // ── Templates ──

    @GetMapping("/template/products")
    @Operation(summary = "Download products Excel template")
    public ResponseEntity<byte[]> productTemplate() throws IOException {
        return excelResponse(importService.productTemplate(), "products-template.xlsx");
    }

    @GetMapping("/template/customers")
    @Operation(summary = "Download customers Excel template")
    public ResponseEntity<byte[]> customerTemplate() throws IOException {
        return excelResponse(importService.customerTemplate(), "customers-template.xlsx");
    }

    @GetMapping("/template/suppliers")
    @Operation(summary = "Download suppliers Excel template")
    public ResponseEntity<byte[]> supplierTemplate() throws IOException {
        return excelResponse(importService.supplierTemplate(), "suppliers-template.xlsx");
    }

    // ── Imports ──

    @PostMapping(value = "/products", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Import products from Excel")
    public ResponseEntity<ApiResponse<ImportService.ImportResult>> importProducts(
            @RequestParam("file") MultipartFile file,
            @RequestHeader("X-Tenant-Id") UUID tenantId) throws IOException {
        return ResponseEntity.ok(ApiResponse.success(importService.importProducts(file, tenantId), "Products imported"));
    }

    @PostMapping(value = "/customers", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Import customers from Excel")
    public ResponseEntity<ApiResponse<ImportService.ImportResult>> importCustomers(
            @RequestParam("file") MultipartFile file,
            @RequestHeader("X-Tenant-Id") UUID tenantId) throws IOException {
        return ResponseEntity.ok(ApiResponse.success(importService.importCustomers(file, tenantId), "Customers imported"));
    }

    @PostMapping(value = "/suppliers", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Import suppliers from Excel")
    public ResponseEntity<ApiResponse<ImportService.ImportResult>> importSuppliers(
            @RequestParam("file") MultipartFile file,
            @RequestHeader("X-Tenant-Id") UUID tenantId) throws IOException {
        return ResponseEntity.ok(ApiResponse.success(importService.importSuppliers(file, tenantId), "Suppliers imported"));
    }

    private ResponseEntity<byte[]> excelResponse(byte[] data, String filename) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(data);
    }
}
