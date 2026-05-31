package com.stockez.api.module.imports;

import com.stockez.api.module.audit.service.AuditService;
import com.stockez.common.exception.BusinessException;
import com.stockez.api.module.customer.entity.Customer;
import com.stockez.api.module.customer.repository.CustomerRepository;
import com.stockez.api.module.order.entity.Order;
import com.stockez.api.module.order.repository.OrderRepository;
import com.stockez.api.module.product.entity.Product;
import com.stockez.api.module.product.entity.ProductMaster;
import com.stockez.api.module.product.repository.ProductMasterRepository;
import com.stockez.api.module.product.repository.ProductRepository;
import com.stockez.api.module.purchase.entity.StockBatch;
import com.stockez.api.module.purchase.repository.StockBatchRepository;
import com.stockez.api.module.route.entity.Route;
import com.stockez.api.module.route.entity.RoutePlace;
import com.stockez.api.module.route.repository.RoutePlaceRepository;
import com.stockez.api.module.route.repository.RouteRepository;
import com.stockez.api.module.supplier.entity.Supplier;
import com.stockez.api.module.supplier.repository.SupplierRepository;
import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.tenant.repository.TenantRepository;
import com.stockez.api.module.user.entity.User;
import com.stockez.api.module.user.repository.UserRepository;
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

    private final AuditService auditService;
    private final TenantRepository tenantRepository;
    private final ProductRepository productRepository;
    private final ProductMasterRepository productMasterRepository;
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
            "Product Name *", "HSN Code *", "Brand *", "Category *", "Sub Category *", "Unit *",
            "MRP *", "Purchase Rate (Incl. GST) *",
            "Min Sale Rate *", "Max Sale Rate *", "Sales GST % *", "Purchase GST % *",
            "Opening Stock", "Expiry Date (DD/MM/YYYY) *", "Mfg Date (DD/MM/YYYY)"
        };
        return buildTemplate("Products", headers, new int[]{1}); // col 1 = HSN Code (may have leading zeros)
    }

    public byte[] customerTemplate() throws IOException {
        String[] headers = {
            "Business Name *", "Owner Name *", "Phone *", "Address",
            "GSTIN", "Route Name *", "Stop Name *", "Credit Allowed (YES/NO)",
            "Credit Days", "Credit Limit (₹)", "Opening Balance (₹)"
        };
        return buildTemplate("Customers", headers, new int[]{2, 4}); // col 2 = Phone, col 4 = GSTIN
    }

    public byte[] supplierTemplate() throws IOException {
        String[] headers = {
            "Supplier Name *", "Phone *", "Contact Person *", "Alt Phone",
            "Email", "Address", "City", "State",
            "GSTIN", "FSSAI License No.", "Bank Name", "Account Number", "IFSC Code"
        };
        return buildTemplate("Suppliers", headers, new int[]{1, 3, 8, 11, 12}); // Phone, Alt Phone, GSTIN, Account Number, IFSC
    }

    private byte[] buildTemplate(String sheetName, String[] headers) throws IOException {
        return buildTemplate(sheetName, headers, new int[0]);
    }

    private byte[] buildTemplate(String sheetName, String[] headers, int[] textColumns) throws IOException {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            XSSFSheet sheet = wb.createSheet(sheetName);

            XSSFCellStyle headerStyle = wb.createCellStyle();
            XSSFFont headerFont = wb.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.DARK_TEAL.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            XSSFCellStyle textStyle = wb.createCellStyle();
            DataFormat fmt = wb.createDataFormat();
            textStyle.setDataFormat(fmt.getFormat("@"));

            Set<Integer> textColSet = new HashSet<>();
            for (int c : textColumns) textColSet.add(c);

            for (int c : textColumns) {
                sheet.setDefaultColumnStyle(c, textStyle);
            }

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
                sheet.setColumnWidth(i, 5500);
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
            validateHeaders(sheet, PRODUCT_HEADERS, "Products");
            int batchSeq = stockBatchRepository.countByTenantAndDate(tenantId, LocalDate.now());

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (isBlankRow(row)) continue;
                result.setTotalRows(result.getTotalRows() + 1);

                try {
                    List<String> rowErrors = new ArrayList<>();

                    String name = collect(str(row, 0), "Product Name", rowErrors);
                    if (name != null && !name.matches(".*[a-zA-Z].*")) {
                        rowErrors.add("Product Name must contain at least one letter (e.g. '//123' is not valid)");
                        name = null;
                    }
                    String hsnCode = collect(str(row, 1), "HSN Code", rowErrors);
                    if (hsnCode != null && !hsnCode.matches("[0-9]{2,8}")) {
                        rowErrors.add("HSN Code '" + hsnCode + "' is not valid — must be 2 to 8 digits (e.g. 1001, 02011100)");
                        hsnCode = null;
                    }
                    String brand       = collectMasterName(str(row, 2), "Brand", rowErrors);
                    String category    = collectMasterName(str(row, 3), "Category", rowErrors);
                    String subCategory = collectMasterName(str(row, 4), "Sub Category", rowErrors);
                    String unit        = collectMasterName(str(row, 5), "Unit", rowErrors);
                    BigDecimal mrp = collectDecimal(row, 6, "MRP", rowErrors);
                    if (mrp != null && mrp.compareTo(BigDecimal.ZERO) <= 0)
                        rowErrors.add("MRP must be greater than 0");
                    BigDecimal purchRate = collectDecimal(row, 7, "Purchase Rate", rowErrors);
                    if (purchRate != null && purchRate.compareTo(BigDecimal.ZERO) <= 0)
                        rowErrors.add("Purchase Rate must be greater than 0");
                    BigDecimal minRate = collectDecimal(row, 8, "Min Sale Rate", rowErrors);
                    if (minRate != null && minRate.compareTo(BigDecimal.ZERO) <= 0)
                        rowErrors.add("Min Sale Rate must be greater than 0");
                    BigDecimal maxRate = collectDecimal(row, 9, "Max Sale Rate", rowErrors);
                    if (maxRate != null && maxRate.compareTo(BigDecimal.ZERO) <= 0)
                        rowErrors.add("Max Sale Rate must be greater than 0");
                    if (minRate != null && maxRate != null && minRate.compareTo(maxRate) > 0) {
                        rowErrors.add("Min Sale Rate (" + minRate + ") cannot be greater than Max Sale Rate (" + maxRate + ")");
                    }
                    if (maxRate != null && mrp != null && maxRate.compareTo(mrp) > 0) {
                        rowErrors.add("Max Sale Rate (" + maxRate + ") cannot be greater than MRP (" + mrp + ")");
                    }
                    BigDecimal salesGst = collectDecimal(row, 10, "Sales GST %", rowErrors);
                    if (salesGst != null && (salesGst.compareTo(BigDecimal.ZERO) < 0 || salesGst.compareTo(BigDecimal.valueOf(100)) > 0))
                        rowErrors.add("Sales GST % must be between 0 and 100 (entered: " + salesGst + ")");
                    BigDecimal purchGst = collectDecimal(row, 11, "Purchase GST %", rowErrors);
                    if (purchGst != null && (purchGst.compareTo(BigDecimal.ZERO) < 0 || purchGst.compareTo(BigDecimal.valueOf(100)) > 0))
                        rowErrors.add("Purchase GST % must be between 0 and 100 (entered: " + purchGst + ")");
                    String openingStockRaw = str(row, 12);
                    Integer openingStock   = integer(row, 12);
                    if (openingStockRaw != null && openingStock == null) {
                        rowErrors.add("Opening Stock must be a whole number (e.g. 100)");
                    } else if (openingStock != null && openingStock < 0) {
                        rowErrors.add("Opening Stock cannot be negative");
                    }
                    String expiryRaw = str(row, 13);
                    LocalDate expiry = date(row, 13);
                    if (expiryRaw == null) rowErrors.add("Expiry Date is required");
                    else if (expiry == null) rowErrors.add("Expiry Date '" + expiryRaw + "' is invalid — use DD/MM/YYYY format");
                    String mfgDateRaw = str(row, 14);
                    LocalDate mfgDate = date(row, 14);
                    if (mfgDateRaw != null && mfgDate == null)
                        rowErrors.add("Mfg Date '" + mfgDateRaw + "' is invalid — use DD/MM/YYYY format");

                    if (!rowErrors.isEmpty()) {
                        result.setFailed(result.getFailed() + 1);
                        for (String err : rowErrors)
                            result.getErrors().add(new ImportResult.RowError(i + 1, err));
                        continue;
                    }

                    String canonBrand       = ensureMaster(tenantId, tenant, "BRAND", brand, null);
                    String canonCategory    = ensureMaster(tenantId, tenant, "CATEGORY", category, null);
                    String canonSubCategory = ensureMaster(tenantId, tenant, "SUB_CATEGORY", subCategory, canonCategory);
                    String canonUnit        = ensureMaster(tenantId, tenant, "UNIT", unit, null);
                    ensureTaxRate(tenantId, tenant, salesGst);
                    ensureTaxRate(tenantId, tenant, purchGst);

                    if (productRepository.existsByTenantIdAndNameIgnoreCaseAndActiveTrue(tenantId, name)) {
                        result.setSkipped(result.getSkipped() + 1);
                        result.getErrors().add(new ImportResult.RowError(i + 1, "Skipped — product '" + name + "' already exists"));
                        continue;
                    }

                    BigDecimal halfGst = salesGst.divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
                    Product product = Product.builder()
                            .tenant(tenant).name(name).hsnCode(hsnCode).brand(canonBrand)
                            .category(canonCategory).subCategory(canonSubCategory).unit(canonUnit)
                            .mrp(mrp).purchaseRate(purchRate)
                            .minSaleRate(minRate).maxSaleRate(maxRate)
                            .purchaseGstPercent(purchGst).salesGstPercent(salesGst)
                            .cgstPercent(halfGst).sgstPercent(halfGst)
                            .stockQuantity(openingStock != null ? openingStock : 0)
                            .expiryDate(expiry).mfgDate(mfgDate)
                            .build();
                    Product saved = productRepository.save(product);
                    auditService.record(tenantId, "PRODUCT", saved.getId(), "CREATED",
                            "Product " + saved.getName() + " imported via Excel");

                    if (openingStock != null && openingStock > 0) {
                        batchSeq++;
                        String batchNumber = String.format("OPN-%s-%03d", LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")), batchSeq);
                        StockBatch batch = StockBatch.builder()
                                .tenant(tenant).product(saved)
                                .batchNumber(batchNumber).mrp(mrp)
                                .purchaseRate(purchRate).minSaleRate(minRate).maxSaleRate(maxRate)
                                .expiryDate(expiry).mfgDate(mfgDate).quantityReceived(openingStock)
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
            validateHeaders(sheet, CUSTOMER_HEADERS, "Customers");

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (isBlankRow(row)) continue;
                result.setTotalRows(result.getTotalRows() + 1);

                List<String> rowErrors = new ArrayList<>();

                String businessName = collect(str(row, 0), "Business Name", rowErrors);
                if (businessName != null && !businessName.matches(".*[a-zA-Z].*")) {
                    rowErrors.add("Business Name must contain at least one letter (e.g. '//123' is not valid)");
                    businessName = null;
                }

                String ownerName = collect(str(row, 1), "Owner Name", rowErrors);
                if (ownerName != null && !ownerName.matches(".*[a-zA-Z].*")) {
                    rowErrors.add("Owner Name must contain at least one letter (e.g. '//123' is not valid)");
                    ownerName = null;
                }

                String rawPhone = collect(str(row, 2), "Phone", rowErrors);
                String phone = null;
                if (rawPhone != null) {
                    String digits = rawPhone.replaceAll("[^0-9]", "");
                    if (digits.length() != 10) {
                        rowErrors.add("Phone must be exactly 10 digits (entered: '" + rawPhone + "')");
                    } else {
                        phone = digits;
                    }
                }

                String address = str(row, 3);
                if (address != null && !address.matches(".*[a-zA-Z0-9].*")) {
                    rowErrors.add("Address must contain at least one letter or number");
                    address = null;
                }

                String gstin = str(row, 4);
                if (gstin != null && !gstin.matches("[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][0-9A-Za-z][Zz][0-9A-Za-z]")) {
                    rowErrors.add("GSTIN '" + gstin + "' is invalid — expected 15-character format (e.g. 29AADCB2230M1ZV)");
                }

                String routeName = collect(str(row, 5), "Route Name", rowErrors);
                if (routeName != null && !routeName.matches(".*[a-zA-Z].*")) {
                    rowErrors.add("Route Name must contain at least one letter (e.g. '//123' is not valid)");
                    routeName = null;
                }
                String stopName = collect(str(row, 6), "Stop Name", rowErrors);
                if (stopName != null && !stopName.matches(".*[a-zA-Z].*")) {
                    rowErrors.add("Stop Name must contain at least one letter (e.g. '//123' is not valid)");
                    stopName = null;
                }

                String creditAllowedRaw = str(row, 7);
                boolean creditAllowed = "YES".equalsIgnoreCase(creditAllowedRaw);
                if (creditAllowedRaw != null && !creditAllowedRaw.equalsIgnoreCase("YES") && !creditAllowedRaw.equalsIgnoreCase("NO")) {
                    rowErrors.add("Credit Allowed must be YES or NO (entered: '" + creditAllowedRaw + "')");
                }

                String creditDaysRaw  = str(row, 8);
                Integer creditDays    = integer(row, 8);
                String creditLimitRaw = str(row, 9);
                BigDecimal creditLimit = decimal(row, 9);

                String openingBalanceRaw = str(row, 10);
                BigDecimal openingBalance = decimal(row, 10);
                if (openingBalanceRaw != null && openingBalance == null) {
                    rowErrors.add("Opening Balance must be a valid number (entered: '" + openingBalanceRaw + "')");
                } else if (openingBalance != null && openingBalance.compareTo(BigDecimal.ZERO) < 0) {
                    rowErrors.add("Opening Balance cannot be negative");
                }

                if (creditAllowed) {
                    if (creditDaysRaw == null)   rowErrors.add("Credit Days is required when Credit Allowed is YES");
                    else if (creditDays == null)  rowErrors.add("Credit Days must be a whole number (e.g. 30)");
                    else if (creditDays < 0)      rowErrors.add("Credit Days cannot be negative");

                    if (creditLimitRaw == null)      rowErrors.add("Credit Limit is required when Credit Allowed is YES");
                    else if (creditLimit == null)     rowErrors.add("Credit Limit must be a valid number (e.g. 50000)");
                    else if (creditLimit.compareTo(BigDecimal.ZERO) < 0) rowErrors.add("Credit Limit cannot be negative");
                }

                if (!rowErrors.isEmpty()) {
                    result.setFailed(result.getFailed() + 1);
                    for (String err : rowErrors)
                        result.getErrors().add(new ImportResult.RowError(i + 1, err));
                    continue;
                }

                Route route = routeCache.get(routeName.toLowerCase());
                if (route == null) {
                    final String rName = routeName;
                    route = routeRepository.findByTenantIdAndNameIgnoreCaseAndActiveTrue(tenantId, rName)
                            .orElseGet(() -> routeRepository.save(Route.builder().tenant(tenant).name(rName).build()));
                    routeCache.put(routeName.toLowerCase(), route);
                }

                final Route finalRoute = route;
                String placeKey = route.getId() + ":" + stopName.toLowerCase();
                RoutePlace place = placeCache.get(placeKey);
                if (place == null) {
                    final String sName = stopName;
                    place = routePlaceRepository.findFirstByRouteIdAndNameIgnoreCaseAndActiveTrue(finalRoute.getId(), sName)
                            .orElseGet(() -> {
                                Integer maxSort = routePlaceRepository.findMaxSortOrderByRouteId(finalRoute.getId());
                                return routePlaceRepository.save(RoutePlace.builder()
                                        .route(finalRoute).name(sName).sortOrder((maxSort == null ? -1 : maxSort) + 1).build());
                            });
                    placeCache.put(placeKey, place);
                }

                if (customerRepository.existsByTenantIdAndPhoneAndActiveTrue(tenantId, phone)) {
                    result.setSkipped(result.getSkipped() + 1);
                    result.getErrors().add(new ImportResult.RowError(i + 1, "Skipped — customer with phone '" + phone + "' already exists"));
                    continue;
                }

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
                auditService.record(tenantId, "CUSTOMER", saved.getId(), "CREATED",
                        "Customer " + saved.getBusinessName() + " imported via Excel");

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
            validateHeaders(sheet, SUPPLIER_HEADERS, "Suppliers");

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (isBlankRow(row)) continue;
                result.setTotalRows(result.getTotalRows() + 1);

                List<String> rowErrors = new ArrayList<>();

                String name = collect(str(row, 0), "Supplier Name", rowErrors);
                if (name != null && !name.matches(".*[a-zA-Z].*")) {
                    rowErrors.add("Supplier Name must contain at least one letter (e.g. '//123' is not valid)");
                    name = null;
                }

                String rawPhone = collect(str(row, 1), "Phone", rowErrors);
                String phone = null;
                if (rawPhone != null) {
                    String digits = rawPhone.replaceAll("[^0-9]", "");
                    if (digits.length() != 10) {
                        rowErrors.add("Phone must be exactly 10 digits (entered: '" + rawPhone + "')");
                    } else {
                        phone = digits;
                    }
                }

                String contactPerson = collect(str(row, 2), "Contact Person", rowErrors);
                if (contactPerson != null && !contactPerson.matches(".*[a-zA-Z].*")) {
                    rowErrors.add("Contact Person must contain at least one letter (e.g. '//123' is not valid)");
                    contactPerson = null;
                }

                String rawAltPhone = str(row, 3);
                String altPhone = null;
                if (rawAltPhone != null) {
                    String digits = rawAltPhone.replaceAll("[^0-9]", "");
                    if (digits.length() != 10) {
                        rowErrors.add("Alt Phone must be exactly 10 digits (entered: '" + rawAltPhone + "')");
                    } else {
                        altPhone = digits;
                    }
                }

                String email = str(row, 4);
                if (email != null && !email.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")) {
                    rowErrors.add("Email '" + email + "' is not valid — expected format: name@domain.com");
                }

                String address = str(row, 5);
                if (address != null && !address.matches(".*[a-zA-Z0-9].*")) {
                    rowErrors.add("Address must contain at least one letter or number");
                    address = null;
                }

                String city = str(row, 6);
                if (city != null && !city.matches(".*[a-zA-Z].*")) {
                    rowErrors.add("City must contain at least one letter");
                    city = null;
                }

                String state = str(row, 7);
                if (state != null && !state.matches(".*[a-zA-Z].*")) {
                    rowErrors.add("State must contain at least one letter");
                    state = null;
                }

                String gstin = str(row, 8);
                if (gstin != null && !gstin.matches("[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][0-9A-Za-z][Zz][0-9A-Za-z]")) {
                    rowErrors.add("GSTIN '" + gstin + "' is invalid — expected 15-character format (e.g. 29AADCB2230M1ZV)");
                }

                String fssaiNumber = str(row, 9);
                if (fssaiNumber != null && !fssaiNumber.matches("[0-9]{14}")) {
                    rowErrors.add("FSSAI License No. '" + fssaiNumber + "' is not valid — must be exactly 14 digits (e.g. 10012345678901)");
                    fssaiNumber = null;
                }

                String bankName = str(row, 10);
                if (bankName != null && !bankName.matches(".*[a-zA-Z].*")) {
                    rowErrors.add("Bank Name must contain at least one letter (e.g. '//123' is not valid)");
                    bankName = null;
                }

                String bankAccount = str(row, 11);
                if (bankAccount != null && !bankAccount.matches("[0-9]{6,20}")) {
                    rowErrors.add("Account Number '" + bankAccount + "' is not valid — must be 6 to 20 digits");
                }

                String bankIfsc = str(row, 12);
                if (bankIfsc != null && !bankIfsc.matches("[A-Za-z]{4}[0][A-Za-z0-9]{6}")) {
                    rowErrors.add("IFSC Code '" + bankIfsc + "' is not valid — expected format: 4 letters + 0 + 6 alphanumeric (e.g. SBIN0001234)");
                }

                if (!rowErrors.isEmpty()) {
                    result.setFailed(result.getFailed() + 1);
                    for (String err : rowErrors)
                        result.getErrors().add(new ImportResult.RowError(i + 1, err));
                    continue;
                }

                if (supplierRepository.existsByTenantIdAndPhoneAndActiveTrue(tenantId, phone)) {
                    result.setSkipped(result.getSkipped() + 1);
                    result.getErrors().add(new ImportResult.RowError(i + 1, "Skipped — supplier with phone '" + phone + "' already exists"));
                    continue;
                }

                Supplier supplier = Supplier.builder()
                        .tenant(tenant).name(name).phone(phone).altPhone(altPhone)
                        .contactPerson(contactPerson).email(email).address(address)
                        .city(city).state(state).gstin(gstin).fssaiNumber(fssaiNumber)
                        .bankName(bankName).bankAccount(bankAccount).bankIfsc(bankIfsc)
                        .build();
                Supplier saved = supplierRepository.save(supplier);
                auditService.record(tenantId, "SUPPLIER", saved.getId(), "CREATED",
                        "Supplier " + saved.getName() + " imported via Excel");
                result.setImported(result.getImported() + 1);
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
            case STRING  -> cell.getStringCellValue();
            case NUMERIC -> {
                double d = cell.getNumericCellValue();
                yield d == Math.floor(d) ? String.valueOf((long) d) : String.valueOf(d);
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case FORMULA -> switch (cell.getCachedFormulaResultType()) {
                case STRING  -> cell.getStringCellValue();
                case NUMERIC -> {
                    double d = cell.getNumericCellValue();
                    yield d == Math.floor(d) ? String.valueOf((long) d) : String.valueOf(d);
                }
                default -> null;
            };
            default -> null;
        };
        if (val == null) return null;
        val = val.replaceAll("[\\s\\u00A0\\u200B\\uFEFF\\u200C\\u200D\\u202F\\u2060\\u00AD]+", " ").strip();
        return val.isEmpty() ? null : val;
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
        CellType effective = cell.getCellType() == CellType.FORMULA
                ? cell.getCachedFormulaResultType() : cell.getCellType();
        if (effective == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
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

    private String requiredMasterName(String value, String fieldName, int rowIndex) {
        String s = required(value, fieldName, rowIndex);
        if (!s.matches(".*[a-zA-Z].*"))
            throw new ImportValidationException("Row " + (rowIndex + 1) + ": " + fieldName + " '" + s + "' must contain at least one letter — special characters only are not allowed");
        return s;
    }

    private String collect(String value, String fieldName, List<String> errors) {
        if (value == null || value.isBlank()) { errors.add(fieldName + " is required"); return null; }
        return value;
    }

    private String collectMasterName(String value, String fieldName, List<String> errors) {
        String s = collect(value, fieldName, errors);
        if (s != null && !s.matches(".*[a-zA-Z].*")) {
            errors.add(fieldName + " '" + s + "' must contain at least one letter (e.g. '//123' is not valid)");
            return null;
        }
        return s;
    }

    private BigDecimal collectDecimal(Row row, int col, String fieldName, List<String> errors) {
        String raw = str(row, col);
        if (raw == null) { errors.add(fieldName + " is required"); return null; }
        BigDecimal val = decimal(row, col);
        if (val == null) { errors.add(fieldName + " must be a valid number (entered: '" + raw + "')"); return null; }
        return val;
    }

    private BigDecimal requiredDecimal(Row row, int col, String fieldName, int rowIndex) {
        BigDecimal val = decimal(row, col);
        if (val == null)
            throw new ImportValidationException("Row " + (rowIndex + 1) + ": " + fieldName + " is required and must be a number");
        return val;
    }

    private boolean isBlankRow(Row row) {
        if (row == null) return true;
        for (int c = 0; c < 20; c++) {
            if (str(row, c) != null) return false;
        }
        return true;
    }

    private String ensureMaster(UUID tenantId, Tenant tenant, String type, String name, String parentName) {
        Optional<ProductMaster> existing = parentName != null
                ? productMasterRepository.findFirstByTenantIdAndTypeAndNameIgnoreCaseAndParentNameIgnoreCaseAndActiveTrue(tenantId, type, name, parentName)
                : productMasterRepository.findFirstByTenantIdAndTypeAndNameIgnoreCaseAndActiveTrue(tenantId, type, name);
        return existing.map(ProductMaster::getName)
                .orElseGet(() -> productMasterRepository.save(ProductMaster.builder()
                        .tenant(tenant).type(type).name(name).parentName(parentName).build()).getName());
    }

    private void ensureTaxRate(UUID tenantId, Tenant tenant, BigDecimal rate) {
        int pct = rate.setScale(0, RoundingMode.HALF_UP).intValue();
        String name = pct + "%";
        if (!productMasterRepository.existsByTenantIdAndTypeAndNameIgnoreCaseAndActiveTrue(tenantId, "TAX_RATE", name)) {
            productMasterRepository.save(ProductMaster.builder()
                    .tenant(tenant).type("TAX_RATE").name(name).build());
        }
    }

    private static final String[] PRODUCT_HEADERS  = {
        "Product Name *", "HSN Code *", "Brand *", "Category *", "Sub Category *", "Unit *",
        "MRP *", "Purchase Rate (Incl. GST) *", "Min Sale Rate *", "Max Sale Rate *",
        "Sales GST % *", "Purchase GST % *", "Opening Stock",
        "Expiry Date (DD/MM/YYYY) *", "Mfg Date (DD/MM/YYYY)"
    };
    private static final String[] CUSTOMER_HEADERS = {
        "Business Name *", "Owner Name *", "Phone *", "Address",
        "GSTIN", "Route Name *", "Stop Name *", "Credit Allowed (YES/NO)",
        "Credit Days", "Credit Limit (₹)", "Opening Balance (₹)"
    };
    private static final String[] SUPPLIER_HEADERS = {
        "Supplier Name *", "Phone *", "Contact Person *", "Alt Phone",
        "Email", "Address", "City", "State",
        "GSTIN", "FSSAI License No.", "Bank Name", "Account Number", "IFSC Code"
    };

    private void validateHeaders(Sheet sheet, String[] expectedHeaders, String templateType) {
        Row headerRow = sheet.getRow(0);
        if (headerRow == null)
            throw new BusinessException("The uploaded file is empty — please use the " + templateType + " template", "WRONG_TEMPLATE");
        for (int i = 0; i < expectedHeaders.length; i++) {
            Cell cell = headerRow.getCell(i);
            String expected = normalizeHeader(expectedHeaders[i]);
            String actual   = cell != null ? normalizeHeader(cell.getStringCellValue()) : "";
            if (!expected.equalsIgnoreCase(actual)) {
                throw new BusinessException(
                    "Wrong file uploaded — expected the " + templateType + " template. " +
                    "Column " + (i + 1) + " should be \"" + expected + "\"" +
                    (actual.isEmpty() ? " but the column is missing" : " but got \"" + actual + "\"") +
                    ". Download the correct template and try again.",
                    "WRONG_TEMPLATE");
            }
        }
    }

    private String normalizeHeader(String s) {
        return s == null ? "" : s.replace(" *", "").replace("(₹)", "").trim();
    }

    static class ImportValidationException extends RuntimeException {
        ImportValidationException(String msg) { super(msg); }
    }
}
