package com.distroiq.api.module.imports;

import com.distroiq.api.module.customer.entity.Customer;
import com.distroiq.api.module.customer.repository.CustomerRepository;
import com.distroiq.api.module.order.entity.Order;
import com.distroiq.api.module.order.repository.OrderRepository;
import com.distroiq.api.module.product.entity.Product;
import com.distroiq.api.module.product.repository.ProductRepository;
import com.distroiq.api.module.purchase.entity.StockBatch;
import com.distroiq.api.module.purchase.repository.StockBatchRepository;
import com.distroiq.api.module.route.entity.Route;
import com.distroiq.api.module.route.entity.RoutePlace;
import com.distroiq.api.module.route.repository.RoutePlaceRepository;
import com.distroiq.api.module.route.repository.RouteRepository;
import com.distroiq.api.module.supplier.entity.Supplier;
import com.distroiq.api.module.supplier.repository.SupplierRepository;
import com.distroiq.api.module.tenant.entity.Tenant;
import com.distroiq.api.module.tenant.repository.TenantRepository;
import com.distroiq.api.module.user.entity.User;
import com.distroiq.api.module.user.repository.UserRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Year;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional
public class ImportService {

    private final TenantRepository tenantRepository;
    private final ProductRepository productRepository;
    private final CustomerRepository customerRepository;
    private final SupplierRepository supplierRepository;
    private final RouteRepository routeRepository;
    private final RoutePlaceRepository routePlaceRepository;
    private final StockBatchRepository stockBatchRepository;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;

    // ──────────────────────── Result ────────────────────────

    @Data
    public static class ImportResult {
        private int totalRows;
        private int imported;
        private int skipped;
        private int failed;
        private final List<RowError> errors = new ArrayList<>();

        @Data
        public static class RowError {
            private final int row;
            private final String message;
        }
    }

    // ──────────────────────── Templates ─────────────────────

    public byte[] productTemplate() throws IOException {
        String[] headers = {
            "Product Name *", "HSN Code", "Brand", "Category", "Unit",
            "MRP *", "Purchase Rate (Incl. GST) *", "Sales Rate *",
            "Min Sale Rate", "Max Sale Rate", "Sales GST % *", "Purchase GST %",
            "Opening Stock", "Expiry Date (DD/MM/YYYY)"
        };
        Object[] sample = {
            "Britannia Good Day", "1905", "Britannia", "Biscuits", "PCS",
            "30.00", "22.00", "26.00", "24.00", "29.00", "12", "12", "100", "31/12/2026"
        };
        return buildTemplate("Products", headers, sample);
    }

    public byte[] customerTemplate() throws IOException {
        String[] headers = {
            "Business Name *", "Owner Name *", "Phone *", "Address",
            "GSTIN", "Route Name *", "Credit Allowed (YES/NO)",
            "Credit Days", "Credit Limit (₹)", "Opening Balance (₹)"
        };
        Object[] sample = {
            "Sri Murugan Stores", "Rajan", "9876500001", "12 Main St, Chennai",
            "33AAAAA0000A1ZX", "Route A", "YES", "30", "50000", "12000"
        };
        return buildTemplate("Customers", headers, sample);
    }

    public byte[] supplierTemplate() throws IOException {
        String[] headers = {
            "Supplier Name *", "Phone *", "Contact Person", "Email",
            "Address", "GSTIN", "Bank Name", "Account Number", "IFSC Code"
        };
        Object[] sample = {
            "Example Supplier Ltd", "0000000001", "Contact Name", "contact@example.com",
            "123 Sample Street, Chennai", "", "SBI", "00000000001", "SBIN0001234"
        };
        return buildTemplate("Suppliers", headers, sample);
    }

    private byte[] buildTemplate(String sheetName, String[] headers, Object[] sampleRow) throws IOException {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            XSSFSheet sheet = wb.createSheet(sheetName);

            XSSFCellStyle headerStyle = wb.createCellStyle();
            XSSFFont headerFont = wb.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.DARK_TEAL.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            XSSFCellStyle sampleStyle = wb.createCellStyle();
            XSSFFont sampleFont = wb.createFont();
            sampleFont.setItalic(true);
            sampleFont.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
            sampleStyle.setFont(sampleFont);

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
                sheet.setColumnWidth(i, 5500);
            }

