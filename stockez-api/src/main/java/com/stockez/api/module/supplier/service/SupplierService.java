package com.stockez.api.module.supplier.service;

import com.stockez.api.module.supplier.dto.SupplierDtos;
import com.stockez.api.module.supplier.entity.Supplier;
import com.stockez.api.module.supplier.repository.SupplierRepository;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.audit.service.AuditService;
import com.stockez.common.exception.BusinessException;
import com.stockez.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SupplierService {

    private final SupplierRepository supplierRepository;
    private final AuditService auditService;

    public Page<SupplierDtos.SupplierResponse> getAll(UUID tenantId, String search, Pageable pageable) {
        Page<Supplier> page = (search != null && !search.isBlank())
                ? supplierRepository.search(tenantId, search, pageable)
                : supplierRepository.findByTenantIdAndActiveTrue(tenantId, pageable);
        return page.map(this::toResponse);
    }

    public SupplierDtos.SupplierResponse getById(UUID id, UUID tenantId) {
        return toResponse(find(id, tenantId));
    }

    @Transactional
    public SupplierDtos.SupplierResponse create(SupplierDtos.CreateSupplierRequest req, UUID tenantId) {
        trimAndValidate(req);
        if (supplierRepository.existsByTenantIdAndPhoneAndActiveTrue(tenantId, req.phone)) {
            throw new BusinessException("A supplier with this phone number already exists.", "DUPLICATE_SUPPLIER_PHONE");
        }
        Tenant tenant = new Tenant(); tenant.setId(tenantId);
        Supplier s = Supplier.builder()
                .tenant(tenant)
                .name(trim(req.name))
                .contactPerson(trim(req.contactPerson))
                .phone(trim(req.phone))
                .altPhone(trim(req.altPhone))
                .email(trim(req.email))
                .address(trim(req.address))
                .city(trim(req.city))
                .state(trim(req.state))
                .gstin(upper(req.gstin))
                .fssaiNumber(trim(req.fssaiNumber))
                .bankName(trim(req.bankName))
                .bankAccount(trim(req.bankAccount))
                .bankIfsc(upper(req.bankIfsc))
                .build();
        Supplier saved = supplierRepository.save(s);
        auditService.record(tenantId, "SUPPLIER", saved.getId(), "CREATED",
                "Supplier " + saved.getName() + " added");
        return toResponse(saved);
    }

    @Transactional
    public SupplierDtos.SupplierResponse update(UUID id, SupplierDtos.UpdateSupplierRequest req, UUID tenantId) {
        trimAndValidate(req);
        Supplier s = find(id, tenantId);
        if (!s.getPhone().equals(req.phone) &&
                supplierRepository.existsByTenantIdAndPhoneAndActiveTrueAndIdNot(tenantId, req.phone, id)) {
            throw new BusinessException("A supplier with this phone number already exists.", "DUPLICATE_SUPPLIER_PHONE");
        }
        s.setName(trim(req.name));
        s.setContactPerson(trim(req.contactPerson));
        s.setPhone(trim(req.phone));
        s.setAltPhone(trim(req.altPhone));
        s.setEmail(trim(req.email));
        s.setAddress(trim(req.address));
        s.setCity(trim(req.city));
        s.setState(trim(req.state));
        s.setGstin(upper(req.gstin));
        s.setFssaiNumber(trim(req.fssaiNumber));
        s.setBankName(trim(req.bankName));
        s.setBankAccount(trim(req.bankAccount));
        s.setBankIfsc(upper(req.bankIfsc));
        if (req.active != null) s.setActive(req.active);
        Supplier saved = supplierRepository.save(s);
        auditService.record(tenantId, "SUPPLIER", saved.getId(), "UPDATED",
                "Supplier " + saved.getName() + " updated");
        return toResponse(saved);
    }

    @Transactional
    public void deactivate(UUID id, UUID tenantId) {
        Supplier s = find(id, tenantId);
        s.setActive(false);
        supplierRepository.save(s);
        auditService.record(tenantId, "SUPPLIER", s.getId(), "DEACTIVATED",
                "Supplier " + s.getName() + " deactivated");
    }

    private void trimAndValidate(SupplierDtos.CreateSupplierRequest req) {
        checkLen("Phone",        req.phone,        15);
        checkLen("Alt Phone",    req.altPhone,     15);
        checkLen("GSTIN",        req.gstin,        15);
        checkLen("FSSAI Number", req.fssaiNumber,  20);
        checkLen("Bank IFSC",    req.bankIfsc,     15);
    }

    private void trimAndValidate(SupplierDtos.UpdateSupplierRequest req) {
        checkLen("Phone",        req.phone,        15);
        checkLen("Alt Phone",    req.altPhone,     15);
        checkLen("GSTIN",        req.gstin,        15);
        checkLen("FSSAI Number", req.fssaiNumber,  20);
        checkLen("Bank IFSC",    req.bankIfsc,     15);
    }

    private static void checkLen(String field, String value, int max) {
        if (value == null) return;
        String cleaned = trim(value);
        if (cleaned.length() > max)
            throw new BusinessException(field + " must be " + max + " characters or fewer (you entered " + cleaned.length() + ")", "VALUE_TOO_LONG");
    }

    private static String trim(String v) {
        if (v == null) return null;
        return v.replaceAll("^[\\s\\u00A0\\u200B\\uFEFF\\u200C\\u200D\\u202F\\u2060\\u00AD]+|[\\s\\u00A0\\u200B\\uFEFF\\u200C\\u200D\\u202F\\u2060\\u00AD]+$", "");
    }
    private static String upper(String v) { return v != null ? trim(v).toUpperCase() : null; }

    private Supplier find(UUID id, UUID tenantId) {
        return supplierRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier", id.toString()));
    }

    private SupplierDtos.SupplierResponse toResponse(Supplier s) {
        SupplierDtos.SupplierResponse r = new SupplierDtos.SupplierResponse();
        r.id = s.getId(); r.name = s.getName(); r.contactPerson = s.getContactPerson();
        r.phone = s.getPhone(); r.altPhone = s.getAltPhone(); r.email = s.getEmail();
        r.address = s.getAddress(); r.city = s.getCity(); r.state = s.getState();
        r.gstin = s.getGstin(); r.fssaiNumber = s.getFssaiNumber();
        r.bankName = s.getBankName(); r.bankAccount = s.getBankAccount(); r.bankIfsc = s.getBankIfsc();
        r.active = s.isActive(); r.createdAt = s.getCreatedAt();
        return r;
    }
}
