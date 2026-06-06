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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/public/invoice")
@RequiredArgsConstructor
public class PublicInvoiceController {

    private final OrderRepository orderRepository;
    private final InvoicePdfService invoicePdfService;

    @Value("${app.upload.base-url:http://localhost:8080}")
    private String baseUrl;

    @GetMapping("/{orderNumber}")
    public ResponseEntity<ApiResponse<OrderDtos.PublicInvoiceResponse>> getInvoice(
            @PathVariable String orderNumber) {

        Order order = orderRepository.findByOrderNumberWithItems(orderNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderNumber));

        OrderDtos.PublicInvoiceResponse response = buildResponse(order);
        return ResponseEntity.ok(ApiResponse.success(response, "Invoice fetched"));
    }

    @GetMapping("/{orderNumber}/pdf")
    public ResponseEntity<ApiResponse<OrderDtos.PublicInvoiceResponse>> getInvoicePdf(
            @PathVariable String orderNumber) throws IOException {

        Order order = orderRepository.findByOrderNumberWithItems(orderNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderNumber));

        OrderDtos.PublicInvoiceResponse response = buildResponse(order);
        String pdfUrl = invoicePdfService.generateAndStore(response);
        response.setPdfUrl(pdfUrl);

        return ResponseEntity.ok(ApiResponse.success(response, "PDF ready"));
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
        res.setTotalAmount(o.getTotalAmount());
        res.setPaidAmount(o.getPaidAmount());
        res.setBalanceAmount(o.getBalanceAmount());
        res.setApprovedAt(o.getApprovedAt());
        res.setCreatedAt(o.getCreatedAt());
        res.setWalkInName(o.getWalkInName());
        res.setWalkInPhone(o.getWalkInPhone());

        if (o.getCustomer() != null) {
            OrderDtos.CustomerInfo ci = new OrderDtos.CustomerInfo();
            ci.setId(o.getCustomer().getId());
            ci.setBusinessName(o.getCustomer().getBusinessName());
            ci.setOwnerName(o.getCustomer().getOwnerName());
            ci.setPhone(o.getCustomer().getPhone());
            ci.setAddress(o.getCustomer().getAddress());
            res.setCustomer(ci);
        }

        if (o.getSalesPerson() != null) {
            OrderDtos.PersonInfo sp = new OrderDtos.PersonInfo();
            sp.setId(o.getSalesPerson().getId());
            sp.setFullName(o.getSalesPerson().getFullName());
            sp.setPhone(o.getSalesPerson().getPhone());
            res.setSalesPerson(sp);
        }

        List<OrderDtos.OrderItemResponse> items = o.getItems().stream().map(item -> {
            OrderDtos.OrderItemResponse ir = new OrderDtos.OrderItemResponse();
            ir.setId(item.getId());
            ir.setQuantity(item.getQuantity());
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
        info.setLogoUrl(t.getLogoUrl());
        return info;
    }
}
