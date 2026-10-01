package com.stockez.api.module.invoice;

import com.stockez.api.module.order.dto.OrderDtos;
import com.stockez.api.module.order.entity.Order;
import org.junit.jupiter.api.Test;

import java.io.FileOutputStream;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertTrue;

class InvoicePdfServiceSmokeTest {

    @Test
    void generatesNonEmptyPdfWithoutThrowing() throws Exception {
        InvoicePdfService service = new InvoicePdfService();

        OrderDtos.CompanyInfo company = new OrderDtos.CompanyInfo();
        company.setName("TEDDY AGENCY");
        company.setOwnerName("VENKATRAMAN BASKAR");
        company.setPhone("9787393570");
        company.setAddress("D.No.223/1A1A, THANJAVUR MAIN ROAD");
        company.setCity("Kumbakonam");
        company.setState("Tamil Nadu");
        company.setPinCode("612702");
        company.setGstin("33AVLPV0270B1ZT");
        company.setFssaiNumber("22425459000682");
        company.setPanNumber("AVLPV0270B");
        company.setInvoiceTerms("Goods once sold will not be taken back.\nSubject to Kumbakonam jurisdiction.");

        OrderDtos.CustomerInfo customer = new OrderDtos.CustomerInfo();
        customer.setBusinessName("VENKATESHWARA MEDICAL (VDM)");
        customer.setOwnerName("VENKATESHWARA MEDICAL (VDM)"); // duplicate on purpose — should be suppressed
        customer.setPhone("7904399878");
        customer.setAddress("Main Road");
        customer.setCity("Vadamattam");
        customer.setGstin(null);
        customer.setRouteName("VADAMATTAM");
        customer.setRoutePlaceName("VADAMATTAM"); // same as route on purpose — should be suppressed

        OrderDtos.PersonInfo salesPerson = new OrderDtos.PersonInfo();
        salesPerson.setFullName("RAVI SALESMEN-2");
        salesPerson.setPhone("7904968965");

        OrderDtos.ProductInfo product1 = new OrderDtos.ProductInfo();
        product1.setName("AMR MAHA STRONG 8ml");
        product1.setBrand("AMURTHANJAN");
        product1.setUnit("PCS");
        product1.setHsnCode("30049011");

        OrderDtos.OrderItemResponse item1 = new OrderDtos.OrderItemResponse();
        item1.setProduct(product1);
        item1.setQuantity(6);
        item1.setMrp(new BigDecimal("48.00"));
        item1.setUnitPrice(new BigDecimal("40.00"));
        item1.setDiscountAmount(BigDecimal.ZERO);
        item1.setGstPercent(new BigDecimal("5"));
        item1.setGstAmount(new BigDecimal("11.43"));
        item1.setLineTotal(new BigDecimal("240.00"));

        OrderDtos.ProductInfo product2 = new OrderDtos.ProductInfo();
        product2.setName("JIF DETERGENT LIQUID 1 LTR");
        product2.setBrand("JIF PHENYL");
        product2.setUnit("PCS");
        product2.setHsnCode("38089990");

        OrderDtos.OrderItemResponse item2 = new OrderDtos.OrderItemResponse();
        item2.setProduct(product2);
        item2.setQuantity(3);
        item2.setMrp(new BigDecimal("85.00"));
        item2.setUnitPrice(new BigDecimal("30.00"));
        item2.setDiscountAmount(BigDecimal.ZERO);
        item2.setGstPercent(new BigDecimal("18"));
        item2.setGstAmount(new BigDecimal("13.73"));
        item2.setLineTotal(new BigDecimal("90.00"));

        OrderDtos.OrderResponse order = new OrderDtos.OrderResponse();
        order.setOrderNumber("#ORD-2026-01037");
        order.setOrderDate(LocalDate.now());
        order.setStatus(Order.OrderStatus.DELIVERED);
        order.setCustomer(customer);
        order.setSalesPerson(salesPerson);
        order.setItems(List.of(item1, item2));
        order.setSubTotal(new BigDecimal("304.84"));
        order.setTotalGst(new BigDecimal("25.16"));
        order.setOverallDiscountType("PERCENT");
        order.setOverallDiscountValue(new BigDecimal("10"));
        order.setOverallDiscountAmount(new BigDecimal("36.67"));
        order.setTotalAmount(new BigDecimal("330.00"));
        order.setPaidAmount(BigDecimal.ZERO);
        order.setBalanceAmount(new BigDecimal("330.00"));
        order.setNotes("Handle with care");
        order.setCreatedAt(Instant.now());

        OrderDtos.PublicInvoiceResponse data = new OrderDtos.PublicInvoiceResponse();
        data.setOrder(order);
        data.setCompany(company);

        byte[] bytes = service.generateBytes(data);
        assertTrue(bytes.length > 1000, "Expected a real PDF, got " + bytes.length + " bytes");

        // Also write to disk so it can be visually inspected during this session.
        try (FileOutputStream fos = new FileOutputStream("target/smoke-invoice.pdf")) {
            fos.write(bytes);
        }
    }
}
