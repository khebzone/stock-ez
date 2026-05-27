package com.stockez.api.module.tenant.service;

import com.stockez.api.module.tenant.dto.TenantDtos;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.tenant.repository.TenantRepository;
import com.stockez.api.module.user.entity.User;
import com.stockez.api.module.user.repository.UserRepository;
import com.stockez.common.exception.BusinessException;
import com.stockez.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class TenantService {

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public TenantDtos.TenantResponse createTenant(TenantDtos.CreateTenantRequest req) {
        if (tenantRepository.existsBySubdomain(req.getSubdomain())) {
            throw new BusinessException("Subdomain is already taken", "SUBDOMAIN_EXISTS");
        }
        if (tenantRepository.existsByEmail(req.getEmail())) {
            throw new BusinessException("Email is already registered", "EMAIL_EXISTS");
        }

        Tenant.TenantStatus status = req.getStatus() != null ? req.getStatus() : Tenant.TenantStatus.ACTIVE;

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
                .status(status)
                .trialEndsAt(req.getTrialEndsAt())
                .build();

        Tenant saved = tenantRepository.save(tenant);

        User adminUser = User.builder()
                .tenant(saved)
                .fullName(req.getOwnerName())
                .phone(req.getAdminPhone())
                .email(req.getEmail())
                .passwordHash(passwordEncoder.encode(req.getAdminPassword()))
                .role(User.UserRole.ADMIN)
                .mustChangePassword(true)
                .build();
        userRepository.save(adminUser);

        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public TenantDtos.TenantStats getStats() {
        TenantDtos.TenantStats stats = new TenantDtos.TenantStats();
        stats.setTotal(tenantRepository.count());
        stats.setActive(tenantRepository.countByStatus(Tenant.TenantStatus.ACTIVE));
        stats.setTrial(tenantRepository.countByStatus(Tenant.TenantStatus.TRIAL));
        stats.setSuspended(tenantRepository.countByStatus(Tenant.TenantStatus.SUSPENDED));
        stats.setInactive(tenantRepository.countByStatus(Tenant.TenantStatus.INACTIVE));
        return stats;
    }

    public TenantDtos.TenantResponse suspendTenant(UUID id) {
        Tenant tenant = tenantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", id.toString()));
        tenant.setStatus(Tenant.TenantStatus.SUSPENDED);
        return toResponse(tenantRepository.save(tenant));
    }

    public TenantDtos.TenantResponse activateTenant(UUID id) {
        Tenant tenant = tenantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", id.toString()));
        tenant.setStatus(Tenant.TenantStatus.ACTIVE);
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
        if (req.getTrialEndsAt() != null) {
            tenant.setTrialEndsAt(req.getTrialEndsAt());
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
        res.setTrialEndsAt(t.getTrialEndsAt());
        res.setCreatedAt(t.getCreatedAt());
        return res;
    }
}
