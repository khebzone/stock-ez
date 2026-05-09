package com.distroiq.api.module.purchase.service;

import com.distroiq.api.module.purchase.dto.SupplierPaymentDtos;
import com.distroiq.api.module.purchase.entity.PurchaseEntry;
import com.distroiq.api.module.purchase.entity.SupplierPayment;
import com.distroiq.api.module.purchase.repository.PurchaseEntryRepository;
import com.distroiq.api.module.purchase.repository.SupplierPaymentRepository;
import com.distroiq.api.module.tenant.entity.Tenant;
import com.distroiq.api.module.tenant.repository.TenantRepository;
import com.distroiq.api.module.user.entity.User;
import com.distroiq.api.module.user.repository.UserRepository;
import com.distroiq.common.exception.ResourceNotFoundException;
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

    public SupplierPaymentDtos.SupplierPaymentResponse createPayment(
            UUID tenantId, UUID userId, SupplierPaymentDtos.CreateSupplierPaymentRequest req) {

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));

        PurchaseEntry entry = null;
        if (req.getPurchaseEntryId() != null) {
            entry = purchaseEntryRepository.findByIdAndTenantId(req.getPurchaseEntryId(), tenantId).orElse(null);
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

        return purchaseSums.stream().map(row -> {
            String name = (String) row[0];
            BigDecimal totalPurchased = (BigDecimal) row[1];
            LocalDate lastPurchase = (LocalDate) row[2];
            BigDecimal totalPaid = paidMap.getOrDefault(name, BigDecimal.ZERO);
            return SupplierPaymentDtos.SupplierSummary.builder()
                    .supplierName(name)
                    .totalPurchased(totalPurchased)
                    .totalPaid(totalPaid)
                    .outstanding(totalPurchased.subtract(totalPaid))
                    .lastPurchaseDate(lastPurchase)
                    .lastPaymentDate(lastPaymentMap.get(name))
                    .build();
        }).collect(Collectors.toList());
    }

    public void deletePayment(UUID tenantId, UUID id) {
        SupplierPayment payment = paymentRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("SupplierPayment", id.toString()));
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
