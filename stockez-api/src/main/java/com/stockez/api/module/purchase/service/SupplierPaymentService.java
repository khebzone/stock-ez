package com.stockez.api.module.purchase.service;

import com.stockez.api.module.purchase.dto.SupplierPaymentDtos;
import com.stockez.api.module.purchase.entity.PurchaseEntry;
import com.stockez.api.module.purchase.entity.SupplierPayment;
import com.stockez.api.module.purchase.repository.PurchaseEntryRepository;
import com.stockez.api.module.purchase.repository.SupplierPaymentRepository;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.tenant.repository.TenantRepository;
import com.stockez.api.module.user.entity.User;
import com.stockez.api.module.user.repository.UserRepository;
import com.stockez.common.exception.BusinessException;
import com.stockez.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class SupplierPaymentService {

    private final SupplierPaymentRepository paymentRepository;
    private final PurchaseEntryRepository purchaseEntryRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final com.stockez.api.module.goodsreturn.repository.GoodsReturnRepository goodsReturnRepository;

    public SupplierPaymentDtos.SupplierPaymentResponse createPayment(
            UUID tenantId, UUID userId, SupplierPaymentDtos.CreateSupplierPaymentRequest req) {

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));

        PurchaseEntry entry = null;
        if (req.getPurchaseEntryId() != null) {
            entry = purchaseEntryRepository.findByIdAndTenantId(req.getPurchaseEntryId(), tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("PurchaseEntry", req.getPurchaseEntryId().toString()));
            // Goods returned against this bill are money we no longer owe on it — paying past that
            // would hand the supplier the same value twice.
            BigDecimal credit = nz(goodsReturnRepository.sumOpenCreditByPurchaseEntry(tenantId, entry.getId()));
            BigDecimal balance = entry.getTotalAmount().subtract(entry.getPaidAmount()).subtract(credit);
            if (req.getAmount().compareTo(balance) > 0) {
                throw new BusinessException(
                    "Payment amount exceeds bill balance of ₹" + balance.toPlainString()
                    + (credit.signum() > 0 ? " (after ₹" + credit.toPlainString() + " of goods returned)" : ""),
                    "PAYMENT_EXCEEDS_BALANCE"
                );
            }
            entry.setPaidAmount(entry.getPaidAmount().add(req.getAmount()));
            purchaseEntryRepository.save(entry);
        }

        SupplierPayment payment = SupplierPayment.builder()
                .tenant(tenant)
                .purchaseEntry(entry)
                .supplierName(req.getSupplierName())
                .amount(req.getAmount())
                .paymentDate(req.getPaymentDate())
                .paymentMethod(req.getPaymentMethod())
                .referenceNumber(req.getReferenceNumber())
                .notes(req.getNotes())
                .createdBy(user)
                .build();

        return toResponse(paymentRepository.save(payment));
    }

    @Transactional(readOnly = true)
    public List<SupplierPaymentDtos.SupplierPaymentResponse> getPayments(UUID tenantId, String supplierName) {
        List<SupplierPayment> payments = supplierName != null && !supplierName.isBlank()
                ? paymentRepository.findByTenantAndSupplier(tenantId, "%" + supplierName.toLowerCase() + "%")
                : paymentRepository.findByTenantIdOrderByPaymentDateDesc(tenantId);
        return payments.stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SupplierPaymentDtos.SupplierSummary> getSupplierSummaries(UUID tenantId) {
        List<Object[]> purchaseSums = purchaseEntryRepository.sumBySupplierName(tenantId);
        List<Object[]> paymentSums = paymentRepository.sumPaidBySupplier(tenantId);

        Map<String, BigDecimal> paidMap = new HashMap<>();
        Map<String, LocalDate> lastPaymentMap = new HashMap<>();
        for (Object[] row : paymentSums) {
            paidMap.put((String) row[0], (BigDecimal) row[1]);
            lastPaymentMap.put((String) row[0], (LocalDate) row[2]);
        }

        // Goods we sent back and have not been compensated for in cash or in kind — we owe that much less.
        Map<String, BigDecimal> creditMap = new HashMap<>();
        for (Object[] row : goodsReturnRepository.sumOpenSupplierCreditGrouped(tenantId)) {
            creditMap.merge(((String) row[0]).toLowerCase(), nz((BigDecimal) row[1]), BigDecimal::add);
        }

        return purchaseSums.stream().map(row -> {
            String name = (String) row[0];
            BigDecimal totalPurchased = (BigDecimal) row[1];
            LocalDate lastPurchase = (LocalDate) row[2];
            BigDecimal totalPaid = paidMap.getOrDefault(name, BigDecimal.ZERO);
            BigDecimal credit = name != null
                    ? creditMap.getOrDefault(name.toLowerCase(), BigDecimal.ZERO) : BigDecimal.ZERO;
            return SupplierPaymentDtos.SupplierSummary.builder()
                    .supplierName(name)
                    .totalPurchased(totalPurchased)
                    .totalPaid(totalPaid)
                    .returnCredit(credit)
                    .outstanding(totalPurchased.subtract(totalPaid).subtract(credit))
                    .lastPurchaseDate(lastPurchase)
                    .lastPaymentDate(lastPaymentMap.get(name))
                    .build();
        }).collect(Collectors.toList());
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    @Transactional(readOnly = true)
    public List<SupplierPaymentDtos.UnpaidPurchaseEntry> getUnpaidEntries(UUID tenantId, String supplierName) {
        Map<UUID, BigDecimal> creditByEntry = new HashMap<>();
        for (Object[] row : goodsReturnRepository.sumOpenCreditByPurchaseEntryGrouped(tenantId)) {
            creditByEntry.merge((UUID) row[0], nz((BigDecimal) row[1]), BigDecimal::add);
        }

        return purchaseEntryRepository.findUnpaidBySupplierName(tenantId, supplierName)
                .stream().map(e -> {
                    BigDecimal credit = creditByEntry.getOrDefault(e.getId(), BigDecimal.ZERO);
                    return SupplierPaymentDtos.UnpaidPurchaseEntry.builder()
                            .id(e.getId())
                            .entryNumber(e.getEntryNumber())
                            .purchaseDate(e.getPurchaseDate())
                            .totalAmount(e.getTotalAmount())
                            .paidAmount(e.getPaidAmount())
                            .returnCredit(credit)
                            .balanceAmount(e.getTotalAmount().subtract(e.getPaidAmount()).subtract(credit))
                            .invoiceNumber(e.getInvoiceNumber())
                            .openingBalance(e.isOpeningBalance())
                            .build();
                })
                // A bill fully cancelled out by returned goods has nothing left to pay.
                .filter(u -> u.getBalanceAmount().signum() > 0)
                .collect(Collectors.toList());
    }

    public void deletePayment(UUID tenantId, UUID id) {
        SupplierPayment payment = paymentRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("SupplierPayment", id.toString()));
        if (payment.getPurchaseEntry() != null) {
            PurchaseEntry entry = payment.getPurchaseEntry();
            BigDecimal reversed = entry.getPaidAmount().subtract(payment.getAmount());
            entry.setPaidAmount(reversed.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : reversed);
            purchaseEntryRepository.save(entry);
        }
        paymentRepository.delete(payment);
    }

    private SupplierPaymentDtos.SupplierPaymentResponse toResponse(SupplierPayment p) {
        return SupplierPaymentDtos.SupplierPaymentResponse.builder()
                .id(p.getId())
                .purchaseEntryId(p.getPurchaseEntry() != null ? p.getPurchaseEntry().getId() : null)
                .purchaseEntryNumber(p.getPurchaseEntry() != null ? p.getPurchaseEntry().getEntryNumber() : null)
                .supplierName(p.getSupplierName())
                .amount(p.getAmount())
                .paymentDate(p.getPaymentDate())
                .paymentMethod(p.getPaymentMethod())
                .referenceNumber(p.getReferenceNumber())
                .notes(p.getNotes())
                .createdAt(p.getCreatedAt())
                .build();
    }
}
