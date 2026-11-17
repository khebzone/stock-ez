package com.stockez.api.module.goodsreturn;

import com.stockez.api.module.goodsreturn.dto.GoodsReturnDtos;
import com.stockez.api.module.goodsreturn.repository.GoodsReturnRepository;
import com.stockez.api.module.goodsreturn.service.GoodsReturnService;
import com.stockez.api.module.product.entity.Product;
import com.stockez.api.module.product.repository.ProductRepository;
import com.stockez.api.module.purchase.entity.StockBatch;
import com.stockez.api.module.purchase.repository.StockBatchRepository;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.tenant.repository.TenantRepository;
import com.stockez.api.module.user.entity.User;
import com.stockez.api.module.user.repository.UserRepository;
import com.stockez.common.exception.BusinessException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Runs the expiry-claim flow against a real Postgres, in a throwaway schema so the dev data in
 * the public schema is never written (public stays on the search path only so the pg_trgm
 * operator class resolves). Create the schema first and drop it afterwards:
 *   CREATE SCHEMA expiry_claim_test;
 *   DROP SCHEMA expiry_claim_test CASCADE;
 * Opt-in so a plain `mvnw test` never touches a database:
 *   .\mvnw.cmd test -Dtest=ExpiryClaimIntegrationTest -DexpiryClaimDbTest=true
 */
