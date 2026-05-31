package com.stockez.api.module.product.service;

import com.stockez.api.module.product.dto.ProductMasterDtos;
import com.stockez.api.module.product.entity.ProductMaster;
import com.stockez.api.module.product.repository.ProductMasterRepository;
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
public class ProductMasterService {

    private final ProductMasterRepository masterRepository;
    private final TenantRepository tenantRepository;

    public ProductMasterDtos.MasterResponse create(ProductMasterDtos.CreateMasterRequest req, UUID tenantId) {
        String upperType = req.getType().toUpperCase();
        if (List.of("BRAND", "CATEGORY", "SUB_CATEGORY", "UNIT").contains(upperType)
                && !req.getName().matches(".*[a-zA-Z0-9].*")) {
            throw new BusinessException(
                "Name must contain at least one letter or number — special characters only are not allowed",
                "INVALID_NAME");
        }
        boolean duplicate = req.getParentName() != null
                ? masterRepository.existsByTenantIdAndTypeAndNameIgnoreCaseAndParentNameIgnoreCaseAndActiveTrue(tenantId, req.getType(), req.getName(), req.getParentName())
                : masterRepository.existsByTenantIdAndTypeAndNameIgnoreCaseAndActiveTrue(tenantId, req.getType(), req.getName());
        if (duplicate) {
            throw new BusinessException(req.getType().toLowerCase() + " '" + req.getName() + "' already exists.", "DUPLICATE_MASTER");
        }
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));

        ProductMaster master = ProductMaster.builder()
                .tenant(tenant)
                .type(req.getType().toUpperCase())
                .name(req.getName().trim())
                .value(req.getValue())
                .parentName(req.getParentName() != null ? req.getParentName().trim() : null)
                .sortOrder(req.getSortOrder() != null ? req.getSortOrder() : 0)
                .build();

        return toResponse(masterRepository.save(master));
    }

    @Transactional(readOnly = true)
    public List<ProductMasterDtos.MasterResponse> getByType(UUID tenantId, String type) {
        return masterRepository.findByTenantIdAndTypeAndActiveTrueOrderBySortOrderAscNameAsc(tenantId, type.toUpperCase())
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    public void delete(UUID id, UUID tenantId) {
        ProductMaster master = masterRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Master", id.toString()));
        master.setActive(false);
        masterRepository.save(master);
    }

    private ProductMasterDtos.MasterResponse toResponse(ProductMaster m) {
        ProductMasterDtos.MasterResponse r = new ProductMasterDtos.MasterResponse();
        r.setId(m.getId());
        r.setType(m.getType());
        r.setName(m.getName());
        r.setValue(m.getValue());
        r.setParentName(m.getParentName());
        r.setActive(m.isActive());
        r.setSortOrder(m.getSortOrder());
        r.setCreatedAt(m.getCreatedAt());
        return r;
    }
}
