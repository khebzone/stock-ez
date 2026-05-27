package com.stockez.api.module.payment.service;

import com.stockez.api.module.payment.dto.PaymentMethodDtos;
import com.stockez.api.module.payment.entity.PaymentMethod;
import com.stockez.api.module.payment.repository.PaymentMethodRepository;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.tenant.repository.TenantRepository;
import com.stockez.common.exception.BusinessException;
import com.stockez.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class PaymentMethodService {

    private final PaymentMethodRepository paymentMethodRepository;
    private final TenantRepository tenantRepository;

    public PaymentMethodDtos.Response create(PaymentMethodDtos.CreateRequest req, UUID tenantId) {
        if (paymentMethodRepository.existsByTenantIdAndNameIgnoreCaseAndActiveTrue(tenantId, req.getName())) {
            throw new BusinessException("Payment method '" + req.getName() + "' already exists.", "DUPLICATE_PAYMENT_METHOD");
        }

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));

        // Validate mode
        validateMode(req.getMode());

        PaymentMethod method = PaymentMethod.builder()
                .tenant(tenant)
                .name(req.getName().trim())
                .mode(req.getMode().toUpperCase())
                .sortOrder(req.getSortOrder() != null ? req.getSortOrder() : 0)
                .build();

        return toResponse(paymentMethodRepository.save(method));
    }

    @Transactional(readOnly = true)
    public List<PaymentMethodDtos.Response> getAll(UUID tenantId) {
        return paymentMethodRepository.findByTenantIdAndActiveTrueOrderBySortOrderAscNameAsc(tenantId)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    public void delete(UUID id, UUID tenantId) {
        PaymentMethod method = paymentMethodRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("PaymentMethod", id.toString()));
        method.setActive(false);
        paymentMethodRepository.save(method);
    }

    private void validateMode(String mode) {
        try {
            com.stockez.api.module.order.entity.Payment.PaymentMode.valueOf(mode.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BusinessException("Invalid payment mode: " + mode + ". Must be one of: CASH, UPI, CHEQUE, NEFT, RTGS, CREDIT", "INVALID_PAYMENT_MODE");
        }
    }

    private PaymentMethodDtos.Response toResponse(PaymentMethod m) {
        PaymentMethodDtos.Response r = new PaymentMethodDtos.Response();
        r.setId(m.getId());
        r.setName(m.getName());
        r.setMode(m.getMode());
        r.setActive(m.isActive());
        r.setSortOrder(m.getSortOrder());
        r.setCreatedAt(m.getCreatedAt());
        return r;
    }
}
