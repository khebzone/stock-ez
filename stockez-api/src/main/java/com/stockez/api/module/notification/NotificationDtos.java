package com.stockez.api.module.notification;

import lombok.Data;

public class NotificationDtos {

    @Data
    public static class NotificationSummary {
        private long pendingInvoiceApprovals;
        private long pendingPicklists;
        private long deliveryReturns;
        private long pendingPaymentVerifications;
        private long pendingBankInstruments;
        private long nearExpiryBatches;
        private long pendingGoodsReturnVerification;
        private long pendingSupplierClaims;
    }
}
