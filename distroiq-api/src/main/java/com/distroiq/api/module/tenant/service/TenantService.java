package com.distroiq.api.module.tenant.service;

import com.distroiq.api.module.tenant.dto.TenantDtos;
import com.distroiq.api.module.tenant.entity.Tenant;
import com.distroiq.api.module.tenant.repository.TenantRepository;
import com.distroiq.common.exception.BusinessException;
import com.distroiq.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class TenantService {

    private final TenantRepository tenantRepository;

    public TenantDtos.TenantResponse createTenant(TenantDtos.CreateTenantRequest req) {
        if (tenantRepository.existsBySubdomain(req.getSubdomain())) {
            throw new BusinessException("Subdomain is already taken", "SUBDOMAIN_EXISTS");
        }
        if (tenantRepository.existsByEmail(req.getEmail())) {
            throw new BusinessException("Email is already registered", "EMAIL_EXISTS");
        }

        Tenant tenant = Tenant.builder()
                .name(req.getName())
                .subdomain(req.getSubdomain())
                .schemaName("tenant_" + req.getSubdomain().replaceAll("-", "_"))
                .ownerName(req.getOwnerName())
                .phone(req.getPhone())
                .email(req.getEmail())
                .gstin(req.getGstin())
                .address(req.getAddress())
                .city(req.getCity())
                .state(req.getState())
                .status(Tenant.TenantStatus.ACTIVE)
                .build();

        return toResponse(tenantRepository.save(tenant));
    }

    @Transactional(readOnly = true)
    public Page<TenantDtos.TenantResponse> getAllTenants(Pageable pageable) {
        return tenantRepository.findAll(pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public TenantDtos.TenantResponse getTenantById(UUID id) {
        Tenant tenant = tenantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", id.toString()));
        return toResponse(tenant);
    }

    public TenantDtos.TenantResponse updateTenant(UUID id, TenantDtos.UpdateTenantRequest req) {
        Tenant tenant = tenantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", id.toString()));

        tenant.setName(req.getName());
        tenant.setOwnerName(req.getOwnerName());
        tenant.setPhone(req.getPhone());
        tenant.setEmail(req.getEmail());
        tenant.setGstin(req.getGstin());
        tenant.setAddress(req.getAddress());
        tenant.setCity(req.getCity());
        tenant.setState(req.getState());
        
        if (req.getStatus() != null) {
            tenant.setStatus(req.getStatus());
        }

        return toResponse(tenantRepository.save(tenant));
    }

    public TenantDtos.TenantResponse updateProfile(UUID tenantId, TenantDtos.CompanyProfileRequest req) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));
        tenant.setName(req.getName());
        tenant.setOwnerName(req.getOwnerName());
        tenant.setPhone(req.getPhone());
        tenant.setEmail(req.getEmail());
        tenant.setAddress(req.getAddress());
        tenant.setCity(req.getCity());
        tenant.setState(req.getState());
        tenant.setPinCode(req.getPinCode());
        tenant.setGstin(req.getGstin());
        tenant.setFssaiNumber(req.getFssaiNumber());
        tenant.setPanNumber(req.getPanNumber());
        if (req.getLogoUrl() != null) tenant.setLogoUrl(req.getLogoUrl());
        return toResponse(tenantRepository.save(tenant));
    }

    public void updateLogo(UUID id, String logoUrl) {
        Tenant tenant = tenantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", id.toString()));
        tenant.setLogoUrl(logoUrl);
        tenantRepository.save(tenant);
    }

    private TenantDtos.TenantResponse toResponse(Tenant t) {
        TenantDtos.TenantResponse res = new TenantDtos.TenantResponse();
        res.setId(t.getId());
        res.setName(t.getName());
        res.setSubdomain(t.getSubdomain());
        res.setOwnerName(t.getOwnerName());
        res.setPhone(t.getPhone());
        res.setEmail(t.getEmail());
        res.setGstin(t.getGstin());
        res.setFssaiNumber(t.getFssaiNumber());
        res.setPanNumber(t.getPanNumber());
        res.setAddress(t.getAddress());
        res.setCity(t.getCity());
        res.setState(t.getState());
        res.setPinCode(t.getPinCode());
        res.setStatus(t.getStatus());
        res.setLogoUrl(t.getLogoUrl());
        res.setCreatedAt(t.getCreatedAt());
        return res;
    }
}
