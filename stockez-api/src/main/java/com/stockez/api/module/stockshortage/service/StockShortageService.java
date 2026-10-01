package com.stockez.api.module.stockshortage.service;

import com.stockez.api.module.product.entity.Product;
import com.stockez.api.module.stockshortage.entity.StockShortage;
import com.stockez.api.module.stockshortage.repository.StockShortageRepository;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Records inventory that left the warehouse (via a Sales Return pickup or an
 * undelivered order) and never physically came back — a real, reportable loss,
 * as opposed to just a sentence in the audit log.
 */
@Service
@RequiredArgsConstructor
public class StockShortageService {

    private final StockShortageRepository stockShortageRepository;

    @Transactional
    public void record(
            Tenant tenant,
            Product product,
            String batchNumber,
            int quantityShort,
            BigDecimal unitRate,
            StockShortage.SourceType sourceType,
            String referenceNumber,
            UUID referenceId,
            UUID routeId,
            String routeName,
            User responsiblePerson,
            User verifiedBy,
            LocalDate shortageDate) {

        stockShortageRepository.save(StockShortage.builder()
                .tenant(tenant)
                .product(product)
                .batchNumber(batchNumber)
                .quantityShort(quantityShort)
                .unitRate(unitRate)
                .lossValue(unitRate.multiply(BigDecimal.valueOf(quantityShort)))
                .sourceType(sourceType)
                .referenceNumber(referenceNumber)
                .referenceId(referenceId)
                .routeId(routeId)
                .routeName(routeName)
                .responsiblePerson(responsiblePerson)
                .verifiedBy(verifiedBy)
                .shortageDate(shortageDate)
                .build());
    }
}
