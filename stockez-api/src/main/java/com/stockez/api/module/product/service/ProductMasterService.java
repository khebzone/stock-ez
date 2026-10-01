package com.stockez.api.module.product.service;

import com.stockez.api.module.product.dto.ProductMasterDtos;
import com.stockez.api.module.product.entity.ProductMaster;
import com.stockez.api.module.product.repository.ProductMasterRepository;
import com.stockez.api.module.product.repository.ProductRepository;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.tenant.repository.TenantRepository;
import com.stockez.api.config.CacheConfig;
import com.stockez.common.exception.BusinessException;
import com.stockez.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
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
    private final ProductRepository productRepository;
    private final TenantRepository tenantRepository;

    @CacheEvict(cacheNames = CacheConfig.MASTERS, allEntries = true)
    public ProductMasterDtos.MasterResponse create(ProductMasterDtos.CreateMasterRequest req, UUID tenantId) {
        String upperType = req.getType().toUpperCase();
        if (List.of("BRAND", "CATEGORY", "SUB_CATEGORY", "UNIT").contains(upperType)) {
            String n = req.getName();
            if (!n.matches(".*[a-zA-Z0-9].*")) {
                throw new BusinessException(
                    "Name must contain at least one letter or number — special characters only are not allowed",
                    "INVALID_NAME");
            }
            if (!n.matches("[a-zA-Z0-9\\s\\-\\.&'/,()]+")) {
                throw new BusinessException(
                    "Special characters like @, #, $, !, % are not allowed in names",
                    "INVALID_NAME");
            }
        }

        ProductMaster parent = null;
        if (req.getParentId() != null) {
            parent = masterRepository.findByIdAndTenantId(req.getParentId(), tenantId)
                    .orElseThrow(() -> new BusinessException("Parent category not found", "INVALID_PARENT"));
        }

        boolean duplicate = parent != null
                ? masterRepository.existsByTenantIdAndTypeAndNameAndParentId(tenantId, upperType, req.getName(), parent.getId())
                : masterRepository.existsByTenantIdAndTypeAndNameIgnoreCaseAndActiveTrue(tenantId, upperType, req.getName());
        if (duplicate) {
            throw new BusinessException(req.getType().toLowerCase() + " '" + req.getName() + "' already exists.", "DUPLICATE_MASTER");
        }

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId.toString()));

        ProductMaster master = ProductMaster.builder()
                .tenant(tenant)
                .type(upperType)
                .name(req.getName().trim())
                .value(req.getValue())
                .parentMaster(parent)
                .sortOrder(req.getSortOrder() != null ? req.getSortOrder() : 0)
                .build();

        return toResponse(masterRepository.save(master));
    }

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = CacheConfig.MASTERS, key = "#tenantId + ':' + #type.toUpperCase()")
    public List<ProductMasterDtos.MasterResponse> getByType(UUID tenantId, String type) {
        return masterRepository.findByTenantIdAndTypeAndActiveTrueOrderBySortOrderAscNameAsc(tenantId, type.toUpperCase())
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @CacheEvict(cacheNames = CacheConfig.MASTERS, allEntries = true)
    public void delete(UUID id, UUID tenantId) {
        ProductMaster master = masterRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Master", id.toString()));
        if (List.of("BRAND", "CATEGORY", "SUB_CATEGORY", "UNIT").contains(master.getType())) {
            long inUse = productRepository.countProductsUsingMaster(tenantId, id);
            if (inUse > 0) {
                throw new BusinessException(
                    "Cannot delete — " + inUse + " product" + (inUse > 1 ? "s" : "") + " use this " + master.getType().toLowerCase().replace("_", " "),
                    "MASTER_IN_USE");
            }
        }
        master.setActive(false);
        masterRepository.save(master);
    }

    private ProductMasterDtos.MasterResponse toResponse(ProductMaster m) {
        ProductMasterDtos.MasterResponse r = new ProductMasterDtos.MasterResponse();
        r.setId(m.getId());
        r.setType(m.getType());
        r.setName(m.getName());
        r.setValue(m.getValue());
        r.setParentId(m.getParentId());
        r.setParentName(m.getParentName()); // derived from FK join — always fresh
        r.setActive(m.isActive());
        r.setSortOrder(m.getSortOrder());
        r.setCreatedAt(m.getCreatedAt());
        return r;
    }
}
