package com.stockez.api.module.tenant.service;

import com.stockez.api.module.tenant.dto.TenantDtos;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.tenant.entity.TenantSettings;
import com.stockez.api.module.tenant.repository.TenantRepository;
import com.stockez.api.module.tenant.repository.TenantSettingsRepository;
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

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class TenantService {

    private final TenantRepository tenantRepository;
    private final TenantSettingsRepository tenantSettingsRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public TenantDtos.TenantResponse createTenant(TenantDtos.CreateTenantRequest req) {
        if (tenantRepository.existsBySubdomain(req.getSubdomain())) {
            throw new BusinessException("Subdomain is already taken", "SUBDOMAIN_EXISTS");
        }
        if (tenantRepository.existsByEmail(req.getEmail())) {
            throw new BusinessException("Email is already registered", "EMAIL_EXISTS");
        }

        Tenant.TenantStatus status = req.getStatus() != null ? req.getStatus() : Tenant.TenantStatus.TRIAL;
        Tenant.TenantPlan plan = req.getPlan() != null ? req.getPlan() : Tenant.TenantPlan.TRIAL;

        LocalDate planEndDate = req.getPlanEndDate();
        if (planEndDate == null && status == Tenant.TenantStatus.TRIAL) {
            int days = req.getTrialDays() > 0 ? req.getTrialDays() : 7;
            planEndDate = LocalDate.now().plusDays(days);
        }

        int maxUsers = maxUsersForPlan(plan);

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
                .plan(plan)
                .billingCycle(req.getBillingCycle() != null ? req.getBillingCycle() : "MONTHLY")
                .planEndDate(planEndDate)
                .maxUsers(maxUsers)
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
        stats.setReadOnly(tenantRepository.countByStatus(Tenant.TenantStatus.READ_ONLY));

        LocalDate today = LocalDate.now();
        LocalDate cutoff = today.plusDays(30);
        stats.setExpiringSoon(tenantRepository.countExpiringSoon(today, cutoff,
                List.of(Tenant.TenantStatus.ACTIVE, Tenant.TenantStatus.TRIAL)));

        long mrr = tenantRepository.findByStatus(Tenant.TenantStatus.ACTIVE).stream()
                .mapToLong(this::monthlyRevenue)
                .sum();
        stats.setMrr(mrr);

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

    public TenantDtos.TenantResponse setReadOnly(UUID id) {
        Tenant tenant = tenantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", id.toString()));
        tenant.setStatus(Tenant.TenantStatus.READ_ONLY);
        return toResponse(tenantRepository.save(tenant));
    }

    public TenantDtos.TenantResponse extendTrial(UUID id, int days) {
        Tenant tenant = tenantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", id.toString()));
        LocalDate base = tenant.getPlanEndDate() != null ? tenant.getPlanEndDate() : LocalDate.now();
        tenant.setPlanEndDate(base.plusDays(days));
        return toResponse(tenantRepository.save(tenant));
    }

    @Transactional(readOnly = true)
    public Page<TenantDtos.TenantResponse> getAllTenants(Pageable pageable) {
        return tenantRepository.findAll(pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public TenantDtos.TenantResponse getTenantById(UUID id) {
        return toResponse(tenantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", id.toString())));
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

        if (req.getStatus() != null) tenant.setStatus(req.getStatus());
        if (req.getPlan() != null) {
            tenant.setPlan(req.getPlan());
            tenant.setMaxUsers(maxUsersForPlan(req.getPlan()));
        }
        if (req.getBillingCycle() != null) tenant.setBillingCycle(req.getBillingCycle());
        if (req.getPlanEndDate() != null) tenant.setPlanEndDate(req.getPlanEndDate());
        if (req.getMaxUsers() != null && req.getMaxUsers() > 0) tenant.setMaxUsers(req.getMaxUsers());
        if (req.getNotes() != null) tenant.setNotes(req.getNotes());

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

    public TenantDtos.WorkflowSettingsResponse getSettings(UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));
        TenantSettings settings = tenantSettingsRepository.findByTenantId(tenantId)
                .orElseGet(() -> TenantSettings.builder().tenant(tenant).build());
        return toSettingsResponse(settings);
    }

    public TenantDtos.WorkflowSettingsResponse updateSettings(UUID tenantId, TenantDtos.WorkflowSettingsRequest req) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));
        TenantSettings settings = tenantSettingsRepository.findByTenantId(tenantId)
                .orElseGet(() -> TenantSettings.builder().tenant(tenant).build());
        settings.setInvoiceApprovalRequired(req.isInvoiceApprovalRequired());
        settings.setPicklistEnabled(req.isPicklistEnabled());
        settings.setGoodsReturnApprovalRequired(req.isGoodsReturnApprovalRequired());
        if (req.getCreditLimitEnforcement() != null) settings.setCreditLimitEnforcement(req.getCreditLimitEnforcement());
        settings.setMaxDiscountPercent(req.getMaxDiscountPercent());
        settings.setLockBillingAfterCheckout(req.isLockBillingAfterCheckout());
        settings.setSeparateDeliveryAllocation(req.isSeparateDeliveryAllocation());
        if (req.getDiscountType() != null) settings.setDiscountType(req.getDiscountType());
        return toSettingsResponse(tenantSettingsRepository.save(settings));
    }

    private int maxUsersForPlan(Tenant.TenantPlan plan) {
        if (plan == null) return 5;
        return switch (plan) {
            case ESSENTIALS -> 5;
            case PROFESSIONAL -> 15;
            case PREMIUM -> 999;
            default -> 5;
        };
    }

    private long monthlyRevenue(Tenant t) {
        if (t.getPlan() == null) return 0;
        boolean annual = "ANNUAL".equals(t.getBillingCycle());
        return switch (t.getPlan()) {
            case ESSENTIALS   -> annual ? 1250L : 1500L;
            case PROFESSIONAL -> annual ? 2083L : 2500L;
            case PREMIUM      -> annual ? 3333L : 4000L;
            default           -> 0L;
        };
    }

    private TenantDtos.WorkflowSettingsResponse toSettingsResponse(TenantSettings s) {
        TenantDtos.WorkflowSettingsResponse res = new TenantDtos.WorkflowSettingsResponse();
        res.setInvoiceApprovalRequired(s.isInvoiceApprovalRequired());
        res.setPicklistEnabled(s.isPicklistEnabled());
        res.setGoodsReturnApprovalRequired(s.isGoodsReturnApprovalRequired());
        res.setCreditLimitEnforcement(s.getCreditLimitEnforcement());
        res.setMaxDiscountPercent(s.getMaxDiscountPercent());
        res.setLockBillingAfterCheckout(s.isLockBillingAfterCheckout());
        res.setSeparateDeliveryAllocation(s.isSeparateDeliveryAllocation());
        res.setDiscountType(s.getDiscountType());
        return res;
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
        res.setPlan(t.getPlan());
        res.setBillingCycle(t.getBillingCycle());
        res.setPlanEndDate(t.getPlanEndDate());
        res.setMaxUsers(t.getMaxUsers());
        res.setNotes(t.getNotes());
        res.setLogoUrl(t.getLogoUrl());
        res.setTrialEndsAt(t.getTrialEndsAt());
        res.setCreatedAt(t.getCreatedAt());
        if (t.getPlanEndDate() != null) {
            res.setDaysUntilExpiry(ChronoUnit.DAYS.between(LocalDate.now(), t.getPlanEndDate()));
        }
        return res;
    }
}
