package com.stockez.api.module.goodsreturn.service;

import com.stockez.api.module.goodsreturn.dto.GoodsReturnDtos;
import com.stockez.api.module.goodsreturn.entity.GoodsReturn;
import com.stockez.api.module.goodsreturn.entity.GoodsReturnItem;
import com.stockez.api.module.goodsreturn.repository.GoodsReturnRepository;
import com.stockez.api.module.order.entity.Order;
import com.stockez.api.module.order.repository.OrderRepository;
import com.stockez.api.module.product.entity.Product;
import com.stockez.api.module.product.repository.ProductRepository;
import com.stockez.api.module.purchase.entity.StockBatch;
import com.stockez.api.module.purchase.repository.StockBatchRepository;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.tenant.repository.TenantRepository;
import com.stockez.api.module.user.entity.User;
import com.stockez.api.module.user.repository.UserRepository;
import com.stockez.api.module.audit.service.AuditService;
import com.stockez.common.exception.BusinessException;
import com.stockez.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Year;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GoodsReturnService {

    private final GoodsReturnRepository goodsReturnRepository;
    private final StockBatchRepository stockBatchRepository;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;

    @Transactional
    public GoodsReturnDtos.GoodsReturnResponse createReturn(
            GoodsReturnDtos.CreateGoodsReturnRequest req, UUID userId, UUID tenantId) {

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));
        User createdBy = userRepository.findByIdAndTenantId(userId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));

        GoodsReturn.ReturnType returnType;
        try {
            returnType = GoodsReturn.ReturnType.valueOf(req.getType());
        } catch (IllegalArgumentException e) {
            throw new BusinessException(
                    "Invalid return type: " + req.getType() + ". Must be SALES_RETURN, PURCHASE_RETURN, or DAMAGE",
                    "INVALID_RETURN_TYPE");
        }

        int year = Year.now().getValue();
        int seq = goodsReturnRepository.findMaxReturnSequence(tenantId, year) + 1;
        String returnNumber = String.format("RTN-%d-%05d", year, seq);

        Order referenceOrder = null;
        if (returnType == GoodsReturn.ReturnType.SALES_RETURN && req.getOrderId() != null) {
            referenceOrder = orderRepository.findByIdAndTenantId(req.getOrderId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("Order", req.getOrderId().toString()));
        }

        GoodsReturn goodsReturn = GoodsReturn.builder()
                .tenant(tenant)
                .returnNumber(returnNumber)
                .type(returnType)
                .referenceOrder(referenceOrder)
                .supplierName(req.getSupplierName())
                .returnDate(req.getReturnDate())
                .reason(req.getReason())
                .createdBy(createdBy)
                .build();

        BigDecimal totalAmount = BigDecimal.ZERO;

        for (GoodsReturnDtos.GoodsReturnItemRequest itemReq : req.getItems()) {
            Product product = productRepository.findByIdAndTenantId(itemReq.getProductId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("Product", itemReq.getProductId().toString()));

            BigDecimal amount = itemReq.getUnitRate().multiply(BigDecimal.valueOf(itemReq.getQuantity()));
            totalAmount = totalAmount.add(amount);

            GoodsReturnItem item = GoodsReturnItem.builder()
                    .goodsReturn(goodsReturn)
                    .product(product)
                    .batchNumber(itemReq.getBatchNumber())
                    .quantity(itemReq.getQuantity())
                    .unitRate(itemReq.getUnitRate())
                    .amount(amount)
                    .build();

            goodsReturn.getItems().add(item);
        }

        goodsReturn.setTotalAmount(totalAmount);
        GoodsReturn saved = goodsReturnRepository.save(goodsReturn);

        // ── Stock adjustments ────────────────────────────────────────────────────
        for (GoodsReturnItem item : saved.getItems()) {
            Product product = item.getProduct();
            UUID productId = product.getId();

            switch (returnType) {

                case SALES_RETURN -> {
                    List<StockBatch> batches;
                    if (item.getBatchNumber() != null && !item.getBatchNumber().isBlank()) {
                        batches = stockBatchRepository.findByTenantAndProduct(tenantId, productId)
                                .stream()
                                .filter(b -> item.getBatchNumber().equalsIgnoreCase(b.getBatchNumber()))
                                .collect(Collectors.toList());
                    } else {
                        batches = stockBatchRepository.findByTenantAndProduct(tenantId, productId);
                    }

                    if (batches.isEmpty()) {
                        throw new BusinessException(
                                "No stock batch found for product: " + product.getName(),
                                "BATCH_NOT_FOUND");
                    }

                    StockBatch targetBatch = batches.get(0);
                    targetBatch.setQuantityAvailable(targetBatch.getQuantityAvailable() + item.getQuantity());
                    targetBatch.setActive(true);
                    stockBatchRepository.save(targetBatch);
                }

                case PURCHASE_RETURN, DAMAGE -> {
                    // FIFO deduction — remove stock starting from oldest batch
                    List<StockBatch> fifoBatches = stockBatchRepository.findFifoByProduct(tenantId, productId);
                    int remaining = item.getQuantity();

                    for (StockBatch batch : fifoBatches) {
                        if (remaining <= 0) break;
                        int deduct = Math.min(batch.getQuantityAvailable(), remaining);
                        batch.setQuantityAvailable(batch.getQuantityAvailable() - deduct);
                        if (batch.getQuantityAvailable() == 0) {
                            batch.setActive(false);
                        }
                        stockBatchRepository.save(batch);
                        remaining -= deduct;
                    }

                    if (remaining > 0) {
                        throw new BusinessException(
                                "Insufficient stock for product: " + product.getName() +
                                ". Available stock is less than return quantity.",
                                "INSUFFICIENT_STOCK");
                    }
                }
            }

            // Sync product.stockQuantity from batches
            Integer newStock = stockBatchRepository.sumAvailableByProduct(tenantId, productId);
            product.setStockQuantity(newStock != null ? newStock : 0);
            productRepository.save(product);
        }

        // Update order totals once after all items processed
        if (returnType == GoodsReturn.ReturnType.SALES_RETURN && saved.getReferenceOrder() != null) {
            Order order = saved.getReferenceOrder();
            BigDecimal newTotal = order.getTotalAmount().subtract(saved.getTotalAmount());
            if (newTotal.compareTo(BigDecimal.ZERO) < 0) newTotal = BigDecimal.ZERO;
            BigDecimal newBalance = newTotal.subtract(order.getPaidAmount());
            if (newBalance.compareTo(BigDecimal.ZERO) < 0) newBalance = BigDecimal.ZERO;
            order.setTotalAmount(newTotal);
            order.setBalanceAmount(newBalance);
            orderRepository.save(order);
        }

        auditService.record(tenantId, "GOODS_RETURN", saved.getId(), "CREATED",
                "Return " + saved.getReturnNumber() + " (" + returnType.name() + ") — " +
                req.getItems().size() + " item(s), ₹" + saved.getTotalAmount().toPlainString());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public Page<GoodsReturnDtos.GoodsReturnResponse> listReturns(UUID tenantId, Pageable pageable) {
        return goodsReturnRepository.findByTenantIdOrderByReturnDateDescCreatedAtDesc(tenantId, pageable)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public GoodsReturnDtos.GoodsReturnResponse getReturn(UUID id, UUID tenantId) {
        GoodsReturn goodsReturn = goodsReturnRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("GoodsReturn", id.toString()));
        return toResponse(goodsReturn);
    }

    // ── Mapping helpers ──────────────────────────────────────────────────────────

    private GoodsReturnDtos.GoodsReturnResponse toResponse(GoodsReturn gr) {
        GoodsReturnDtos.GoodsReturnResponse res = new GoodsReturnDtos.GoodsReturnResponse();
        res.setId(gr.getId());
        res.setReturnNumber(gr.getReturnNumber());
        res.setType(gr.getType().name());
        res.setSupplierName(gr.getSupplierName());
        res.setReturnDate(gr.getReturnDate());
        res.setReason(gr.getReason());
        res.setTotalAmount(gr.getTotalAmount());
        res.setCreatedAt(gr.getCreatedAt());

        if (gr.getReferenceOrder() != null) {
            res.setReferenceOrderNumber(gr.getReferenceOrder().getOrderNumber());
        }

        if (gr.getCreatedBy() != null) {
            GoodsReturnDtos.PersonInfo pi = new GoodsReturnDtos.PersonInfo();
            pi.setId(gr.getCreatedBy().getId());
            pi.setFullName(gr.getCreatedBy().getFullName());
            res.setCreatedBy(pi);
        }

        res.setItems(gr.getItems().stream().map(item -> {
            GoodsReturnDtos.GoodsReturnItemResponse ir = new GoodsReturnDtos.GoodsReturnItemResponse();
            ir.setId(item.getId());
            ir.setProductName(item.getProduct().getName());
            ir.setProductBrand(item.getProduct().getBrand());
            ir.setBatchNumber(item.getBatchNumber());
            ir.setQuantity(item.getQuantity());
            ir.setUnitRate(item.getUnitRate());
            ir.setAmount(item.getAmount());
            ir.setReason(item.getReason());
            return ir;
        }).collect(Collectors.toList()));

        return res;
    }
}
