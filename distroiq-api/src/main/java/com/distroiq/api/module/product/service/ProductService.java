package com.distroiq.api.module.product.service;

import com.distroiq.api.module.product.dto.ProductDtos;
import com.distroiq.api.module.product.entity.Product;
import com.distroiq.api.module.product.repository.ProductRepository;
import com.distroiq.api.module.purchase.entity.StockBatch;
import com.distroiq.api.module.purchase.repository.StockBatchRepository;
import com.distroiq.api.module.tenant.entity.Tenant;
import com.distroiq.api.module.tenant.repository.TenantRepository;
import com.distroiq.api.module.audit.service.AuditService;
import com.distroiq.common.exception.BusinessException;
import com.distroiq.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class ProductService {

    private final ProductRepository productRepository;
    private final StockBatchRepository stockBatchRepository;
    private final TenantRepository tenantRepository;
    private final AuditService auditService;

    public ProductDtos.ProductResponse createProduct(ProductDtos.CreateProductRequest req, UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));

        validateProductRates(req.getPurchaseRate(), req.getSalesRate1(), req.getMinSaleRate(), req.getMaxSaleRate());
        validateProductDates(req.getMfgDate(), req.getExpiryDate());

        BigDecimal halfGst = req.getSalesGstPercent().divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);

        Product product = Product.builder()
                .tenant(tenant)
                .name(req.getName())
                .hsnCode(req.getHsnCode())
                .brand(req.getBrand())
                .category(req.getCategory())
                .subCategory(req.getSubCategory())
                .unit(req.getUnit())
                .mrp(req.getMrp())
                .purchaseRate(req.getPurchaseRate())
                .salesRate1(req.getSalesRate1())
                .salesRate2(req.getSalesRate2())
                .salesRate3(req.getSalesRate3())
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
    public Page<ProductDtos.ProductResponse> getProducts(UUID tenantId, String search, String category, Pageable pageable) {
        if (search != null && !search.isBlank()) {
            return productRepository.searchByNameOrBrand(tenantId, search.trim(), pageable).map(this::toResponse);
        }
        if (category != null && !category.isBlank()) {
            return productRepository.findByTenantIdAndCategoryAndActiveTrue(tenantId, category, pageable).map(this::toResponse);
        }
        return productRepository.findByTenantIdAndActiveTrue(tenantId, pageable).map(this::toResponse);
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

        validateProductRates(req.getPurchaseRate(), req.getSalesRate1(), req.getMinSaleRate(), req.getMaxSaleRate());
        validateProductDates(req.getMfgDate(), req.getExpiryDate());

        BigDecimal halfGst = req.getSalesGstPercent().divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);

        product.setName(req.getName());
        product.setHsnCode(req.getHsnCode());
        product.setBrand(req.getBrand());
        product.setCategory(req.getCategory());
        product.setSubCategory(req.getSubCategory());
        product.setUnit(req.getUnit());
        product.setMrp(req.getMrp());
        product.setPurchaseRate(req.getPurchaseRate());
        product.setSalesRate1(req.getSalesRate1());
        product.setSalesRate2(req.getSalesRate2());
        product.setSalesRate3(req.getSalesRate3());
        product.setMinSaleRate(req.getMinSaleRate());
        product.setMaxSaleRate(req.getMaxSaleRate());
        product.setPurchaseGstPercent(req.getPurchaseGstPercent() != null ? req.getPurchaseGstPercent() : BigDecimal.ZERO);
        product.setSalesGstPercent(req.getSalesGstPercent());
        product.setCgstPercent(halfGst);
        product.setSgstPercent(halfGst);
        product.setDescription(req.getDescription());
        product.setImageUrl(req.getImageUrl());
        if (req.getStockQuantity() != null) product.setStockQuantity(req.getStockQuantity());
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

    @Transactional(readOnly = true)
    public List<String> getCategories(UUID tenantId) {
        return productRepository.findDistinctCategories(tenantId);
    }

    @Transactional(readOnly = true)
    public List<String> getBrands(UUID tenantId) {
        return productRepository.findDistinctBrands(tenantId);
    }

    private void validateProductRates(java.math.BigDecimal purchaseRate, java.math.BigDecimal salesRate1,
                                       java.math.BigDecimal minSaleRate, java.math.BigDecimal maxSaleRate) {
        if (purchaseRate != null && salesRate1 != null && salesRate1.compareTo(purchaseRate) < 0) {
            throw new BusinessException(
                "Sales Rate 1 (₹" + salesRate1 + ") cannot be less than Purchase Rate (₹" + purchaseRate + ")",
                "INVALID_RATE_ORDER"
            );
        }
        if (minSaleRate != null && maxSaleRate != null && minSaleRate.compareTo(maxSaleRate) > 0) {
            throw new BusinessException(
                "Min Sale Rate (₹" + minSaleRate + ") cannot exceed Max Sale Rate (₹" + maxSaleRate + ")",
                "INVALID_RATE_RANGE"
            );
        }
        if (minSaleRate != null && salesRate1 != null && salesRate1.compareTo(minSaleRate) < 0) {
            throw new BusinessException(
                "Sales Rate 1 (₹" + salesRate1 + ") cannot be less than Min Sale Rate (₹" + minSaleRate + ")",
                "RATE_BELOW_MINIMUM"
            );
        }
    }

    private void validateProductDates(java.time.LocalDate mfgDate, java.time.LocalDate expiryDate) {
        if (mfgDate != null && expiryDate != null && !expiryDate.isAfter(mfgDate)) {
            throw new BusinessException("Expiry date must be after manufacturing date", "INVALID_DATE_RANGE");
        }
    }

    private ProductDtos.ProductResponse toResponse(Product p) {
        ProductDtos.ProductResponse res = new ProductDtos.ProductResponse();
        res.setId(p.getId());
        res.setName(p.getName());
        res.setHsnCode(p.getHsnCode());
        res.setBrand(p.getBrand());
        res.setCategory(p.getCategory());
        res.setSubCategory(p.getSubCategory());
        res.setUnit(p.getUnit());
        res.setMrp(p.getMrp());
        res.setPurchaseRate(p.getPurchaseRate());
        res.setSalesRate1(p.getSalesRate1());
        res.setSalesRate2(p.getSalesRate2());
        res.setSalesRate3(p.getSalesRate3());
        res.setMinSaleRate(p.getMinSaleRate());
        res.setMaxSaleRate(p.getMaxSaleRate());
        List<StockBatch> fifo = stockBatchRepository.findFifoByProduct(p.getTenant().getId(), p.getId());
        if (!fifo.isEmpty()) {
            res.setFifoMinSaleRate(fifo.get(0).getMinSaleRate());
            res.setFifoMaxSaleRate(fifo.get(0).getMaxSaleRate());
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
