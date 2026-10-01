package com.stockez.api.module.notification;

import com.stockez.api.module.goodsreturn.repository.GoodsReturnRepository;
import com.stockez.api.module.order.entity.Order;
import com.stockez.api.module.order.repository.OrderRepository;
import com.stockez.api.module.order.repository.PaymentRepository;
import com.stockez.api.module.purchase.repository.StockBatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NotificationService {

    private final OrderRepository orderRepository;
    private final PaymentRepository paymentRepository;
    private final GoodsReturnRepository goodsReturnRepository;
    private final StockBatchRepository stockBatchRepository;

    public NotificationDtos.NotificationSummary getSummary(UUID tenantId) {
        NotificationDtos.NotificationSummary s = new NotificationDtos.NotificationSummary();
        s.setPendingInvoiceApprovals(orderRepository.countByTenantIdAndStatus(tenantId, Order.OrderStatus.SUBMITTED));
        s.setPendingPicklists(orderRepository.countByTenantIdAndStatusIn(tenantId,
                List.of(Order.OrderStatus.APPROVED, Order.OrderStatus.PACKING)));
        s.setDeliveryReturns(orderRepository.countByTenantIdAndStatus(tenantId, Order.OrderStatus.RETURN_TO_WAREHOUSE));
        s.setPendingPaymentVerifications(paymentRepository.countPendingVerifications(tenantId));
        s.setPendingBankInstruments(paymentRepository.countPendingInstruments(tenantId));
        s.setNearExpiryBatches(stockBatchRepository.countNearExpiryBatches(tenantId, LocalDate.now().plusDays(30)));
        s.setPendingGoodsReturnVerification(goodsReturnRepository.countPendingWarehouseVerification(tenantId));
        s.setPendingSupplierClaims(goodsReturnRepository.countPendingSupplierClaims(tenantId));
        return s;
    }
}
