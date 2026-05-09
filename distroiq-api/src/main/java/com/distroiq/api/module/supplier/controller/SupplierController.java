package com.distroiq.api.module.supplier.controller;

import com.distroiq.api.module.supplier.dto.SupplierDtos;
import com.distroiq.api.module.supplier.service.SupplierExcelService;
import com.distroiq.api.module.supplier.service.SupplierService;
import com.distroiq.common.response.ApiResponse;
import com.distroiq.common.response.PagedResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/suppliers")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Suppliers", description = "Supplier management")
public class SupplierController {

    private final SupplierService supplierService;
    private final SupplierExcelService supplierExcelService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE')")
    @Operation(summary = "List suppliers [ADMIN, WAREHOUSE]")
    public ResponseEntity<ApiResponse<PagedResponse<SupplierDtos.SupplierResponse>>> list(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Page<SupplierDtos.SupplierResponse> result = supplierService.getAll(tenantId, search,
                PageRequest.of(page, size, Sort.by("name")));
        return ResponseEntity.ok(ApiResponse.success(toPagedResponse(result)));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Create supplier [ADMIN]")
    public ResponseEntity<ApiResponse<SupplierDtos.SupplierResponse>> create(
            @Valid @RequestBody SupplierDtos.CreateSupplierRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(supplierService.create(request, tenantId), "Supplier created"));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE')")
    @Operation(summary = "Get supplier by ID")
    public ResponseEntity<ApiResponse<SupplierDtos.SupplierResponse>> getById(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(supplierService.getById(id, tenantId)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Update supplier [ADMIN]")
    public ResponseEntity<ApiResponse<SupplierDtos.SupplierResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody SupplierDtos.UpdateSupplierRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(supplierService.update(id, request, tenantId), "Supplier updated"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Deactivate supplier [ADMIN]")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable UUID id, @RequestHeader("X-Tenant-Id") UUID tenantId) {
        supplierService.deactivate(id, tenantId);
        return ResponseEntity.ok(ApiResponse.success(null, "Supplier deactivated"));
    }

    @GetMapping("/export")
    @PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE')")
    @Operation(summary = "Export suppliers to Excel [ADMIN, WAREHOUSE]")
    public ResponseEntity<byte[]> export(@RequestHeader("X-Tenant-Id") UUID tenantId) throws IOException {
        byte[] data = supplierExcelService.exportSuppliers(tenantId);
        String filename = "suppliers-" + LocalDate.now() + ".xlsx";
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename).build().toString())
                .body(data);
    }

    @GetMapping("/import/template")
    @PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE')")
    @Operation(summary = "Download import template [ADMIN, WAREHOUSE]")
    public ResponseEntity<byte[]> template(@RequestHeader("X-Tenant-Id") UUID tenantId) throws IOException {
        byte[] data = supplierExcelService.downloadTemplate();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("supplier-import-template.xlsx").build().toString())
                .body(data);
    }

    @PostMapping("/import")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Import suppliers from Excel [ADMIN]")
    public ResponseEntity<ApiResponse<SupplierDtos.ImportResult>> importExcel(
            @RequestParam("file") MultipartFile file,
            @RequestHeader("X-Tenant-Id") UUID tenantId) throws IOException {
        SupplierDtos.ImportResult result = supplierExcelService.importSuppliers(file, tenantId);
        String msg = result.getCreated() + " supplier(s) imported" +
                     (result.getSkipped() > 0 ? ", " + result.getSkipped() + " skipped" : "");
        return ResponseEntity.ok(ApiResponse.success(result, msg));
    }

    private <T> PagedResponse<T> toPagedResponse(Page<T> page) {
        return PagedResponse.<T>builder()
                .content(page.getContent()).page(page.getNumber()).size(page.getSize())
                .totalElements(page.getTotalElements()).totalPages(page.getTotalPages()).last(page.isLast())
                .build();
    }
}