            Row sampleDataRow = sheet.createRow(1);
            for (int i = 0; i < sampleRow.length; i++) {
                Cell cell = sampleDataRow.createCell(i);
                cell.setCellValue(sampleRow[i].toString());
                cell.setCellStyle(sampleStyle);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        }
    }

    // ──────────────────────── Product Import ────────────────

    public ImportResult importProducts(MultipartFile file, UUID tenantId) throws IOException {
        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow();
        ImportResult result = new ImportResult();

        try (Workbook wb = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = wb.getSheetAt(0);
            int batchSeq = stockBatchRepository.countByTenantAndDate(tenantId, LocalDate.now());

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (isBlankRow(row)) continue;
                result.setTotalRows(result.getTotalRows() + 1);

                try {
                    String name = required(str(row, 0), "Product Name", i);
                    String hsnCode     = str(row, 1);
                    String brand       = str(row, 2);
                    String category    = str(row, 3);
                    String unit        = str(row, 4);
                    BigDecimal mrp     = requiredDecimal(row, 5, "MRP", i);
                    BigDecimal purchRate = requiredDecimal(row, 6, "Purchase Rate", i);
                    BigDecimal salesRate = requiredDecimal(row, 7, "Sales Rate", i);
                    BigDecimal minRate  = decimal(row, 8);
                    BigDecimal maxRate  = decimal(row, 9);
                    BigDecimal salesGst = requiredDecimal(row, 10, "Sales GST %", i);
                    BigDecimal purchGst = decimal(row, 11);
                    if (purchGst == null) purchGst = BigDecimal.ZERO;
                    Integer openingStock = integer(row, 12);
                    LocalDate expiry    = date(row, 13);

                    if (productRepository.existsByTenantIdAndNameIgnoreCaseAndActiveTrue(tenantId, name)) {
                        result.setSkipped(result.getSkipped() + 1);
                        result.getErrors().add(new ImportResult.RowError(i + 1, "Skipped — product '" + name + "' already exists"));
                        continue;
                    }

                    BigDecimal halfGst = salesGst.divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
                    Product product = Product.builder()
                            .tenant(tenant).name(name).hsnCode(hsnCode).brand(brand)
                            .category(category).unit(unit).mrp(mrp).purchaseRate(purchRate)
                            .salesRate1(salesRate).minSaleRate(minRate).maxSaleRate(maxRate)
                            .purchaseGstPercent(purchGst).salesGstPercent(salesGst)
                            .cgstPercent(halfGst).sgstPercent(halfGst)
                            .stockQuantity(openingStock != null ? openingStock : 0)
                            .expiryDate(expiry)
                            .build();
                    Product saved = productRepository.save(product);

                    if (openingStock != null && openingStock > 0) {
                        batchSeq++;
                        String batchNumber = String.format("OPN-%s-%03d", LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")), batchSeq);
                        StockBatch batch = StockBatch.builder()
                                .tenant(tenant).product(saved)
                                .batchNumber(batchNumber).mrp(mrp)
                                .purchaseRate(purchRate).minSaleRate(minRate).maxSaleRate(maxRate)
                                .expiryDate(expiry).quantityReceived(openingStock)
                                .quantityAvailable(openingStock).receivedDate(LocalDate.now())
                                .build();
                        stockBatchRepository.save(batch);
                    }

                    result.setImported(result.getImported() + 1);
                } catch (ImportValidationException e) {
                    result.setFailed(result.getFailed() + 1);
                    result.getErrors().add(new ImportResult.RowError(i + 1, e.getMessage()));
                }
            }
        }
        return result;
    }

    // ──────────────────────── Customer Import ───────────────

    public ImportResult importCustomers(MultipartFile file, UUID tenantId) throws IOException {
        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow();
        User adminUser = userRepository.findFirstByTenantIdAndRoleAndActiveTrue(tenantId, User.UserRole.ADMIN).orElseThrow();
        ImportResult result = new ImportResult();
        Map<String, Route> routeCache = new HashMap<>();
        Map<String, RoutePlace> placeCache = new HashMap<>();
        int orderSeq = orderRepository.findMaxOrderSequence(tenantId);

        try (Workbook wb = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = wb.getSheetAt(0);

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (isBlankRow(row)) continue;
                result.setTotalRows(result.getTotalRows() + 1);

                try {
                    String businessName  = required(str(row, 0), "Business Name", i);
                    String ownerName     = required(str(row, 1), "Owner Name", i);
                    String phone         = required(str(row, 2), "Phone", i);
                    String address       = str(row, 3);
                    String gstin         = str(row, 4);
                    String routeName     = required(str(row, 5), "Route Name", i);
                    boolean creditAllowed = "YES".equalsIgnoreCase(str(row, 6));
                    Integer creditDays   = integer(row, 7);
                    BigDecimal creditLimit = decimal(row, 8);
                    BigDecimal openingBalance = decimal(row, 9);

                    if (customerRepository.existsByTenantIdAndPhoneAndActiveTrue(tenantId, phone)) {
                        result.setSkipped(result.getSkipped() + 1);
                        result.getErrors().add(new ImportResult.RowError(i + 1, "Skipped — customer with phone '" + phone + "' already exists"));
                        continue;
                    }

                    final int rowNum = i;
                    Route route = routeCache.computeIfAbsent(routeName.toLowerCase(), k ->
                        routeRepository.findByTenantIdAndNameIgnoreCaseAndActiveTrue(tenantId, routeName)
                            .orElseThrow(() -> new ImportValidationException("Row " + (rowNum + 1) + ": Route '" + routeName + "' not found — create it first"))
                    );

                    String placeKey = route.getId() + ":General";
                    RoutePlace place = placeCache.computeIfAbsent(placeKey, k -> {
                        List<RoutePlace> places = routePlaceRepository.findByRouteIdAndActiveTrue(route.getId());
                        if (!places.isEmpty()) return places.get(0);
                        Integer maxSort = routePlaceRepository.findMaxSortOrderByRouteId(route.getId());
                        RoutePlace newPlace = RoutePlace.builder()
                                .route(route).name("General").sortOrder((maxSort == null ? -1 : maxSort) + 1).build();
                        return routePlaceRepository.save(newPlace);
                    });

                    Integer maxVisit = customerRepository.findMaxVisitOrderByPlaceId(place.getId());
                    Customer customer = Customer.builder()
                            .tenant(tenant).businessName(businessName).ownerName(ownerName)
                            .phone(phone).address(address).gstin(gstin).route(route)
                            .routePlace(place).visitOrder((maxVisit == null ? -1 : maxVisit) + 1)
                            .creditAllowed(creditAllowed)
                            .creditDays(creditAllowed && creditDays != null ? creditDays : 0)
                            .creditLimit(creditAllowed && creditLimit != null ? creditLimit : BigDecimal.ZERO)
                            .build();
                    Customer saved = customerRepository.save(customer);

                    if (openingBalance != null && openingBalance.compareTo(BigDecimal.ZERO) > 0) {
                        orderSeq++;
                        String orderNumber = String.format("OPN-%d-%05d", Year.now().getValue(), orderSeq);
                        Order openingOrder = Order.builder()
                                .tenant(tenant).orderNumber(orderNumber).customer(saved)
                                .salesPerson(adminUser).orderDate(LocalDate.now())
                                .status(Order.OrderStatus.DELIVERED)
                                .subTotal(openingBalance).totalGst(BigDecimal.ZERO)
                                .totalAmount(openingBalance).paidAmount(BigDecimal.ZERO)
                                .balanceAmount(openingBalance).deliveredAt(Instant.now())
                                .notes("Opening balance")
                                .build();
                        orderRepository.save(openingOrder);
                    }

                    result.setImported(result.getImported() + 1);
                } catch (ImportValidationException e) {
                    result.setFailed(result.getFailed() + 1);
                    result.getErrors().add(new ImportResult.RowError(i + 1, e.getMessage()));
                }
            }
        }
        return result;
    }

    // ──────────────────────── Supplier Import ───────────────

    public ImportResult importSuppliers(MultipartFile file, UUID tenantId) throws IOException {
        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow();
        ImportResult result = new ImportResult();

        try (Workbook wb = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = wb.getSheetAt(0);

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (isBlankRow(row)) continue;
                result.setTotalRows(result.getTotalRows() + 1);

                try {
                    String name          = required(str(row, 0), "Supplier Name", i);
                    String phone         = required(str(row, 1), "Phone", i);
                    String contactPerson = str(row, 2);
                    String email         = str(row, 3);
                    String address       = str(row, 4);
                    String gstin         = str(row, 5);
                    String bankName      = str(row, 6);
                    String bankAccount   = str(row, 7);
                    String bankIfsc      = str(row, 8);

                    if (supplierRepository.existsByTenantIdAndPhoneAndActiveTrue(tenantId, phone)) {
                        result.setSkipped(result.getSkipped() + 1);
                        result.getErrors().add(new ImportResult.RowError(i + 1, "Skipped — supplier with phone '" + phone + "' already exists"));
                        continue;
                    }

                    Supplier supplier = Supplier.builder()
                            .tenant(tenant).name(name).phone(phone)
                            .contactPerson(contactPerson).email(email).address(address)
                            .gstin(gstin).bankName(bankName).bankAccount(bankAccount)
                            .bankIfsc(bankIfsc)
                            .build();
                    supplierRepository.save(supplier);
                    result.setImported(result.getImported() + 1);
                } catch (ImportValidationException e) {
                    result.setFailed(result.getFailed() + 1);
                    result.getErrors().add(new ImportResult.RowError(i + 1, e.getMessage()));
                }
            }
        }
        return result;
    }

    // ──────────────────────── Cell helpers ──────────────────

    private String str(Row row, int col) {
        if (row == null) return null;
        Cell cell = row.getCell(col);
        if (cell == null) return null;
        String val = switch (cell.getCellType()) {
            case STRING  -> cell.getStringCellValue().trim();
            case NUMERIC -> {
                double d = cell.getNumericCellValue();
                yield d == Math.floor(d) ? String.valueOf((long) d) : String.valueOf(d);
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            default      -> null;
        };
        return (val == null || val.isBlank()) ? null : val;
    }

    private BigDecimal decimal(Row row, int col) {
        String s = str(row, col);
        if (s == null) return null;
        try { return new BigDecimal(s.replace(",", "")); } catch (NumberFormatException e) { return null; }
    }

    private Integer integer(Row row, int col) {
        String s = str(row, col);
        if (s == null) return null;
        try { return Integer.parseInt(s.replace(",", "")); } catch (NumberFormatException e) { return null; }
    }

    private LocalDate date(Row row, int col) {
        if (row == null) return null;
        Cell cell = row.getCell(col);
        if (cell == null) return null;
        if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            return cell.getLocalDateTimeCellValue().toLocalDate();
        }
        String s = str(row, col);
        if (s == null) return null;
        for (String fmt : new String[]{"dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "yyyy-MM-dd"}) {
            try { return LocalDate.parse(s, DateTimeFormatter.ofPattern(fmt)); } catch (DateTimeParseException ignored) {}
        }
        return null;
    }

    private String required(String value, String fieldName, int rowIndex) {
        if (value == null || value.isBlank())
            throw new ImportValidationException("Row " + (rowIndex + 1) + ": " + fieldName + " is required");
        return value;
    }

    private BigDecimal requiredDecimal(Row row, int col, String fieldName, int rowIndex) {
        BigDecimal val = decimal(row, col);
        if (val == null)
            throw new ImportValidationException("Row " + (rowIndex + 1) + ": " + fieldName + " is required and must be a number");
        return val;
    }

    private boolean isBlankRow(Row row) {
        if (row == null) return true;
        for (int c = row.getFirstCellNum(); c < row.getLastCellNum(); c++) {
            Cell cell = row.getCell(c);
            if (cell != null && cell.getCellType() != CellType.BLANK && str(row, c) != null) return false;
        }
        return true;
    }

    static class ImportValidationException extends RuntimeException {
        ImportValidationException(String msg) { super(msg); }
    }
}
