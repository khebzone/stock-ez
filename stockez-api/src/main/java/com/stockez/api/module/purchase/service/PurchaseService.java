package com.stockez.api.module.purchase.service;

import com.stockez.api.module.audit.entity.AuditLog;
import com.stockez.api.module.audit.repository.AuditLogRepository;
import com.stockez.api.module.product.entity.Product;
import com.stockez.api.module.product.repository.ProductRepository;
import com.stockez.api.module.purchase.dto.PurchaseDtos;
import com.stockez.api.module.supplier.entity.Supplier;
import com.stockez.api.module.supplier.repository.SupplierRepository;
import com.stockez.api.module.purchase.entity.PurchaseEntry;
import com.stockez.api.module.purchase.entity.PurchaseItem;
import com.stockez.api.module.purchase.entity.StockBatch;
import com.stockez.api.module.purchase.repository.PurchaseEntryRepository;
import com.stockez.api.module.purchase.repository.StockBatchRepository;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.tenant.repository.TenantRepository;
import com.stockez.api.module.user.entity.User;
import com.stockez.api.module.user.repository.UserRepository;
import com.stockez.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Year;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class PurchaseService {

    private final PurchaseEntryRepository purchaseEntryRepository;
    private final StockBatchRepository stockBatchRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final SupplierRepository supplierRepository;
    private final AuditLogRepository auditLogRepository;

    public PurchaseDtos.PurchaseEntryResponse createPurchaseEntry(
            PurchaseDtos.CreatePurchaseRequest req, UUID createdById, UUID tenantId) {

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));
        User createdBy = userRepository.findByIdAndTenantId(createdById, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", createdById.toString()));

        int seq = purchaseEntryRepository.findMaxEntrySequence(tenantId) + 1;
        String entryNumber = String.format("PUR-%d-%05d", Year.now().getValue(), seq);

        Supplier supplier = null;
        if (req.getSupplierId() != null) {
            supplier = supplierRepository.findByIdAndTenantId(req.getSupplierId(), tenantId).orElse(null);
        }

        PurchaseEntry entry = PurchaseEntry.builder()
                .tenant(tenant)
                .entryNumber(entryNumber)
                .supplierName(supplier != null ? supplier.getName() : req.getSupplierName())
                .supplier(supplier)
                .purchaseDate(req.getPurchaseDate())
                .invoiceNumber(req.getInvoiceNumber())
                .notes(req.getNotes())
                .createdBy(createdBy)
                .build();

        BigDecimal totalAmount   = BigDecimal.ZERO;
        BigDecimal totalTaxable  = BigDecimal.ZERO;
        BigDecimal totalCgst     = BigDecimal.ZERO;
        BigDecimal totalSgst     = BigDecimal.ZERO;
        String dateTag = req.getPurchaseDate().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        int existingTodayCount = stockBatchRepository.countByTenantAndDate(tenantId, req.getPurchaseDate());
        AtomicInteger batchSeq = new AtomicInteger(existingTodayCount + 1);

        // Keep itemReqs in order so second loop can access min/max sale rates
        List<PurchaseDtos.PurchaseItemRequest> itemReqs = new ArrayList<>(req.getItems());

        for (PurchaseDtos.PurchaseItemRequest itemReq : req.getItems()) {
            Product product = productRepository.findByIdAndTenantId(itemReq.getProductId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("Product", itemReq.getProductId().toString()));

            BigDecimal qty      = BigDecimal.valueOf(itemReq.getQuantity());
            BigDecimal gstPct   = product.getPurchaseGstPercent() != null ? product.getPurchaseGstPercent() : BigDecimal.ZERO;
            BigDecimal disAmt   = itemReq.getDiscountAmount() != null ? itemReq.getDiscountAmount() : BigDecimal.ZERO;
            BigDecimal netAmt   = itemReq.getTotalAmount().subtract(disAmt).setScale(2, java.math.RoundingMode.HALF_UP);
            BigDecimal divisor  = BigDecimal.ONE.add(gstPct.divide(BigDecimal.valueOf(100), 6, java.math.RoundingMode.HALF_UP));
            BigDecimal taxable  = netAmt.divide(divisor, 2, java.math.RoundingMode.HALF_UP);
            BigDecimal cgstPct  = gstPct.divide(BigDecimal.valueOf(2), 2, java.math.RoundingMode.HALF_UP);
            BigDecimal cgstAmt  = taxable.multiply(cgstPct).divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
            BigDecimal sgstAmt  = cgstAmt;
            BigDecimal gstAmt   = cgstAmt.add(sgstAmt);
            BigDecimal purchRate = netAmt.divide(qty, 4, java.math.RoundingMode.HALF_UP);
            BigDecimal rateExcl  = qty.compareTo(BigDecimal.ZERO) > 0 ? taxable.divide(qty, 4, java.math.RoundingMode.HALF_UP) : BigDecimal.ZERO;

            if (itemReq.getExpiryDate() == null) {
                throw new com.stockez.common.exception.BusinessException(
                    "Expiry date is required for '" + product.getName() + "'", "EXPIRY_DATE_REQUIRED");
            }
            if (itemReq.getMinSaleRate() == null) {
                throw new com.stockez.common.exception.BusinessException(
                    "Min sale rate is required for '" + product.getName() + "'", "MIN_SALE_RATE_REQUIRED");
            }
            if (itemReq.getMaxSaleRate() == null) {
                throw new com.stockez.common.exception.BusinessException(
                    "Max sale rate is required for '" + product.getName() + "'", "MAX_SALE_RATE_REQUIRED");
            }
            if (itemReq.getMinSaleRate() != null && purchRate.compareTo(BigDecimal.ZERO) > 0
                    && itemReq.getMinSaleRate().compareTo(purchRate) <= 0) {
                throw new com.stockez.common.exception.BusinessException(
                    "Min sale rate ₹" + itemReq.getMinSaleRate() + " for '" + product.getName() +
                    "' must be greater than purchase rate ₹" + purchRate.setScale(2, java.math.RoundingMode.HALF_UP),
                    "MIN_RATE_BELOW_PURCHASE");
            }

            // Merge into existing batch if same product + expiry + purchase rate; otherwise new batch
            String batchNumber;
            if (itemReq.getExpiryDate() != null) {
                Optional<StockBatch> mergeable = stockBatchRepository.findMergeableBatch(
                        tenantId, product.getId(), itemReq.getExpiryDate(), purchRate);
                batchNumber = mergeable.map(StockBatch::getBatchNumber)
                        .orElse(String.format("BCH-%s-%03d", dateTag, batchSeq.getAndIncrement()));
            } else {
                batchNumber = String.format("BCH-%s-%03d", dateTag, batchSeq.getAndIncrement());
            }

            totalAmount  = totalAmount.add(netAmt);
            totalTaxable = totalTaxable.add(taxable);
            totalCgst    = totalCgst.add(cgstAmt);
            totalSgst    = totalSgst.add(sgstAmt);

            PurchaseItem item = PurchaseItem.builder()
                    .purchaseEntry(entry)
                    .product(product)
                    .batchNumber(batchNumber)
                    .mrp(itemReq.getMrp())
                    .rateExclGst(rateExcl)
                    .discountPercent(BigDecimal.ZERO)
                    .discountAmount(disAmt)
                    .taxableAmount(taxable)
                    .gstPercent(gstPct)
                    .gstAmount(gstAmt)
                    .cgstPercent(cgstPct)
                    .sgstPercent(cgstPct)
                    .cgstAmount(cgstAmt)
                    .sgstAmount(sgstAmt)
                    .purchaseRate(purchRate)
                    .mfgDate(itemReq.getMfgDate())
                    .expiryDate(itemReq.getExpiryDate())
                    .quantity(itemReq.getQuantity())
                    .amount(netAmt)
                    .build();

            entry.getItems().add(item);
        }

        entry.setTotalAmount(totalAmount);
        entry.setTotalTaxable(totalTaxable);
        entry.setTotalCgst(totalCgst);
        entry.setTotalSgst(totalSgst);
        PurchaseEntry saved = purchaseEntryRepository.save(entry);

        // Create or merge stock batches, then update product stock
        int idx = 0;
        for (PurchaseItem item : saved.getItems()) {
            PurchaseDtos.PurchaseItemRequest itemReq = itemReqs.get(idx++);
            Product product = item.getProduct();

            Optional<StockBatch> existingBatch = stockBatchRepository
                    .findByTenantAndBatchNumber(tenantId, item.getBatchNumber());

            if (existingBatch.isPresent()) {
                StockBatch batch = existingBatch.get();
                batch.setQuantityReceived(batch.getQuantityReceived() + item.getQuantity());
                batch.setQuantityAvailable(batch.getQuantityAvailable() + item.getQuantity());
                batch.setPurchaseItem(item);
                stockBatchRepository.save(batch);
            } else {
                BigDecimal minRate = itemReq.getMinSaleRate() != null ? itemReq.getMinSaleRate() : product.getMinSaleRate();
                BigDecimal maxRate = itemReq.getMaxSaleRate() != null ? itemReq.getMaxSaleRate() : product.getMaxSaleRate();
                StockBatch batch = StockBatch.builder()
                        .tenant(tenant)
                        .product(product)
                        .purchaseItem(item)
                        .batchNumber(item.getBatchNumber())
                        .mrp(item.getMrp())
                        .purchaseRate(item.getPurchaseRate())
                        .minSaleRate(minRate)
                        .maxSaleRate(maxRate)
                        .mfgDate(item.getMfgDate())
                        .expiryDate(item.getExpiryDate())
                        .quantityReceived(item.getQuantity())
                        .quantityAvailable(item.getQuantity())
                        .receivedDate(req.getPurchaseDate())
                        .build();
                stockBatchRepository.save(batch);
                if (minRate != null) product.setMinSaleRate(minRate);
                if (maxRate != null) product.setMaxSaleRate(maxRate);
            }

            int currentStock = product.getStockQuantity() != null ? product.getStockQuantity() : 0;
            product.setStockQuantity(currentStock + item.getQuantity());
            product.setMrp(item.getMrp());
            product.setPurchaseRate(item.getPurchaseRate());
            productRepository.save(product);
        }

        auditLogRepository.save(AuditLog.builder()
                .tenantId(tenantId)
                .entityType("PURCHASE")
                .entityId(saved.getId())
                .action("CREATED")
                .description(String.format("Purchase entry %s created — %d item(s), total ₹%s, supplier: %s",
                        saved.getEntryNumber(), saved.getItems().size(),
                        saved.getTotalAmount().toPlainString(), saved.getSupplierName()))
                .performedBy(createdBy.getFullName())
                .build());

        return toResponse(saved);
    }

    public PurchaseDtos.PurchaseEntryResponse updatePurchaseEntry(
            UUID id, UUID tenantId, UUID updatedById, PurchaseDtos.UpdatePurchaseRequest req) {
        PurchaseEntry entry = purchaseEntryRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("PurchaseEntry", id.toString()));

        List<String> changes = new ArrayList<>();
        if (!entry.getSupplierName().equals(req.getSupplierName()))
            changes.add("supplier '" + entry.getSupplierName() + "' → '" + req.getSupplierName() + "'");
        if (!entry.getPurchaseDate().equals(req.getPurchaseDate()))
            changes.add("date " + entry.getPurchaseDate() + " → " + req.getPurchaseDate());
        String oldInv = entry.getInvoiceNumber() != null ? entry.getInvoiceNumber() : "";
        String newInv = req.getInvoiceNumber()   != null ? req.getInvoiceNumber()   : "";
        if (!oldInv.equals(newInv))
            changes.add("invoice '" + oldInv + "' → '" + newInv + "'");

        entry.setSupplierName(req.getSupplierName());
        entry.setPurchaseDate(req.getPurchaseDate());
        entry.setInvoiceNumber(req.getInvoiceNumber());
        entry.setNotes(req.getNotes());
        if (req.getSupplierId() != null) {
            supplierRepository.findById(req.getSupplierId()).ifPresent(entry::setSupplier);
        }

        if (req.getItemUpdates() != null && !req.getItemUpdates().isEmpty()) {
            for (PurchaseDtos.BatchItemUpdate u : req.getItemUpdates()) {
                entry.getItems().stream()
                        .filter(item -> item.getId().equals(u.getItemId()))
                        .findFirst()
                        .ifPresent(item -> {
                            if (u.getMrp() != null)         item.setMrp(u.getMrp());
                            if (u.getExpiryDate() != null)  item.setExpiryDate(u.getExpiryDate());
                            if (u.getMfgDate() != null)     item.setMfgDate(u.getMfgDate());
                            stockBatchRepository.findByTenantAndBatchNumber(tenantId, item.getBatchNumber())
                                    .ifPresent(batch -> {
                                        if (u.getMrp() != null)          batch.setMrp(u.getMrp());
                                        if (u.getExpiryDate() != null)   batch.setExpiryDate(u.getExpiryDate());
                                        if (u.getMfgDate() != null)      batch.setMfgDate(u.getMfgDate());
                                        if (u.getMinSaleRate() != null)  batch.setMinSaleRate(u.getMinSaleRate());
                                        if (u.getMaxSaleRate() != null)  batch.setMaxSaleRate(u.getMaxSaleRate());
                                        stockBatchRepository.save(batch);
                                    });
                            changes.add("item " + item.getBatchNumber() + " updated");
                        });
            }
        }

        PurchaseEntry saved = purchaseEntryRepository.save(entry);

        String performer = userRepository.findById(updatedById)
                .map(User::getFullName).orElse("Unknown");
        String desc = changes.isEmpty()
                ? "Purchase entry " + saved.getEntryNumber() + " updated (no field changes)"
                : "Updated " + saved.getEntryNumber() + ": " + String.join(", ", changes);
        auditLogRepository.save(AuditLog.builder()
                .tenantId(tenantId)
                .entityType("PURCHASE")
                .entityId(saved.getId())
                .action("UPDATED")
                .description(desc)
                .performedBy(performer)
                .build());

        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<PurchaseDtos.AuditLogResponse> getAuditHistory(UUID id, UUID tenantId) {
        purchaseEntryRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("PurchaseEntry", id.toString()));
        return auditLogRepository.findByTenantAndEntity(tenantId, "PURCHASE", id)
                .stream().map(l -> {
                    PurchaseDtos.AuditLogResponse r = new PurchaseDtos.AuditLogResponse();
                    r.setId(l.getId());
                    r.setAction(l.getAction());
                    r.setDescription(l.getDescription());
                    r.setPerformedBy(l.getPerformedBy());
                    r.setPerformedAt(l.getPerformedAt());
                    return r;
                }).collect(Collectors.toList());
    }

    public Page<PurchaseDtos.PurchaseEntryResponse> listPurchases(
            UUID tenantId, String supplierName, LocalDate from, LocalDate to, Pageable pageable) {
        String supplierParam = (supplierName != null && !supplierName.isBlank())
                ? "%" + supplierName.toLowerCase() + "%" : null;
        return purchaseEntryRepository.findFiltered(tenantId, supplierParam, from, to, pageable)
                .map(this::toResponse);
    }

    public PurchaseDtos.PurchaseEntryResponse getPurchaseEntry(UUID id, UUID tenantId) {
        PurchaseEntry entry = purchaseEntryRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("PurchaseEntry", id.toString()));
        return toResponse(entry);
    }

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<PurchaseDtos.StockBatchResponse> getAllBatches(UUID tenantId, String status, Pageable pageable) {
        LocalDate nearDate = LocalDate.now().plusDays(30);
        org.springframework.data.domain.Page<StockBatch> page = switch (status == null ? "active" : status) {
            case "expired"    -> stockBatchRepository.findExpiredPaged(tenantId, pageable);
            case "near-expiry"-> stockBatchRepository.findNearExpiryPaged(tenantId, nearDate, pageable);
            default           -> stockBatchRepository.findAllActivePaged(tenantId, pageable);
        };
        return page.map(this::toBatchResponse);
    }

    @Transactional(readOnly = true)
    public List<PurchaseDtos.StockBatchResponse> getBatchesByProduct(UUID productId, UUID tenantId) {
        return stockBatchRepository.findByTenantAndProduct(tenantId, productId)
                .stream().map(this::toBatchResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<PurchaseDtos.NearExpiryAlert> getNearExpiryAlerts(UUID tenantId, int daysAhead) {
        LocalDate alertDate = LocalDate.now().plusDays(daysAhead);
        return stockBatchRepository.findNearExpiry(tenantId, alertDate)
                .stream().map(b -> {
                    PurchaseDtos.NearExpiryAlert alert = new PurchaseDtos.NearExpiryAlert();
                    alert.setBatchId(b.getId());
                    alert.setBatchNumber(b.getBatchNumber());
                    alert.setProduct(toProductInfo(b.getProduct()));
                    alert.setExpiryDate(b.getExpiryDate());
                    long days = b.getExpiryDate().toEpochDay() - LocalDate.now().toEpochDay();
                    alert.setDaysToExpiry((int) days);
                    alert.setQuantityAvailable(b.getQuantityAvailable());
                    return alert;
                }).collect(Collectors.toList());
    }

    private PurchaseDtos.PurchaseEntryResponse toResponse(PurchaseEntry e) {
        PurchaseDtos.PurchaseEntryResponse res = new PurchaseDtos.PurchaseEntryResponse();
        res.setId(e.getId());
        res.setEntryNumber(e.getEntryNumber());
        res.setSupplierName(e.getSupplierName());
        if (e.getSupplier() != null) res.setSupplierId(e.getSupplier().getId());
        res.setPurchaseDate(e.getPurchaseDate());
        res.setInvoiceNumber(e.getInvoiceNumber());
        res.setTotalAmount(e.getTotalAmount());
        res.setTotalTaxable(e.getTotalTaxable());
        res.setTotalCgst(e.getTotalCgst());
        res.setTotalSgst(e.getTotalSgst());
        res.setNotes(e.getNotes());
        res.setCreatedAt(e.getCreatedAt());

        if (e.getCreatedBy() != null) {
            PurchaseDtos.PersonInfo pi = new PurchaseDtos.PersonInfo();
            pi.setId(e.getCreatedBy().getId());
            pi.setFullName(e.getCreatedBy().getFullName());
            res.setCreatedBy(pi);
        }

        UUID tenantId = e.getTenant().getId();
        res.setItems(e.getItems().stream().map(item -> {
            PurchaseDtos.PurchaseItemResponse ir = new PurchaseDtos.PurchaseItemResponse();
            ir.setId(item.getId());
            ir.setProduct(toProductInfo(item.getProduct()));
            ir.setBatchNumber(item.getBatchNumber());
            ir.setMrp(item.getMrp());
            ir.setDiscountAmount(item.getDiscountAmount());
            ir.setTaxableAmount(item.getTaxableAmount());
            ir.setGstPercent(item.getGstPercent());
            ir.setCgstPercent(item.getCgstPercent());
            ir.setSgstPercent(item.getSgstPercent());
            ir.setCgstAmount(item.getCgstAmount());
            ir.setSgstAmount(item.getSgstAmount());
            ir.setGstAmount(item.getGstAmount());
            ir.setPurchaseRate(item.getPurchaseRate());
            ir.setMfgDate(item.getMfgDate());
            ir.setExpiryDate(item.getExpiryDate());
            ir.setQuantity(item.getQuantity());
            ir.setAmount(item.getAmount());
            stockBatchRepository.findByTenantAndBatchNumber(tenantId, item.getBatchNumber()).ifPresent(b -> {
                ir.setMinSaleRate(b.getMinSaleRate());
                ir.setMaxSaleRate(b.getMaxSaleRate());
            });
            return ir;
        }).collect(Collectors.toList()));

        return res;
    }

    private PurchaseDtos.StockBatchResponse toBatchResponse(StockBatch b) {
        PurchaseDtos.StockBatchResponse res = new PurchaseDtos.StockBatchResponse();
        res.setId(b.getId());
        res.setProduct(toProductInfo(b.getProduct()));
        res.setBatchNumber(b.getBatchNumber());
        res.setMrp(b.getMrp());
        res.setPurchaseRate(b.getPurchaseRate());
        res.setMinSaleRate(b.getMinSaleRate());
        res.setMaxSaleRate(b.getMaxSaleRate());
        res.setMfgDate(b.getMfgDate());
        res.setExpiryDate(b.getExpiryDate());
        res.setQuantityReceived(b.getQuantityReceived());
        res.setQuantityAvailable(b.getQuantityAvailable());
        res.setReceivedDate(b.getReceivedDate());
        res.setActive(b.isActive());
        res.setCreatedAt(b.getCreatedAt());
        if (b.getPurchaseItem() != null) {
            PurchaseEntry pe = b.getPurchaseItem().getPurchaseEntry();
            if (pe != null) {
                res.setPurchaseEntryNumber(pe.getEntryNumber());
                res.setSupplierName(pe.getSupplierName());
                if (pe.getSupplier() != null) {
                    res.setSupplierId(pe.getSupplier().getId());
                }
            }
        }
        if (b.getExpiryDate() != null) {
            long days = b.getExpiryDate().toEpochDay() - LocalDate.now().toEpochDay();
            res.setExpired(days < 0);
            res.setNearExpiry(days >= 0 && days <= 30);
        }
        return res;
    }

    private PurchaseDtos.ProductInfo toProductInfo(Product p) {
        PurchaseDtos.ProductInfo pi = new PurchaseDtos.ProductInfo();
        pi.setId(p.getId());
        pi.setName(p.getName());
        pi.setBrand(p.getBrand());
        pi.setUnit(p.getUnit());
        pi.setHsnCode(p.getHsnCode());
        pi.setImageUrl(p.getImageUrl());
        return pi;
    }
}
