package com.stockez.api.module.stockadjustment.service;

import com.stockez.api.module.product.entity.Product;
import com.stockez.api.module.product.repository.ProductRepository;
import com.stockez.api.module.purchase.entity.StockBatch;
import com.stockez.api.module.purchase.repository.StockBatchRepository;
import com.stockez.api.module.stockadjustment.dto.StockAdjustmentDtos;
import com.stockez.api.module.stockadjustment.entity.StockAdjustment;
import com.stockez.api.module.stockadjustment.repository.StockAdjustmentRepository;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.tenant.repository.TenantRepository;
import com.stockez.api.module.user.entity.User;
import com.stockez.api.module.user.repository.UserRepository;
import com.stockez.common.exception.BusinessException;
import com.stockez.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StockAdjustmentService {

    private final StockAdjustmentRepository adjustmentRepository;
    private final StockBatchRepository stockBatchRepository;
    private final ProductRepository productRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;

    public List<StockAdjustmentDtos.BatchForAdjustment> getBatchesForProduct(UUID productId, UUID tenantId) {
        Product product = productRepository.findByIdAndTenantId(productId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", productId.toString()));
        return stockBatchRepository.findByTenantAndProduct(tenantId, productId).stream()
                .map(b -> StockAdjustmentDtos.BatchForAdjustment.builder()
                        .batchId(b.getId())
                        .batchNumber(b.getBatchNumber())
                        .productId(product.getId())
                        .productName(product.getName())
                        .mrp(b.getMrp())
                        .purchaseRate(b.getPurchaseRate())
                        .currentStock(b.getQuantityAvailable())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional
    public StockAdjustmentDtos.AdjustmentResponse adjust(
            StockAdjustmentDtos.AdjustRequest req, UUID userId, UUID tenantId) {

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));
        User user = userRepository.findByIdAndTenantId(userId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));

        StockBatch batch = stockBatchRepository.findById(req.getBatchId())
                .filter(b -> b.getTenant().getId().equals(tenantId))
                .orElseThrow(() -> new ResourceNotFoundException("StockBatch", req.getBatchId().toString()));

        StockAdjustment.AdjustmentType type;
        try {
            type = StockAdjustment.AdjustmentType.valueOf(req.getType());
        } catch (IllegalArgumentException e) {
            throw new BusinessException("Invalid type: must be EXCESS or SHORTAGE", "INVALID_TYPE");
        }

        int before = batch.getQuantityAvailable();
        int after;

        if (type == StockAdjustment.AdjustmentType.EXCESS) {
            after = before + req.getQuantity();
            batch.setActive(true);
        } else {
            after = before - req.getQuantity();
            if (after < 0) {
                throw new BusinessException(
                        "Shortage quantity (" + req.getQuantity() + ") exceeds available stock (" + before + ")",
                        "INSUFFICIENT_STOCK");
            }
            batch.setActive(after > 0);
        }

        batch.setQuantityAvailable(after);
        stockBatchRepository.save(batch);

        Product product = batch.getProduct();
        Integer newStock = stockBatchRepository.sumAvailableByProduct(tenantId, product.getId());
        product.setStockQuantity(newStock != null ? newStock : 0);
        productRepository.save(product);

        StockAdjustment saved = adjustmentRepository.save(StockAdjustment.builder()
                .tenant(tenant)
                .product(product)
                .batch(batch)
                .batchNumber(batch.getBatchNumber())
                .type(type)
                .quantityAdjusted(req.getQuantity())
                .quantityBefore(before)
                .quantityAfter(after)
                .reason(req.getReason())
                .createdBy(user)
                .build());

        return toResponse(saved, user.getFullName());
    }

    @Transactional(readOnly = true)
    public Page<StockAdjustmentDtos.AdjustmentResponse> listAdjustments(UUID tenantId, Pageable pageable) {
        return adjustmentRepository.findByTenantId(tenantId, pageable)
                .map(a -> toResponse(a, a.getCreatedBy().getFullName()));
    }

    @Transactional(readOnly = true)
    public List<StockAdjustmentDtos.AdjustmentResponse> getAllAdjustments(UUID tenantId) {
        return adjustmentRepository.findAllByTenantId(tenantId)
                .stream().map(a -> toResponse(a, a.getCreatedBy().getFullName())).collect(Collectors.toList());
    }

    private StockAdjustmentDtos.AdjustmentResponse toResponse(StockAdjustment a, String adjustedBy) {
        return StockAdjustmentDtos.AdjustmentResponse.builder()
                .id(a.getId())
                .batchNumber(a.getBatchNumber())
                .productName(a.getProduct().getName())
                .type(a.getType().name())
                .quantityAdjusted(a.getQuantityAdjusted())
                .quantityBefore(a.getQuantityBefore())
                .quantityAfter(a.getQuantityAfter())
                .reason(a.getReason())
                .adjustedBy(adjustedBy)
                .createdAt(a.getCreatedAt())
                .build();
    }
}
