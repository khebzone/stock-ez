package com.stockez.api.module.purchase.service;

import com.stockez.api.module.purchase.dto.PurchaseDraftDtos;
import com.stockez.api.module.purchase.entity.PurchaseDraft;
import com.stockez.api.module.purchase.repository.PurchaseDraftRepository;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.tenant.repository.TenantRepository;
import com.stockez.api.module.user.entity.User;
import com.stockez.api.module.user.repository.UserRepository;
import com.stockez.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class PurchaseDraftService {

    private final PurchaseDraftRepository draftRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<PurchaseDraftDtos.DraftResponse> list(UUID tenantId) {
        return draftRepository.findByTenantIdOrderByUpdatedAtDesc(tenantId).stream()
                .map(d -> toResponse(d, false))
                .toList();
    }

    @Transactional(readOnly = true)
    public PurchaseDraftDtos.DraftResponse get(UUID id, UUID tenantId) {
        return toResponse(find(id, tenantId), true);
    }

    public PurchaseDraftDtos.DraftResponse create(PurchaseDraftDtos.SaveDraftRequest req, UUID userId, UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));
        User user = userRepository.findByIdAndTenantId(userId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));
        PurchaseDraft draft = PurchaseDraft.builder()
                .tenant(tenant)
                .createdBy(user)
                .createdByName(user.getFullName())
                .build();
        apply(draft, req, user.getFullName());
        return toResponse(draftRepository.save(draft), false);
    }

    public PurchaseDraftDtos.DraftResponse update(UUID id, PurchaseDraftDtos.SaveDraftRequest req, UUID userId, UUID tenantId) {
        PurchaseDraft draft = find(id, tenantId);
        String name = userRepository.findById(userId).map(User::getFullName).orElse(null);
        apply(draft, req, name);
        return toResponse(draftRepository.saveAndFlush(draft), false);
    }

    public void delete(UUID id, UUID tenantId) {
        if (draftRepository.deleteOne(id, tenantId) == 0) {
            throw new ResourceNotFoundException("Purchase draft", id.toString());
        }
    }

    private PurchaseDraft find(UUID id, UUID tenantId) {
        return draftRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Purchase draft", id.toString()));
    }

    private void apply(PurchaseDraft d, PurchaseDraftDtos.SaveDraftRequest req, String userName) {
        d.setSupplierName(blankToNull(req.getSupplierName()));
        d.setInvoiceNumber(blankToNull(req.getInvoiceNumber()));
        d.setPurchaseDate(req.getPurchaseDate());
        d.setLineCount(req.getLineCount() != null ? req.getLineCount() : 0);
        d.setTotalAmount(req.getTotalAmount() != null ? req.getTotalAmount() : BigDecimal.ZERO);
        d.setPayload(req.getPayload());
        d.setUpdatedByName(userName);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private PurchaseDraftDtos.DraftResponse toResponse(PurchaseDraft d, boolean withPayload) {
        return PurchaseDraftDtos.DraftResponse.builder()
                .id(d.getId())
                .supplierName(d.getSupplierName())
                .invoiceNumber(d.getInvoiceNumber())
                .purchaseDate(d.getPurchaseDate())
                .lineCount(d.getLineCount() != null ? d.getLineCount() : 0)
                .totalAmount(d.getTotalAmount())
                .createdByName(d.getCreatedByName())
                .updatedByName(d.getUpdatedByName())
                .createdAt(d.getCreatedAt())
                .updatedAt(d.getUpdatedAt())
                .payload(withPayload ? d.getPayload() : null)
                .build();
    }
}
