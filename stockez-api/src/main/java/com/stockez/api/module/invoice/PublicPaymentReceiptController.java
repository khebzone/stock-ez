package com.stockez.api.module.invoice;

import com.stockez.api.module.order.dto.OrderDtos;
import com.stockez.api.module.order.entity.Payment;
import com.stockez.api.module.order.repository.PaymentRepository;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.UUID;

@RestController
@RequestMapping("/api/public/payment-receipt")
@RequiredArgsConstructor
public class PublicPaymentReceiptController {

    private final PaymentRepository paymentRepository;
    private final PaymentReceiptPdfService paymentReceiptPdfService;

    @GetMapping(value = "/{id}/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> downloadPdf(@PathVariable String id) throws IOException {
        Payment payment = paymentRepository.findByIdWithDetails(parseId(id))
                .orElseThrow(() -> new ResourceNotFoundException("Payment", id));

        byte[] bytes = paymentReceiptPdfService.generateBytes(buildResponse(payment));
        String filename = "Receipt-" + payment.getCollectionDate() + ".pdf";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_PDF_VALUE)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(bytes);
    }

    private UUID parseId(String id) {
        try {
            return UUID.fromString(id);
        } catch (IllegalArgumentException e) {
            throw new ResourceNotFoundException("Payment", id);
        }
    }

    private OrderDtos.PublicPaymentReceiptResponse buildResponse(Payment p) {
        OrderDtos.PublicPaymentReceiptResponse res = new OrderDtos.PublicPaymentReceiptResponse();
        res.setId(p.getId());
        res.setAmount(p.getAmount());
        res.setPaymentMode(p.getPaymentMode().name());
        res.setPaymentMethodName(p.getPaymentMethodName());
        res.setReferenceNumber(p.getReferenceNumber());
        res.setCollectionDate(p.getCollectionDate());
        res.setOrderNumber(p.getOrder() != null ? p.getOrder().getOrderNumber() : null);
        res.setCollectedByName(p.getCollectedBy() != null ? p.getCollectedBy().getFullName() : null);

        if (p.getCustomer() != null) {
            OrderDtos.CustomerInfo ci = new OrderDtos.CustomerInfo();
            ci.setId(p.getCustomer().getId());
            ci.setBusinessName(p.getCustomer().getBusinessName());
            ci.setOwnerName(p.getCustomer().getOwnerName());
            ci.setPhone(p.getCustomer().getPhone());
            ci.setAddress(p.getCustomer().getAddress());
            res.setCustomer(ci);
        }

        Tenant t = p.getTenant();
        OrderDtos.CompanyInfo company = new OrderDtos.CompanyInfo();
        company.setName(t.getName());
        company.setOwnerName(t.getOwnerName());
        company.setPhone(t.getPhone());
        company.setEmail(t.getEmail());
        company.setAddress(t.getAddress());
        company.setCity(t.getCity());
        company.setState(t.getState());
        company.setPinCode(t.getPinCode());
        company.setGstin(t.getGstin());
        company.setFssaiNumber(t.getFssaiNumber());
        company.setLogoUrl(t.getLogoUrl());
        res.setCompany(company);

        return res;
    }
}
