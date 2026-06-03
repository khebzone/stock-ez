package com.stockez.api.module.product.controller;

import com.stockez.api.module.product.dto.ProductDtos;
import com.stockez.api.module.product.service.ProductService;
import com.stockez.common.response.ApiResponse;
import com.stockez.common.response.PagedResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/products")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Products", description = "Product catalogue management")
public class ProductController {

    private final ProductService productService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('PRODUCTS_CREATE')")
    @Operation(summary = "Create a new product")
    public ResponseEntity<ApiResponse<ProductDtos.ProductResponse>> create(
            @Valid @RequestBody ProductDtos.CreateProductRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(productService.createProduct(request, tenantId), "Product created"));
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "List products with optional search and category filter")
    public ResponseEntity<ApiResponse<PagedResponse<ProductDtos.ProductResponse>>> list(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Page<ProductDtos.ProductResponse> result = productService.getProducts(
                tenantId, search, category, PageRequest.of(page, size, Sort.by("name")));

        PagedResponse<ProductDtos.ProductResponse> paged = PagedResponse.<ProductDtos.ProductResponse>builder()
                .content(result.getContent())
                .page(result.getNumber())
                .size(result.getSize())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .last(result.isLast())
                .build();

        return ResponseEntity.ok(ApiResponse.success(paged));
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get product by ID")
    public ResponseEntity<ApiResponse<ProductDtos.ProductResponse>> getById(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(productService.getProductById(id, tenantId)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('PRODUCTS_EDIT')")
    @Operation(summary = "Update product")
    public ResponseEntity<ApiResponse<ProductDtos.ProductResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody ProductDtos.UpdateProductRequest request,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(productService.updateProduct(id, request, tenantId), "Product updated"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('PRODUCTS_DELETE')")
    @Operation(summary = "Soft delete product")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        productService.deleteProduct(id, tenantId);
        return ResponseEntity.ok(ApiResponse.success(null, "Product deleted"));
    }

    @GetMapping("/categories")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get all product categories")
    public ResponseEntity<ApiResponse<List<String>>> categories(@RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(productService.getCategories(tenantId)));
    }

    @GetMapping("/brands")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get all product brands")
    public ResponseEntity<ApiResponse<List<String>>> brands(@RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(productService.getBrands(tenantId)));
    }
}
