package com.stockez.api.module.invoice;

import com.stockez.api.module.order.dto.OrderDtos;
import com.stockez.api.module.order.entity.Order;
import com.stockez.api.module.order.entity.OrderItem;
import com.stockez.api.module.order.repository.OrderRepository;
import com.stockez.api.module.product.entity.Product;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.common.exception.ResourceNotFoundException;
import com.stockez.common.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/public/invoice")
@RequiredArgsConstructor
public class PublicInvoiceController {

    private final OrderRepository orderRepository;
    private final InvoicePdfService invoicePdfService;

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<OrderDtos.PublicInvoiceResponse>> getInvoice(
            @PathVariable String id) {

        Order order = orderRepository.findByIdWithItems(parseId(id))
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", id));

        OrderDtos.PublicInvoiceResponse response = buildResponse(order);
        return ResponseEntity.ok(ApiResponse.success(response, "Invoice fetched"));
    }

    @GetMapping(value = "/{id}/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> downloadPdf(@PathVariable String id) throws IOException {
        Order order = orderRepository.findByIdWithItems(parseId(id))
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", id));

        byte[] bytes = invoicePdfService.generateBytes(buildResponse(order));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_PDF_VALUE)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + order.getOrderNumber() + ".pdf\"")
                .body(bytes);
    }

    private UUID parseId(String id) {
        try {
            return UUID.fromString(id);
        } catch (IllegalArgumentException e) {
            throw new ResourceNotFoundException("Invoice", id);
        }
    }

    private OrderDtos.PublicInvoiceResponse buildResponse(Order order) {
        OrderDtos.OrderResponse orderDto = toOrderResponse(order);
        OrderDtos.CompanyInfo company = toCompanyInfo(order.getTenant());

        OrderDtos.PublicInvoiceResponse response = new OrderDtos.PublicInvoiceResponse();
        response.setOrder(orderDto);
        response.setCompany(company);
        return response;
    }

    private OrderDtos.OrderResponse toOrderResponse(Order o) {
        OrderDtos.OrderResponse res = new OrderDtos.OrderResponse();
        res.setId(o.getId());
        res.setOrderNumber(o.getOrderNumber());
        res.setStatus(o.getStatus());
        res.setOrderDate(o.getOrderDate());
        res.setNotes(o.getNotes());
        res.setSubTotal(o.getSubTotal());
        res.setTotalGst(o.getTotalGst());
        res.setOverallDiscountType(o.getOverallDiscountType());
        res.setOverallDiscountValue(o.getOverallDiscountValue());
        res.setOverallDiscountAmount(o.getOverallDiscountAmount());
        res.setTotalAmount(o.getTotalAmount());
        res.setPaidAmount(o.getPaidAmount());
        res.setBalanceAmount(o.getBalanceAmount());
        res.setApprovedAt(o.getApprovedAt());
        res.setCreatedAt(o.getCreatedAt());

        if (o.getCustomer() != null) {
            OrderDtos.CustomerInfo ci = new OrderDtos.CustomerInfo();
            ci.setId(o.getCustomer().getId());
            ci.setBusinessName(o.getCustomer().getBusinessName());
            ci.setOwnerName(o.getCustomer().getOwnerName());
            ci.setPhone(o.getCustomer().getPhone());
            ci.setAddress(o.getCustomer().getAddress());
            ci.setCity(o.getCustomer().getCity());
            ci.setState(o.getCustomer().getState());
            ci.setPinCode(o.getCustomer().getPinCode());
            ci.setGstin(o.getCustomer().getGstin());
            if (o.getCustomer().getRoute() != null) {
                ci.setRouteName(o.getCustomer().getRoute().getName());
            }
            if (o.getCustomer().getRoutePlace() != null) {
                ci.setRoutePlaceName(o.getCustomer().getRoutePlace().getName());
            }
            res.setCustomer(ci);
        }

        if (o.getSalesPerson() != null) {
            OrderDtos.PersonInfo sp = new OrderDtos.PersonInfo();
            sp.setId(o.getSalesPerson().getId());
            sp.setFullName(o.getSalesPerson().getFullName());
            sp.setPhone(o.getSalesPerson().getPhone());
            res.setSalesPerson(sp);
        }

        if (o.getDeliveryPerson() != null) {
            OrderDtos.PersonInfo dp = new OrderDtos.PersonInfo();
            dp.setId(o.getDeliveryPerson().getId());
            dp.setFullName(o.getDeliveryPerson().getFullName());
            dp.setPhone(o.getDeliveryPerson().getPhone());
            res.setDeliveryPerson(dp);
        }

        List<OrderDtos.OrderItemResponse> items = o.getItems().stream().map(item -> {
            OrderDtos.OrderItemResponse ir = new OrderDtos.OrderItemResponse();
            ir.setId(item.getId());
            ir.setQuantity(item.getQuantity());
            ir.setMrp(item.getMrp());
            ir.setUnitPrice(item.getUnitPrice());
            ir.setDiscountPercent(item.getDiscountPercent());
            ir.setDiscountAmount(item.getDiscountAmount());
            ir.setGstPercent(item.getGstPercent());
            ir.setGstAmount(item.getGstAmount());
            ir.setLineTotal(item.getLineTotal());
            ir.setBatchNumber(item.getBatchNumber());
            ir.setBatchExpiryDate(item.getBatchExpiryDate());
            if (item.getProduct() != null) {
                Product p = item.getProduct();
                OrderDtos.ProductInfo pi = new OrderDtos.ProductInfo();
                pi.setId(p.getId());
                pi.setName(p.getName());
                pi.setBrand(p.getBrand());
                pi.setUnit(p.getUnit());
                pi.setImageUrl(p.getImageUrl());
                pi.setHsnCode(p.getHsnCode());
                ir.setProduct(pi);
            }
            return ir;
        }).collect(Collectors.toList());
        res.setItems(items);

        return res;
    }

    private OrderDtos.CompanyInfo toCompanyInfo(Tenant t) {
        OrderDtos.CompanyInfo info = new OrderDtos.CompanyInfo();
        info.setName(t.getName());
        info.setOwnerName(t.getOwnerName());
        info.setPhone(t.getPhone());
        info.setEmail(t.getEmail());
        info.setAddress(t.getAddress());
        info.setCity(t.getCity());
        info.setState(t.getState());
        info.setPinCode(t.getPinCode());
        info.setGstin(t.getGstin());
        info.setFssaiNumber(t.getFssaiNumber());
        info.setPanNumber(t.getPanNumber());
        info.setLogoUrl(t.getLogoUrl());
        info.setInvoiceTerms(t.getInvoiceTerms());
        info.setExtraImageUrl(t.getExtraImageUrl());
        info.setPaymentQrImageUrl(t.getPaymentQrImageUrl());
        info.setBankName(t.getBankName());
        info.setBankAccountName(t.getBankAccountName());
        info.setBankAccountNumber(t.getBankAccountNumber());
        info.setBankBranch(t.getBankBranch());
        info.setBankIfsc(t.getBankIfsc());
        info.setStateCode(t.getStateCode());
        info.setInvoiceFooterNote(t.getInvoiceFooterNote());
        return info;
    }
}
