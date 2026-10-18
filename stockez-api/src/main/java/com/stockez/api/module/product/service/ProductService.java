package com.stockez.api.module.product.service;

import com.stockez.api.module.product.dto.ProductDtos;
import com.stockez.api.module.product.entity.Product;
import com.stockez.api.module.product.entity.ProductMaster;
import com.stockez.api.module.product.repository.ProductMasterRepository;
import com.stockez.api.module.product.repository.ProductRepository;
import com.stockez.api.module.purchase.entity.StockBatch;
import com.stockez.api.module.purchase.repository.StockBatchRepository;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.tenant.repository.TenantRepository;
import com.stockez.api.module.audit.service.AuditService;
import com.stockez.common.exception.BusinessException;
import com.stockez.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class ProductService {

    private final ProductRepository productRepository;
    private final ProductMasterRepository masterRepository;
    private final StockBatchRepository stockBatchRepository;
    private final TenantRepository tenantRepository;
    private final AuditService auditService;

    public ProductDtos.ProductResponse createProduct(ProductDtos.CreateProductRequest req, UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));

        validateProductRates(req.getPurchaseRate(), req.getMinSaleRate(), req.getMaxSaleRate());
        validateProductDates(req.getMfgDate(), req.getExpiryDate());

        BigDecimal halfGst = req.getSalesGstPercent().divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);

        ProductMaster categoryMaster = resolveMaster(req.getCategoryId(), tenantId, "Category", "CATEGORY");
        ProductMaster subCategoryMaster = resolveMaster(req.getSubCategoryId(), tenantId, "Sub Category", "SUB_CATEGORY");
        validateSubCategoryParent(categoryMaster, subCategoryMaster);
        assertNoDuplicateProduct(tenantId, req.getName(), req.getBrandId(), req.getUnitId(), null);

        Product product = Product.builder()
                .tenant(tenant)
                .name(req.getName())
                .hsnCode(req.getHsnCode())
                .brandMaster(resolveMaster(req.getBrandId(), tenantId, "Brand", "BRAND"))
                .categoryMaster(categoryMaster)
                .subCategoryMaster(subCategoryMaster)
                .unitMaster(resolveMaster(req.getUnitId(), tenantId, "Unit", "UNIT"))
                .mrp(req.getMrp())
                .purchaseRate(req.getPurchaseRate())
                .minSaleRate(req.getMinSaleRate())
                .maxSaleRate(req.getMaxSaleRate())
                .purchaseGstPercent(req.getPurchaseGstPercent() != null ? req.getPurchaseGstPercent() : BigDecimal.ZERO)
                .salesGstPercent(req.getSalesGstPercent())
                .cgstPercent(halfGst)
                .sgstPercent(halfGst)
                .description(req.getDescription())
                .imageUrl(req.getImageUrl())
                .stockQuantity(req.getStockQuantity() != null ? req.getStockQuantity() : 0)
                .mfgDate(req.getMfgDate())
                .expiryDate(req.getExpiryDate())
                .build();

        Product saved = productRepository.save(product);
        auditService.record(tenantId, "PRODUCT", saved.getId(), "CREATED",
                "Product " + saved.getName() + (saved.getBrand() != null ? " (" + saved.getBrand() + ")" : "") + " added");
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<ProductDtos.ProductResponse> getAllProducts(UUID tenantId) {
        List<Product> products = productRepository.findByTenantIdAndActiveTrueOrderByName(tenantId);
        Map<UUID, StockBatch> fifo = loadFifoMap(tenantId, products);
        return products.stream().map(p -> toResponse(p, fifo.get(p.getId()))).toList();
    }

    @Transactional(readOnly = true)
    public Page<ProductDtos.ProductResponse> getProducts(UUID tenantId, String search, UUID categoryId, UUID brandId, Pageable pageable) {
        String searchParam = (search != null && !search.isBlank()) ? "%" + search.trim().toLowerCase() + "%" : null;
        Page<Product> page = productRepository.findFiltered(tenantId, brandId, categoryId, searchParam, pageable);
        Map<UUID, StockBatch> fifo = loadFifoMap(tenantId, page.getContent());
        return page.map(p -> toResponse(p, fifo.get(p.getId())));
    }

    /** One query to fetch the FIFO-first batch per product — replaces the per-row N+1. */
    private Map<UUID, StockBatch> loadFifoMap(UUID tenantId, List<Product> products) {
        if (products.isEmpty()) return Map.of();
        List<UUID> ids = products.stream().map(Product::getId).toList();
        return stockBatchRepository.findFifoByProducts(tenantId, ids).stream()
                .collect(Collectors.toMap(b -> b.getProduct().getId(), b -> b, (a, b) -> a));
    }

    @Transactional(readOnly = true)
    public ProductDtos.ProductResponse getProductById(UUID id, UUID tenantId) {
        Product product = productRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", id.toString()));
        return toResponse(product);
    }

    public ProductDtos.ProductResponse updateProduct(UUID id, ProductDtos.UpdateProductRequest req, UUID tenantId) {
        Product product = productRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", id.toString()));

        validateProductRates(req.getPurchaseRate(), req.getMinSaleRate(), req.getMaxSaleRate());
        validateProductDates(req.getMfgDate(), req.getExpiryDate());

        BigDecimal halfGst = req.getSalesGstPercent().divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);

        ProductMaster categoryMaster = resolveMaster(req.getCategoryId(), tenantId, "Category", "CATEGORY");
        ProductMaster subCategoryMaster = resolveMaster(req.getSubCategoryId(), tenantId, "Sub Category", "SUB_CATEGORY");
        validateSubCategoryParent(categoryMaster, subCategoryMaster);
        assertNoDuplicateProduct(tenantId, req.getName(), req.getBrandId(), req.getUnitId(), id);

        product.setName(req.getName());
        product.setHsnCode(req.getHsnCode());
        product.setBrandMaster(resolveMaster(req.getBrandId(), tenantId, "Brand", "BRAND"));
        product.setCategoryMaster(categoryMaster);
        product.setSubCategoryMaster(subCategoryMaster);
        product.setUnitMaster(resolveMaster(req.getUnitId(), tenantId, "Unit", "UNIT"));
        product.setMrp(req.getMrp());
        product.setPurchaseRate(req.getPurchaseRate());
        product.setMinSaleRate(req.getMinSaleRate());
        product.setMaxSaleRate(req.getMaxSaleRate());
        product.setPurchaseGstPercent(req.getPurchaseGstPercent() != null ? req.getPurchaseGstPercent() : BigDecimal.ZERO);
        product.setSalesGstPercent(req.getSalesGstPercent());
        product.setCgstPercent(halfGst);
        product.setSgstPercent(halfGst);
        product.setDescription(req.getDescription());
        product.setImageUrl(req.getImageUrl());
        product.setActive(req.isActive());
        product.setMfgDate(req.getMfgDate());
        product.setExpiryDate(req.getExpiryDate());

        Product saved = productRepository.save(product);
        auditService.record(tenantId, "PRODUCT", saved.getId(), "UPDATED",
                "Product " + saved.getName() + " updated");
        return toResponse(saved);
    }

    public void deleteProduct(UUID id, UUID tenantId) {
        Product product = productRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", id.toString()));
        product.setActive(false);
        productRepository.save(product);
        auditService.record(tenantId, "PRODUCT", product.getId(), "DELETED",
                "Product " + product.getName() + " deactivated");
    }

    /** Rejects a second product with the same name + brand + unit in this tenant — the root cause of "same product added twice". */
    private void assertNoDuplicateProduct(UUID tenantId, String name, UUID brandId, UUID unitId, UUID excludeId) {
        if (name == null) return;
        boolean dup = productRepository.findActiveByTenantAndNameIgnoreCase(tenantId, name).stream()
                .anyMatch(p -> (excludeId == null || !p.getId().equals(excludeId))
                        && java.util.Objects.equals(masterId(p.getBrandMaster()), brandId)
                        && java.util.Objects.equals(masterId(p.getUnitMaster()), unitId));
        if (dup) {
            throw new BusinessException(
                    "A product named \"" + name.trim() + "\" with the same brand and unit already exists — edit that product instead of creating a duplicate",
                    "DUPLICATE_PRODUCT");
        }
    }

    private UUID masterId(ProductMaster master) {
        return master == null ? null : master.getId();
    }

    private ProductMaster resolveMaster(UUID masterId, UUID tenantId, String label, String expectedType) {
        if (masterId == null) return null;
        ProductMaster master = masterRepository.findByIdAndTenantId(masterId, tenantId)
                .orElseThrow(() -> new BusinessException(label + " not found or does not belong to this account", "INVALID_MASTER"));
        if (!expectedType.equals(master.getType())) {
            throw new BusinessException("Selected " + label + " is not a valid " + label.toLowerCase(), "INVALID_MASTER_TYPE");
        }
        return master;
    }

    /** A sub-category must belong to the chosen category — guards direct/crafted API calls. */
    private void validateSubCategoryParent(ProductMaster category, ProductMaster subCategory) {
        if (subCategory == null) return;
        UUID parentId = subCategory.getParentId();
        if (category == null || parentId == null || !parentId.equals(category.getId())) {
            throw new BusinessException(
                "Sub-category '" + subCategory.getName() + "' does not belong to the selected category",
                "SUBCATEGORY_PARENT_MISMATCH");
        }
    }

    private void validateProductRates(java.math.BigDecimal purchaseRate,
                                       java.math.BigDecimal minSaleRate, java.math.BigDecimal maxSaleRate) {
        if (purchaseRate != null && minSaleRate != null && minSaleRate.compareTo(purchaseRate) < 0) {
            throw new BusinessException(
                "Min Sale Rate (₹" + minSaleRate + ") cannot be less than Purchase Rate (₹" + purchaseRate + ")",
                "INVALID_RATE_ORDER"
            );
        }
        if (minSaleRate != null && maxSaleRate != null && minSaleRate.compareTo(maxSaleRate) > 0) {
            throw new BusinessException(
                "Min Sale Rate (₹" + minSaleRate + ") cannot exceed Max Sale Rate (₹" + maxSaleRate + ")",
                "INVALID_RATE_RANGE"
            );
        }
    }

    private void validateProductDates(java.time.LocalDate mfgDate, java.time.LocalDate expiryDate) {
        if (mfgDate != null && expiryDate != null && !expiryDate.isAfter(mfgDate)) {
            throw new BusinessException("Expiry date must be after manufacturing date", "INVALID_DATE_RANGE");
        }
    }

    private ProductDtos.ProductResponse toResponse(Product p) {
        List<StockBatch> fifo = stockBatchRepository.findFifoByProduct(p.getTenant().getId(), p.getId());
        return toResponse(p, fifo.isEmpty() ? null : fifo.get(0));
    }

    private ProductDtos.ProductResponse toResponse(Product p, StockBatch fifoBatch) {
        ProductDtos.ProductResponse res = new ProductDtos.ProductResponse();
        res.setId(p.getId());
        res.setName(p.getName());
        res.setHsnCode(p.getHsnCode());
        res.setBrand(p.getBrand());
        res.setCategory(p.getCategory());
        res.setSubCategory(p.getSubCategory());
        res.setUnit(p.getUnit());
        res.setBrandId(p.getBrandId());
        res.setCategoryId(p.getCategoryId());
        res.setSubCategoryId(p.getSubCategoryId());
        res.setUnitId(p.getUnitId());
        res.setMrp(p.getMrp());
        res.setPurchaseRate(p.getPurchaseRate());
        res.setMinSaleRate(p.getMinSaleRate());
        res.setMaxSaleRate(p.getMaxSaleRate());
        if (fifoBatch != null) {
            res.setFifoMrp(fifoBatch.getMrp());
            res.setFifoMinSaleRate(fifoBatch.getMinSaleRate());
            res.setFifoMaxSaleRate(fifoBatch.getMaxSaleRate());
            res.setFifoBatchAvailable(fifoBatch.getQuantityAvailable());
            res.setFifoPurchaseRate(fifoBatch.getPurchaseRate());
            res.setFifoPurchaseGstPercent(fifoBatch.getPurchaseGstPercent());
        }
        res.setPurchaseGstPercent(p.getPurchaseGstPercent());
        res.setSalesGstPercent(p.getSalesGstPercent());
        res.setCgstPercent(p.getCgstPercent());
        res.setSgstPercent(p.getSgstPercent());
        res.setImageUrl(p.getImageUrl());
        res.setDescription(p.getDescription());
        res.setActive(p.isActive());
        res.setStockQuantity(p.getStockQuantity());
        res.setCreatedAt(p.getCreatedAt());
        res.setMfgDate(p.getMfgDate());
        res.setExpiryDate(p.getExpiryDate());
        return res;
    }
}
