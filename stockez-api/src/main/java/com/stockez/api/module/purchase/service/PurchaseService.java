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

import com.stockez.common.exception.BusinessException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.Year;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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

        // Batches for new lines are saved only after this loop, so two identical lines in the
        // SAME entry would each miss the DB merge lookup — this map lets them share one batch number.
        Map<String, String> intraEntryBatchNos = new java.util.HashMap<>();

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
            // scale 2 — must match StockBatch.purchaseRate's stored precision, else the merge lookup never matches
            BigDecimal purchRate = netAmt.divide(qty, 2, java.math.RoundingMode.HALF_UP);
            BigDecimal rateExcl  = qty.compareTo(BigDecimal.ZERO) > 0 ? taxable.divide(qty, 4, java.math.RoundingMode.HALF_UP) : BigDecimal.ZERO;

            if (itemReq.getExpiryDate() == null) {
                throw new com.stockez.common.exception.BusinessException(
                    "Expiry date is required for '" + product.getName() + "'", "EXPIRY_DATE_REQUIRED");
            }
            if (itemReq.getMrp() == null || itemReq.getMrp().compareTo(BigDecimal.ZERO) <= 0) {
                throw new com.stockez.common.exception.BusinessException(
                    "MRP is required for '" + product.getName() + "'", "MRP_REQUIRED");
            }
            if (purchRate.compareTo(itemReq.getMrp()) > 0) {
                throw new com.stockez.common.exception.BusinessException(
                    "Purchase rate ₹" + purchRate.setScale(2, java.math.RoundingMode.HALF_UP) +
                    " for '" + product.getName() + "' cannot exceed MRP ₹" + itemReq.getMrp().setScale(2, java.math.RoundingMode.HALF_UP),
                    "PURCHASE_RATE_EXCEEDS_MRP");
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

            // Merge into existing batch if same product + expiry + purchase rate + MRP; otherwise new batch
            String batchNumber;
            if (itemReq.getExpiryDate() != null && itemReq.getMrp() != null) {
                Optional<StockBatch> mergeable = stockBatchRepository.findMergeableBatch(
                        tenantId, product.getId(), itemReq.getExpiryDate(), purchRate, itemReq.getMrp());
                if (mergeable.isPresent()) {
                    batchNumber = mergeable.get().getBatchNumber();
                } else {
                    // No DB match — reuse a number already assigned to an identical line in this same entry.
                    String key = product.getId() + "|" + itemReq.getExpiryDate() + "|"
                            + purchRate.stripTrailingZeros().toPlainString() + "|"
                            + itemReq.getMrp().stripTrailingZeros().toPlainString();
                    batchNumber = intraEntryBatchNos.computeIfAbsent(key,
                            k -> String.format("BCH-%s-%03d", dateTag, batchSeq.getAndIncrement()));
                }
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
                        .purchaseGstPercent(item.getGstPercent() != null ? item.getGstPercent() : BigDecimal.ZERO)
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
        Tenant tenant = entry.getTenant();

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

        // ── Remove lines entered by mistake ──────────────────────────────────
        // Only while nothing from that line's batch has sold — reverses the stock it added and
        // deletes the row outright (orphanRemoval), as if it was never entered.
        if (req.getRemoveItemIds() != null) {
            for (UUID removeId : req.getRemoveItemIds()) {
                PurchaseItem item = entry.getItems().stream()
                        .filter(i -> i.getId().equals(removeId))
                        .findFirst().orElse(null);
                if (item == null) continue;

                StockBatch batch = stockBatchRepository
                        .findByTenantAndBatchNumber(tenantId, item.getBatchNumber()).orElse(null);
                int soldQty = batch != null ? item.getQuantity() - batch.getQuantityAvailable() : 0;
                if (soldQty > 0) {
                    throw new BusinessException(
                        "Cannot remove '" + item.getProduct().getName() + "' — " + soldQty +
                        " unit(s) from this batch are already sold. Trim the quantity to " + soldQty +
                        " instead of removing the line.", "LINE_REMOVE_EXCEEDS_SOLD");
                }
                if (batch != null) {
                    batch.setQuantityReceived(batch.getQuantityReceived() - item.getQuantity());
                    batch.setQuantityAvailable(batch.getQuantityAvailable() - item.getQuantity());
                    batch.setActive(batch.getQuantityAvailable() > 0);
                    stockBatchRepository.save(batch);
                }
                Product product = item.getProduct();
                product.setStockQuantity((product.getStockQuantity() != null ? product.getStockQuantity() : 0) - item.getQuantity());
                productRepository.save(product);

                changes.add("removed '" + product.getName() + "' x" + item.getQuantity());
                entry.getItems().remove(item);
            }
            if (entry.getItems().isEmpty() && !"VOID".equals(entry.getStatus())) {
                entry.setStatus("VOID");
                changes.add("entry auto-voided — no lines remain");
            }
        }

        // ── Update existing items ────────────────────────────────────────────
        if (req.getItemUpdates() != null) {
            for (PurchaseDtos.BatchItemUpdate u : req.getItemUpdates()) {
                PurchaseItem item = entry.getItems().stream()
                        .filter(i -> i.getId().equals(u.getItemId()))
                        .findFirst().orElse(null);
                if (item == null) continue;

                StockBatch batch = stockBatchRepository
                        .findByTenantAndBatchNumber(tenantId, item.getBatchNumber()).orElse(null);

                // Quantity and/or rate (mistakenly-entered price) change — recomputed together since
                // both drive the item's financials.
                boolean qtyChanged  = u.getQuantity() != null && !u.getQuantity().equals(item.getQuantity());
                boolean rateChanged = u.getTotalAmount() != null && u.getTotalAmount().compareTo(item.getAmount()) != 0;
                if (qtyChanged || rateChanged) {
                    int oldQty = item.getQuantity();
                    int newQty = u.getQuantity() != null ? u.getQuantity() : oldQty;
                    int delta  = newQty - oldQty;

                    // A rate correction rewrites this batch's cost basis — only safe while nothing
                    // from it has sold yet (FIFO cost for sold units is already locked in), and only
                    // when the batch isn't shared with other purchases (merged by rate+MRP+expiry).
                    if (rateChanged) {
                        int soldQty = batch != null ? oldQty - batch.getQuantityAvailable() : 0;
                        if (soldQty > 0) {
                            throw new BusinessException(
                                "Cannot change the rate for '" + item.getProduct().getName() + "' — " + soldQty +
                                " unit(s) from this batch are already sold, which would rewrite their recorded cost. " +
                                "Reduce this line's quantity to " + soldQty + " and add a new line at the correct rate for the rest.",
                                "RATE_CHANGE_EXCEEDS_SOLD");
                        }
                        if (batch != null && purchaseEntryRepository.countItemsSharingBatch(tenantId, item.getBatchNumber()) > 1) {
                            throw new BusinessException(
                                "Batch " + item.getBatchNumber() + " is shared by multiple purchases (merged by the same " +
                                "rate, MRP and expiry). Changing its rate here would affect those other purchases too.",
                                "SHARED_BATCH_FIELD_LOCKED");
                        }
                    }
                    if (batch != null && delta < 0 && batch.getQuantityAvailable() < Math.abs(delta)) {
                        int soldQty = oldQty - batch.getQuantityAvailable();
                        throw new BusinessException(
                            "Cannot reduce '" + item.getProduct().getName() + "' below " + soldQty +
                            " — " + soldQty + " unit(s) already sold.",
                            "QTY_REDUCE_EXCEEDS_SOLD");
                    }

                    // Recalculate item financials — from the corrected total when the rate changed,
                    // otherwise from the existing per-unit purchase rate at the new quantity.
                    BigDecimal newNetAmt = rateChanged
                            ? u.getTotalAmount().setScale(2, RoundingMode.HALF_UP)
                            : item.getPurchaseRate().multiply(BigDecimal.valueOf(newQty));
                    BigDecimal newPurchRate = newNetAmt.divide(BigDecimal.valueOf(newQty), 2, RoundingMode.HALF_UP);
                    BigDecimal effectiveMrp = u.getMrp() != null ? u.getMrp() : item.getMrp();
                    if (rateChanged && effectiveMrp != null && newPurchRate.compareTo(effectiveMrp) > 0) {
                        throw new BusinessException(
                            "Purchase rate ₹" + newPurchRate + " for '" + item.getProduct().getName() +
                            "' cannot exceed MRP ₹" + effectiveMrp, "PURCHASE_RATE_EXCEEDS_MRP");
                    }
                    BigDecimal divisor    = BigDecimal.ONE.add(item.getGstPercent().divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP));
                    BigDecimal newTaxable = newNetAmt.divide(divisor, 2, RoundingMode.HALF_UP);
                    BigDecimal newCgstAmt = newTaxable.multiply(item.getCgstPercent()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

                    if (batch != null) {
                        batch.setQuantityReceived(batch.getQuantityReceived() + delta);
                        batch.setQuantityAvailable(batch.getQuantityAvailable() + delta);
                        batch.setActive(batch.getQuantityAvailable() > 0);
                        if (rateChanged) batch.setPurchaseRate(newPurchRate);
                    }
                    item.setQuantity(newQty);
                    item.setAmount(newNetAmt);
                    item.setTaxableAmount(newTaxable);
                    item.setCgstAmount(newCgstAmt);
                    item.setSgstAmount(newCgstAmt);
                    item.setGstAmount(newCgstAmt.add(newCgstAmt));
                    if (rateChanged) {
                        item.setPurchaseRate(newPurchRate);
                        item.setRateExclGst(newTaxable.divide(BigDecimal.valueOf(newQty), 4, RoundingMode.HALF_UP));
                    }

                    Product product = item.getProduct();
                    product.setStockQuantity((product.getStockQuantity() != null ? product.getStockQuantity() : 0) + delta);
                    if (rateChanged) product.setPurchaseRate(newPurchRate);
                    productRepository.save(product);

                    if (qtyChanged)  changes.add("qty for '" + item.getProduct().getName() + "': " + oldQty + " → " + newQty);
                    if (rateChanged) changes.add("rate for '" + item.getProduct().getName() + "' → ₹" + newPurchRate.toPlainString());
                }

                // A batch merged across multiple purchases must not have its MRP/expiry rewritten from
                // one purchase — it would silently change the others sharing it. Block with a message.
                boolean mrpChange    = u.getMrp() != null
                        && (item.getMrp() == null || item.getMrp().compareTo(u.getMrp()) != 0);
                boolean expiryChange = u.getExpiryDate() != null
                        && !u.getExpiryDate().equals(item.getExpiryDate());
                if ((mrpChange || expiryChange) && batch != null
                        && purchaseEntryRepository.countItemsSharingBatch(tenantId, item.getBatchNumber()) > 1) {
                    throw new BusinessException(
                        "Batch " + item.getBatchNumber() + " is shared by multiple purchases (merged by the same " +
                        "rate, MRP and expiry). Changing its MRP or expiry here would affect those other purchases too — " +
                        "edit the stock batch directly instead.",
                        "SHARED_BATCH_FIELD_LOCKED");
                }

                // Field updates on item and batch
                if (u.getMrp() != null)        item.setMrp(u.getMrp());
                if (u.getExpiryDate() != null) item.setExpiryDate(u.getExpiryDate());
                if (u.getMfgDate() != null)    item.setMfgDate(u.getMfgDate());
                if (batch != null) {
                    if (u.getMrp() != null)         batch.setMrp(u.getMrp());
                    if (u.getExpiryDate() != null)  batch.setExpiryDate(u.getExpiryDate());
                    if (u.getMfgDate() != null)     batch.setMfgDate(u.getMfgDate());
                    if (u.getMinSaleRate() != null) batch.setMinSaleRate(u.getMinSaleRate());
                    if (u.getMaxSaleRate() != null) batch.setMaxSaleRate(u.getMaxSaleRate());
                    stockBatchRepository.save(batch);
                }
            }
        }

        // ── Add new items ────────────────────────────────────────────────────
        if (req.getNewItems() != null && !req.getNewItems().isEmpty()) {
            String dateTag = entry.getPurchaseDate().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
            int existingCount = stockBatchRepository.countByTenantAndDate(tenantId, entry.getPurchaseDate());
            AtomicInteger batchSeq = new AtomicInteger(existingCount + 1);

            for (PurchaseDtos.PurchaseItemRequest itemReq : req.getNewItems()) {
                Product product = productRepository.findByIdAndTenantId(itemReq.getProductId(), tenantId)
                        .orElseThrow(() -> new ResourceNotFoundException("Product", itemReq.getProductId().toString()));

                BigDecimal gstPct   = product.getPurchaseGstPercent() != null ? product.getPurchaseGstPercent() : BigDecimal.ZERO;
                BigDecimal disAmt   = itemReq.getDiscountAmount() != null ? itemReq.getDiscountAmount() : BigDecimal.ZERO;
                BigDecimal netAmt   = itemReq.getTotalAmount().subtract(disAmt).setScale(2, RoundingMode.HALF_UP);
                BigDecimal divisor  = BigDecimal.ONE.add(gstPct.divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP));
                BigDecimal taxable  = netAmt.divide(divisor, 2, RoundingMode.HALF_UP);
                BigDecimal cgstPct  = gstPct.divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
                BigDecimal cgstAmt  = taxable.multiply(cgstPct).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                // scale 2 — must match StockBatch.purchaseRate's stored precision, else the merge lookup never matches
                BigDecimal purchRate = netAmt.divide(BigDecimal.valueOf(itemReq.getQuantity()), 2, RoundingMode.HALF_UP);
                BigDecimal rateExcl  = taxable.divide(BigDecimal.valueOf(itemReq.getQuantity()), 4, RoundingMode.HALF_UP);

                if (itemReq.getExpiryDate() == null) throw new BusinessException("Expiry date is required for '" + product.getName() + "'", "EXPIRY_DATE_REQUIRED");
                if (itemReq.getMrp() == null || itemReq.getMrp().compareTo(BigDecimal.ZERO) <= 0)
                    throw new BusinessException("MRP is required for '" + product.getName() + "'", "MRP_REQUIRED");
                if (purchRate.compareTo(itemReq.getMrp()) > 0)
                    throw new BusinessException(
                        "Purchase rate ₹" + purchRate.setScale(2, RoundingMode.HALF_UP) +
                        " for '" + product.getName() + "' cannot exceed MRP ₹" + itemReq.getMrp().setScale(2, RoundingMode.HALF_UP),
                        "PURCHASE_RATE_EXCEEDS_MRP");
                if (itemReq.getMinSaleRate() == null) throw new BusinessException("Min sale rate is required for '" + product.getName() + "'", "MIN_SALE_RATE_REQUIRED");
                if (itemReq.getMaxSaleRate() == null) throw new BusinessException("Max sale rate is required for '" + product.getName() + "'", "MAX_SALE_RATE_REQUIRED");

                String batchNumber;
                Optional<StockBatch> mergeable = (itemReq.getExpiryDate() != null && itemReq.getMrp() != null)
                        ? stockBatchRepository.findMergeableBatch(tenantId, product.getId(), itemReq.getExpiryDate(), purchRate, itemReq.getMrp())
                        : Optional.empty();
                batchNumber = mergeable.map(StockBatch::getBatchNumber)
                        .orElse(String.format("BCH-%s-%03d", dateTag, batchSeq.getAndIncrement()));

                PurchaseItem newItem = PurchaseItem.builder()
                        .purchaseEntry(entry).product(product).batchNumber(batchNumber)
                        .mrp(itemReq.getMrp()).rateExclGst(rateExcl).discountPercent(BigDecimal.ZERO)
                        .discountAmount(disAmt).taxableAmount(taxable).gstPercent(gstPct).gstAmount(cgstAmt.add(cgstAmt))
                        .cgstPercent(cgstPct).sgstPercent(cgstPct).cgstAmount(cgstAmt).sgstAmount(cgstAmt)
                        .purchaseRate(purchRate).mfgDate(itemReq.getMfgDate()).expiryDate(itemReq.getExpiryDate())
                        .quantity(itemReq.getQuantity()).amount(netAmt).build();
                entry.getItems().add(newItem);

                Optional<StockBatch> existingBatch = stockBatchRepository.findByTenantAndBatchNumber(tenantId, batchNumber);
                if (existingBatch.isPresent()) {
                    StockBatch b = existingBatch.get();
                    b.setQuantityReceived(b.getQuantityReceived() + itemReq.getQuantity());
                    b.setQuantityAvailable(b.getQuantityAvailable() + itemReq.getQuantity());
                    stockBatchRepository.save(b);
                } else {
                    StockBatch b = StockBatch.builder()
                            .tenant(tenant).product(product).batchNumber(batchNumber)
                            .mrp(itemReq.getMrp()).purchaseRate(purchRate).purchaseGstPercent(gstPct)
                            .minSaleRate(itemReq.getMinSaleRate()).maxSaleRate(itemReq.getMaxSaleRate())
                            .mfgDate(itemReq.getMfgDate()).expiryDate(itemReq.getExpiryDate())
                            .quantityReceived(itemReq.getQuantity()).quantityAvailable(itemReq.getQuantity())
                            .receivedDate(entry.getPurchaseDate()).build();
                    stockBatchRepository.save(b);
                    product.setMinSaleRate(itemReq.getMinSaleRate());
                    product.setMaxSaleRate(itemReq.getMaxSaleRate());
                }
                product.setStockQuantity((product.getStockQuantity() != null ? product.getStockQuantity() : 0) + itemReq.getQuantity());
                product.setPurchaseRate(purchRate);
                productRepository.save(product);
                changes.add("added '" + product.getName() + "' x" + itemReq.getQuantity());
            }
        }

        // ── Recalculate entry totals ─────────────────────────────────────────
        BigDecimal totalAmount = BigDecimal.ZERO, totalTaxable = BigDecimal.ZERO, totalCgst = BigDecimal.ZERO, totalSgst = BigDecimal.ZERO;
        for (PurchaseItem item : entry.getItems()) {
            totalAmount  = totalAmount.add(item.getAmount());
            totalTaxable = totalTaxable.add(item.getTaxableAmount());
            totalCgst    = totalCgst.add(item.getCgstAmount());
            totalSgst    = totalSgst.add(item.getSgstAmount());
        }
        entry.setTotalAmount(totalAmount);
        entry.setTotalTaxable(totalTaxable);
        entry.setTotalCgst(totalCgst);
        entry.setTotalSgst(totalSgst);

        PurchaseEntry saved = purchaseEntryRepository.save(entry);

        String performer = userRepository.findById(updatedById).map(User::getFullName).orElse("Unknown");
        String desc = changes.isEmpty()
                ? "Purchase entry " + saved.getEntryNumber() + " updated (no field changes)"
                : "Updated " + saved.getEntryNumber() + ": " + String.join(", ", changes);
        auditLogRepository.save(AuditLog.builder()
                .tenantId(tenantId).entityType("PURCHASE").entityId(saved.getId()).action("UPDATED")
                .description(desc).performedBy(performer).build());

        return toResponse(saved);
    }

    // Voids an entry entered by mistake in its entirety — only when nothing on it has sold and
    // nothing has been paid against it. Reverses all stock it added; keeps the row (number, items,
    // audit trail) with its financial impact zeroed, rather than deleting it — same convention as
    // the existing goods-return cancellation.
    public PurchaseDtos.PurchaseEntryResponse voidPurchaseEntry(UUID id, UUID tenantId, UUID voidedById) {
        PurchaseEntry entry = purchaseEntryRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("PurchaseEntry", id.toString()));

        if ("VOID".equals(entry.getStatus())) {
            throw new BusinessException("Purchase entry " + entry.getEntryNumber() + " is already voided.", "ALREADY_VOID");
        }
        if (entry.getPaidAmount().compareTo(BigDecimal.ZERO) > 0) {
            throw new BusinessException(
                "Cannot void " + entry.getEntryNumber() + " — ₹" + entry.getPaidAmount().toPlainString() +
                " has already been paid against it. Reverse the payment(s) first.", "VOID_HAS_PAYMENTS");
        }
        for (PurchaseItem item : entry.getItems()) {
            StockBatch batch = stockBatchRepository
                    .findByTenantAndBatchNumber(tenantId, item.getBatchNumber()).orElse(null);
            int soldQty = batch != null ? item.getQuantity() - batch.getQuantityAvailable() : 0;
            if (soldQty > 0) {
                throw new BusinessException(
                    "Cannot void " + entry.getEntryNumber() + " — " + soldQty + " unit(s) of '" +
                    item.getProduct().getName() + "' are already sold. Remove only the unsold lines instead.",
                    "VOID_HAS_SOLD_ITEMS");
            }
        }

        for (PurchaseItem item : entry.getItems()) {
            StockBatch batch = stockBatchRepository
                    .findByTenantAndBatchNumber(tenantId, item.getBatchNumber()).orElse(null);
            if (batch != null) {
                batch.setQuantityReceived(batch.getQuantityReceived() - item.getQuantity());
                batch.setQuantityAvailable(batch.getQuantityAvailable() - item.getQuantity());
                batch.setActive(batch.getQuantityAvailable() > 0);
                stockBatchRepository.save(batch);
            }
            Product product = item.getProduct();
            product.setStockQuantity((product.getStockQuantity() != null ? product.getStockQuantity() : 0) - item.getQuantity());
            productRepository.save(product);

            item.setAmount(BigDecimal.ZERO);
            item.setTaxableAmount(BigDecimal.ZERO);
            item.setCgstAmount(BigDecimal.ZERO);
            item.setSgstAmount(BigDecimal.ZERO);
            item.setGstAmount(BigDecimal.ZERO);
        }

        entry.setStatus("VOID");
        entry.setTotalAmount(BigDecimal.ZERO);
        entry.setTotalTaxable(BigDecimal.ZERO);
        entry.setTotalCgst(BigDecimal.ZERO);
        entry.setTotalSgst(BigDecimal.ZERO);
        PurchaseEntry saved = purchaseEntryRepository.save(entry);

        String performer = userRepository.findById(voidedById).map(User::getFullName).orElse("Unknown");
        auditLogRepository.save(AuditLog.builder()
                .tenantId(tenantId).entityType("PURCHASE").entityId(saved.getId()).action("VOIDED")
                .description("Voided " + saved.getEntryNumber() + " — entered by mistake, nothing sold or paid")
                .performedBy(performer).build());

        return toResponse(saved);
    }

    public PurchaseDtos.StockBatchResponse updateBatchRates(
            UUID batchId, PurchaseDtos.UpdateBatchRatesRequest req, UUID tenantId, UUID userId) {
        StockBatch batch = stockBatchRepository.findById(batchId)
                .filter(b -> b.getTenant().getId().equals(tenantId))
                .orElseThrow(() -> new ResourceNotFoundException("StockBatch", batchId.toString()));

        if (req.getMinSaleRate().compareTo(req.getMaxSaleRate()) > 0) {
            throw new BusinessException(
                    "Min sale rate (₹" + req.getMinSaleRate() + ") cannot exceed max sale rate (₹" + req.getMaxSaleRate() + ")",
                    "MIN_EXCEEDS_MAX");
        }

        BigDecimal oldMin = batch.getMinSaleRate();
        BigDecimal oldMax = batch.getMaxSaleRate();
        batch.setMinSaleRate(req.getMinSaleRate());
        batch.setMaxSaleRate(req.getMaxSaleRate());
        StockBatch saved = stockBatchRepository.save(batch);

        String performer = userRepository.findById(userId).map(User::getFullName).orElse("Unknown");
        auditLogRepository.save(AuditLog.builder()
                .tenantId(tenantId).entityType("STOCK_BATCH").entityId(saved.getId()).action("RATES_UPDATED")
                .description("Batch " + saved.getBatchNumber() + " sale rates: min ₹" + oldMin + " → ₹" + req.getMinSaleRate()
                        + ", max ₹" + oldMax + " → ₹" + req.getMaxSaleRate())
                .performedBy(performer).build());

        return toBatchResponse(saved);
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

    public java.util.List<PurchaseDtos.PurchaseEntryResponse> getAllPurchases(UUID tenantId) {
        return purchaseEntryRepository.findAllByTenant(tenantId)
                .stream().map(this::toResponse).collect(java.util.stream.Collectors.toList());
    }

    public Page<PurchaseDtos.PurchaseEntryResponse> listPurchases(
            UUID tenantId, String supplierName, String invoiceNumber, LocalDate from, LocalDate to, Pageable pageable) {
        String supplierParam = (supplierName != null && !supplierName.isBlank())
                ? "%" + supplierName.toLowerCase() + "%" : null;
        String invoiceParam = (invoiceNumber != null && !invoiceNumber.isBlank())
                ? "%" + invoiceNumber.toLowerCase() + "%" : null;
        LocalDate fromParam = from != null ? from : LocalDate.of(1900, 1, 1);
        LocalDate toParam   = to   != null ? to   : LocalDate.of(2999, 12, 31);
        return purchaseEntryRepository.findFiltered(tenantId, supplierParam, invoiceParam, fromParam, toParam, pageable)
                .map(this::toResponse);
    }

    public PurchaseDtos.PurchaseEntryResponse getPurchaseEntry(UUID id, UUID tenantId) {
        PurchaseEntry entry = purchaseEntryRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("PurchaseEntry", id.toString()));
        return toResponse(entry);
    }

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<PurchaseDtos.StockBatchResponse> getAllBatches(UUID tenantId, String status, String brand, String search, Pageable pageable) {
        LocalDate nearDate = LocalDate.now().plusDays(30);
        String brandParam  = (brand  != null && !brand.isBlank())  ? brand.toLowerCase()              : null;
        String searchParam = (search != null && !search.isBlank()) ? "%" + search.toLowerCase() + "%" : null;
        String s = status == null ? "active" : status;
        org.springframework.data.domain.Page<StockBatch> page = switch (s) {
            case "expired"     -> stockBatchRepository.findExpiredFiltered(tenantId, brandParam, searchParam, pageable);
            case "near-expiry" -> stockBatchRepository.findNearExpiryFiltered(tenantId, nearDate, brandParam, searchParam, pageable);
            default            -> stockBatchRepository.findActiveFiltered(tenantId, brandParam, searchParam, pageable);
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
        res.setPaidAmount(e.getPaidAmount());
        res.setStatus(e.getStatus());
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
                ir.setQuantityAvailable(b.getQuantityAvailable());
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