@EnabledIfSystemProperty(named = "expiryClaimDbTest", matches = "true")
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:postgresql://localhost:5432/stockez?currentSchema=" + ExpiryClaimIntegrationTest.SCHEMA + ",public",
        "spring.jpa.properties.hibernate.default_schema=" + ExpiryClaimIntegrationTest.SCHEMA,
        "spring.cache.type=simple",
})
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ExpiryClaimIntegrationTest {

    static final String SCHEMA = "expiry_claim_test";
    private static final String SUPPLIER = "Test Supplier Pvt Ltd";

    @Autowired JdbcTemplate jdbc;
    @Autowired GoodsReturnService service;
    @Autowired GoodsReturnRepository goodsReturnRepository;
    @Autowired StockBatchRepository batchRepository;
    @Autowired ProductRepository productRepository;
    @Autowired TenantRepository tenantRepository;
    @Autowired UserRepository userRepository;

    private Tenant tenant;
    private User user;
    private final AtomicInteger seq = new AtomicInteger();

    @BeforeAll
    void setUp() {
        String schema = jdbc.queryForObject("select current_schema()", String.class);
        assertEquals(SCHEMA, schema, "Test is not isolated — refusing to write anything");
        Integer tablesHere = jdbc.queryForObject(
                "select count(*) from information_schema.tables where table_schema = ? and table_name = 'stock_batches'",
                Integer.class, SCHEMA);
        assertEquals(1, tablesHere, "Migrations did not run in the test schema");

        tenant = tenantRepository.save(Tenant.builder()
                .name("Expiry Test Co").schemaName("tenant_expiry_test").subdomain("expiry-test")
                .ownerName("Tester").phone("9000000001").email("expiry-test@example.com").build());
        user = userRepository.save(User.builder()
                .tenant(tenant).fullName("Test Admin").phone("9000000002")
                .passwordHash("x").role(User.UserRole.ADMIN).build());
    }

    private StockBatch seedBatch(int qty, String rate, String gstPercent, LocalDate expiry) {
        int n = seq.incrementAndGet();
        Product product = productRepository.save(Product.builder()
                .tenant(tenant).name("Test Product " + n)
                .mrp(new BigDecimal("150.00")).purchaseRate(new BigDecimal(rate))
                .purchaseGstPercent(new BigDecimal(gstPercent)).salesGstPercent(new BigDecimal(gstPercent))
                .stockQuantity(qty).build());
        return batchRepository.save(StockBatch.builder()
                .tenant(tenant).product(product).batchNumber("BCH-TEST-" + String.format("%03d", n))
                .mrp(new BigDecimal("150.00")).purchaseRate(new BigDecimal(rate))
                .purchaseGstPercent(new BigDecimal(gstPercent))
                .minSaleRate(new BigDecimal("110.00")).maxSaleRate(new BigDecimal("150.00"))
                .expiryDate(expiry).quantityReceived(qty).quantityAvailable(qty)
                .receivedDate(LocalDate.now().minusMonths(6)).build());
    }

    private StockBatch expiredBatch(int qty, String rate) {
        return seedBatch(qty, rate, "12.00", LocalDate.now().minusDays(1));
    }

    private GoodsReturnDtos.CreateExpiryClaimRequest claimOf(Object... batchAndQty) {
        GoodsReturnDtos.CreateExpiryClaimRequest req = new GoodsReturnDtos.CreateExpiryClaimRequest();
        req.setSupplierName(SUPPLIER);
        req.setClaimDate(LocalDate.now());
        List<GoodsReturnDtos.ExpiryClaimLine> lines = new java.util.ArrayList<>();
        for (int i = 0; i < batchAndQty.length; i += 2) {
            GoodsReturnDtos.ExpiryClaimLine l = new GoodsReturnDtos.ExpiryClaimLine();
            l.setBatchId(((StockBatch) batchAndQty[i]).getId());
            l.setQuantity((Integer) batchAndQty[i + 1]);
            lines.add(l);
        }
        req.setItems(lines);
        return req;
    }

    private GoodsReturnDtos.GoodsReturnResponse file(Object... batchAndQty) {
        return service.createExpiryClaim(claimOf(batchAndQty), user.getId(), tenant.getId());
    }

    private GoodsReturnDtos.ProcessRefundRequest settle(String mode) {
        GoodsReturnDtos.ProcessRefundRequest r = new GoodsReturnDtos.ProcessRefundRequest();
        r.setSettlementMode(mode);
        r.setRefundDate(LocalDate.now());
        return r;
    }

    private GoodsReturnDtos.ProcessRefundRequest accept(String mode, UUID itemId, int qty) {
        GoodsReturnDtos.ProcessRefundRequest r = settle(mode);
        GoodsReturnDtos.AcceptedItem a = new GoodsReturnDtos.AcceptedItem();
        a.setItemId(itemId);
        a.setAcceptedQty(qty);
        r.setAcceptedItems(List.of(a));
        return r;
    }

    private BigDecimal openCredit() {
        return goodsReturnRepository.sumOpenSupplierCredit(tenant.getId(), SUPPLIER);
    }

    private static void assertMoney(String expected, BigDecimal actual) {
        assertNotNull(actual);
        assertEquals(0, new BigDecimal(expected).compareTo(actual), "expected " + expected + " but was " + actual);
    }

    private static String codeOf(BusinessException e) {
        return e.getErrorCode();
    }

    @Test
    @DisplayName("filing a claim takes the stock out of the batch and the product total, and leaves the payable alone")
    void filingRemovesStockAndLeavesPayable() {
        StockBatch batch = expiredBatch(10, "100.00");
        BigDecimal creditBefore = openCredit();

        GoodsReturnDtos.GoodsReturnResponse claim = file(batch, 4);

        assertTrue(claim.getReturnNumber().startsWith("ECL-" + LocalDate.now().getYear() + "-"));
        assertTrue(claim.isExpiryClaim());
        assertEquals("PENDING", claim.getRefundStatus());
        assertEquals("VERIFIED", claim.getWarehouseStatus());
        assertMoney("400.00", claim.getTotalAmount());
        assertEquals(1, claim.getItems().size());
        assertEquals(4, claim.getItems().get(0).getQuantity());
        assertEquals("Expired", claim.getItems().get(0).getReason());
        assertMoney("42.86", claim.getItems().get(0).getGstAmount());   // 400 × 12 / 112

        assertEquals(6, batchRepository.findById(batch.getId()).orElseThrow().getQuantityAvailable());
        assertEquals(6, productRepository.findById(batch.getProduct().getId()).orElseThrow().getStockQuantity());
        assertMoney(creditBefore.toPlainString(), openCredit());
    }

    @Test
    @DisplayName("claiming every unit closes the batch")
    void claimingAllUnitsClosesBatch() {
        StockBatch batch = expiredBatch(5, "80.00");
        file(batch, 5);
        StockBatch reloaded = batchRepository.findById(batch.getId()).orElseThrow();
        assertEquals(0, reloaded.getQuantityAvailable());
        assertFalse(reloaded.isActive());
    }

    @Test
    @DisplayName("claiming more than the batch holds is refused and nothing moves")
    void overClaimRefused() {
        StockBatch batch = expiredBatch(3, "100.00");
        BusinessException e = assertThrows(BusinessException.class, () -> file(batch, 4));
        assertEquals("RETURN_QTY_EXCEEDS_STOCK", codeOf(e));
        assertEquals(3, batchRepository.findById(batch.getId()).orElseThrow().getQuantityAvailable());
        assertEquals(3, productRepository.findById(batch.getProduct().getId()).orElseThrow().getStockQuantity());
    }

    @Test
    @DisplayName("an unknown batch is refused")
    void unknownBatchRefused() {
        GoodsReturnDtos.CreateExpiryClaimRequest req = claimOf(expiredBatch(1, "10.00"), 1);
        req.getItems().get(0).setBatchId(UUID.randomUUID());
        BusinessException e = assertThrows(BusinessException.class,
                () -> service.createExpiryClaim(req, user.getId(), tenant.getId()));
        assertEquals("BATCH_NOT_FOUND", codeOf(e));
    }

    @Test
    @DisplayName("two lines for the same batch are merged into one")
    void duplicateLinesMerged() {
        StockBatch batch = expiredBatch(10, "50.00");
        GoodsReturnDtos.GoodsReturnResponse claim = file(batch, 2, batch, 3);
        assertEquals(1, claim.getItems().size());
        assertEquals(5, claim.getItems().get(0).getQuantity());
        assertEquals(5, batchRepository.findById(batch.getId()).orElseThrow().getQuantityAvailable());
    }

    @Test
    @DisplayName("a near-expiry batch is labelled Near expiry, not Expired")
    void nearExpiryLabelled() {
        StockBatch batch = seedBatch(4, "60.00", "5.00", LocalDate.now().plusDays(10));
        assertEquals("Near expiry", file(batch, 2).getItems().get(0).getReason());
    }

    @Test
    @DisplayName("adjust against bill, fully accepted: payable drops by the claim, nothing written off")
    void adjustAgainstBillFull() {
        StockBatch batch = expiredBatch(10, "100.00");
        GoodsReturnDtos.GoodsReturnResponse claim = file(batch, 4);
        BigDecimal creditBefore = openCredit();

        GoodsReturnDtos.GoodsReturnResponse done = service.processRefund(
                claim.getId(), settle("ADJUST_AGAINST_BILL"), user.getId(), tenant.getId());

        assertEquals("PROCESSED", done.getRefundStatus());
        assertEquals("ADJUST_AGAINST_BILL", done.getSettlementMode());
        assertMoney("400.00", done.getRefundAmount());
        assertMoney("0.00", done.getWrittenOffAmount());
        assertTrue(done.isReducesPayable());
        assertMoney(creditBefore.add(new BigDecimal("400.00")).toPlainString(), openCredit());
    }

    @Test
    @DisplayName("partial acceptance: only accepted units count; the rest is written off")
    void partialAcceptance() {
        StockBatch batch = expiredBatch(10, "100.00");
        GoodsReturnDtos.GoodsReturnResponse claim = file(batch, 10);
        BigDecimal creditBefore = openCredit();

        GoodsReturnDtos.GoodsReturnResponse done = service.processRefund(
                claim.getId(), accept("ADJUST_AGAINST_BILL", claim.getItems().get(0).getId(), 6),
                user.getId(), tenant.getId());

        assertMoney("600.00", done.getRefundAmount());
        assertMoney("400.00", done.getWrittenOffAmount());
        assertEquals(6, done.getItems().get(0).getAcceptedQty());
        assertMoney(creditBefore.add(new BigDecimal("600.00")).toPlainString(), openCredit());
    }

    @Test
    @DisplayName("accepted amount below the accepted units' value: the shortfall is written off")
    void discountedSettlement() {
        StockBatch batch = expiredBatch(10, "100.00");
        GoodsReturnDtos.GoodsReturnResponse claim = file(batch, 10);
        GoodsReturnDtos.ProcessRefundRequest req = settle("ADJUST_AGAINST_BILL");
        req.setAcceptedAmount(new BigDecimal("900.00"));

        GoodsReturnDtos.GoodsReturnResponse done = service.processRefund(claim.getId(), req, user.getId(), tenant.getId());

        assertMoney("900.00", done.getRefundAmount());
        assertMoney("100.00", done.getWrittenOffAmount());
    }

    @Test
    @DisplayName("accepted amount above the accepted units' value is refused")
    void acceptedAmountTooHigh() {
        StockBatch batch = expiredBatch(10, "100.00");
        GoodsReturnDtos.GoodsReturnResponse claim = file(batch, 10);
        GoodsReturnDtos.ProcessRefundRequest req = settle("ADJUST_AGAINST_BILL");
        req.setAcceptedAmount(new BigDecimal("1000.01"));

        BusinessException e = assertThrows(BusinessException.class,
                () -> service.processRefund(claim.getId(), req, user.getId(), tenant.getId()));
        assertEquals("ACCEPTED_AMOUNT_TOO_HIGH", codeOf(e));
        assertEquals("PENDING", goodsReturnRepository.findById(claim.getId()).orElseThrow().getRefundStatus().name());
    }

    @Test
    @DisplayName("accepting more units than were claimed is refused")
    void acceptedQtyTooHigh() {
        StockBatch batch = expiredBatch(10, "100.00");
        GoodsReturnDtos.GoodsReturnResponse claim = file(batch, 4);
        BusinessException e = assertThrows(BusinessException.class, () -> service.processRefund(
                claim.getId(), accept("ADJUST_AGAINST_BILL", claim.getItems().get(0).getId(), 5),
                user.getId(), tenant.getId()));
        assertEquals("ACCEPTED_QTY_EXCEEDS_CLAIM", codeOf(e));
    }

    @Test
    @DisplayName("accepting zero units must be settled as Rejected instead")
    void zeroAcceptedRefused() {
        StockBatch batch = expiredBatch(10, "100.00");
        GoodsReturnDtos.GoodsReturnResponse claim = file(batch, 4);
        BusinessException e = assertThrows(BusinessException.class, () -> service.processRefund(
                claim.getId(), accept("ADJUST_AGAINST_BILL", claim.getItems().get(0).getId(), 0),
                user.getId(), tenant.getId()));
        assertEquals("NOTHING_ACCEPTED", codeOf(e));
    }

    @Test
    @DisplayName("rejected: the whole claim is written off and the payable is untouched")
    void rejectedWritesOffEverything() {
        StockBatch batch = expiredBatch(10, "100.00");
        GoodsReturnDtos.GoodsReturnResponse claim = file(batch, 4);
        BigDecimal creditBefore = openCredit();

        GoodsReturnDtos.GoodsReturnResponse done = service.processRefund(
                claim.getId(), settle("REJECTED"), user.getId(), tenant.getId());

        assertEquals("REJECTED", done.getSettlementMode());
        assertMoney("0.00", done.getRefundAmount());
        assertMoney("400.00", done.getWrittenOffAmount());
        assertFalse(done.isReducesPayable());
        assertMoney(creditBefore.toPlainString(), openCredit());
    }

    @Test
    @DisplayName("cash refund needs a payment mode, and does not reduce the payable")
    void cashRefund() {
        StockBatch batch = expiredBatch(10, "100.00");
        GoodsReturnDtos.GoodsReturnResponse claim = file(batch, 4);
        BigDecimal creditBefore = openCredit();

        BusinessException e = assertThrows(BusinessException.class, () -> service.processRefund(
                claim.getId(), settle("CASH_REFUND"), user.getId(), tenant.getId()));
        assertEquals("PAYMENT_MODE_REQUIRED", codeOf(e));

        GoodsReturnDtos.ProcessRefundRequest req = settle("CASH_REFUND");
        req.setPaymentMode("CASH");
        GoodsReturnDtos.GoodsReturnResponse done = service.processRefund(claim.getId(), req, user.getId(), tenant.getId());

        assertEquals("PROCESSED", done.getRefundStatus());
        assertEquals("CASH", done.getRefundMode());
        assertMoney("400.00", done.getRefundAmount());
        assertMoney(creditBefore.toPlainString(), openCredit());
    }

    @Test
    @DisplayName("goods replaced: accepted units come back as a fresh batch, once only")
    void goodsReplaced() {
        StockBatch batch = expiredBatch(10, "100.00");
        GoodsReturnDtos.GoodsReturnResponse claim = file(batch, 4);
        UUID productId = batch.getProduct().getId();
        assertEquals(6, productRepository.findById(productId).orElseThrow().getStockQuantity());

        GoodsReturnDtos.ProcessRefundRequest req = settle("GOODS_REPLACED");
        req.setReplacementExpiryDate(LocalDate.now().plusMonths(12));
        GoodsReturnDtos.GoodsReturnResponse done = service.processRefund(claim.getId(), req, user.getId(), tenant.getId());

        assertTrue(done.isReplacementRestocked());
        assertEquals(10, productRepository.findById(productId).orElseThrow().getStockQuantity());
        long batches = batchRepository.findAll().stream().filter(b -> b.getProduct().getId().equals(productId)).count();
        assertEquals(2, batches);
    }

    @Test
    @DisplayName("a settled claim cannot be settled again")
    void settleTwiceRefused() {
        StockBatch batch = expiredBatch(10, "100.00");
        GoodsReturnDtos.GoodsReturnResponse claim = file(batch, 2);
        service.processRefund(claim.getId(), settle("REJECTED"), user.getId(), tenant.getId());
        BusinessException e = assertThrows(BusinessException.class, () -> service.processRefund(
                claim.getId(), settle("ADJUST_AGAINST_BILL"), user.getId(), tenant.getId()));
        assertEquals("INVALID_REFUND_STATUS", codeOf(e));
    }

    @Test
    @DisplayName("an invalid settlement mode is refused")
    void invalidSettlementMode() {
        StockBatch batch = expiredBatch(10, "100.00");
        GoodsReturnDtos.GoodsReturnResponse claim = file(batch, 2);
        BusinessException e = assertThrows(BusinessException.class, () -> service.processRefund(
                claim.getId(), settle("SOMETHING_ELSE"), user.getId(), tenant.getId()));
        assertEquals("INVALID_SETTLEMENT_MODE", codeOf(e));
    }

    @Test
    @DisplayName("a settlement mode is required for a supplier claim")
    void settlementModeRequired() {
        StockBatch batch = expiredBatch(10, "100.00");
        GoodsReturnDtos.GoodsReturnResponse claim = file(batch, 2);
        BusinessException e = assertThrows(BusinessException.class, () -> service.processRefund(
                claim.getId(), settle(null), user.getId(), tenant.getId()));
        assertEquals("SETTLEMENT_MODE_REQUIRED", codeOf(e));
    }

    @Test
    @DisplayName("KNOWN GAP: a filed expiry claim cannot be cancelled, so the stock cannot be put back")
    void filedClaimCannotBeCancelled() {
        StockBatch batch = expiredBatch(10, "100.00");
        GoodsReturnDtos.GoodsReturnResponse claim = file(batch, 4);
        GoodsReturnDtos.CancelReturnRequest req = new GoodsReturnDtos.CancelReturnRequest();
        req.setReason("filed by mistake");
        BusinessException e = assertThrows(BusinessException.class,
                () -> service.cancelReturn(claim.getId(), req, user.getId(), tenant.getId()));
        assertEquals("RETURN_NOT_CANCELLABLE", codeOf(e));
        assertEquals(6, batchRepository.findById(batch.getId()).orElseThrow().getQuantityAvailable());
    }

    @Test
    @DisplayName("claimable list: expired batches with stock appear, claimed-out ones do not")
    void claimableList() {
        StockBatch live = expiredBatch(5, "100.00");
        StockBatch gone = expiredBatch(2, "100.00");
        file(gone, 2);

        var ids = service.getClaimableBatches(tenant.getId(), 0).stream()
                .map(GoodsReturnDtos.ClaimableBatch::getBatchId).toList();

        assertTrue(ids.contains(live.getId()));
        assertFalse(ids.contains(gone.getId()));
    }

    @Test
    @DisplayName("write-off report lists settled claims with a loss, by settlement date")
    void writeOffReport() {
        StockBatch batch = expiredBatch(10, "100.00");
        GoodsReturnDtos.GoodsReturnResponse claim = file(batch, 4);
        service.processRefund(claim.getId(), settle("REJECTED"), user.getId(), tenant.getId());

        var rows = service.getExpiryClaimWriteOffs(tenant.getId(), LocalDate.now().minusDays(1), LocalDate.now().plusDays(1));
        assertTrue(rows.stream().anyMatch(r -> r.getId().equals(claim.getId())));
    }
}
