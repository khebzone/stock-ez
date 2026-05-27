package com.stockez.api.module.supplier.service;

import com.stockez.api.module.supplier.dto.SupplierDtos;
import com.stockez.api.module.supplier.entity.Supplier;
import com.stockez.api.module.supplier.repository.SupplierRepository;
import com.stockez.api.module.tenant.entity.Tenant;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.*;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.*;

@Service
@RequiredArgsConstructor
public class SupplierExcelService {

    private static final String[] HEADERS = {
        "Name *", "Contact Person", "Phone *", "Alt Phone", "Email",
        "Address", "City", "State", "GSTIN", "FSSAI No.",
        "Bank Name", "Bank IFSC", "Account Number"
    };

    private final SupplierRepository supplierRepository;
    private final SupplierService supplierService;

    // ── Export ────────────────────────────────────────────────────────────────

    public byte[] exportSuppliers(UUID tenantId) throws IOException {
        List<Supplier> suppliers = supplierRepository
                .findByTenantIdAndActiveTrue(tenantId, Sort.by("name"));

        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            XSSFSheet sheet = wb.createSheet("Suppliers");

            CellStyle headerStyle = buildHeaderStyle(wb);
            CellStyle dataStyle   = buildDataStyle(wb);
            CellStyle altStyle    = buildAltDataStyle(wb);

            // Header row
            Row headerRow = sheet.createRow(0);
            headerRow.setHeightInPoints(20);
            for (int i = 0; i < HEADERS.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(HEADERS[i]);
                cell.setCellStyle(headerStyle);
            }

            // Data rows
            int rowNum = 1;
            for (Supplier s : suppliers) {
                Row row = sheet.createRow(rowNum);
                CellStyle style = (rowNum % 2 == 0) ? altStyle : dataStyle;
                writeCell(row, 0,  s.getName(),          style);
                writeCell(row, 1,  s.getContactPerson(), style);
                writeCell(row, 2,  s.getPhone(),         style);
                writeCell(row, 3,  s.getAltPhone(),      style);
                writeCell(row, 4,  s.getEmail(),         style);
                writeCell(row, 5,  s.getAddress(),       style);
                writeCell(row, 6,  s.getCity(),          style);
                writeCell(row, 7,  s.getState(),         style);
                writeCell(row, 8,  s.getGstin(),         style);
                writeCell(row, 9,  s.getFssaiNumber(),   style);
                writeCell(row, 10, s.getBankName(),      style);
                writeCell(row, 11, s.getBankIfsc(),      style);
                writeCell(row, 12, s.getBankAccount(),   style);
                rowNum++;
            }

            // Auto-size columns
            int[] widths = { 8000, 6000, 4000, 4000, 7000, 10000, 4000, 4000, 5500, 5500, 4000, 4000, 5000 };
            for (int i = 0; i < widths.length; i++) sheet.setColumnWidth(i, widths[i]);

            // Freeze header
            sheet.createFreezePane(0, 1);
            sheet.setAutoFilter(new CellRangeAddress(0, 0, 0, HEADERS.length - 1));

            wb.write(out);
            return out.toByteArray();
        }
    }

    // ── Template (empty sheet for import) ────────────────────────────────────

    public byte[] downloadTemplate() throws IOException {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            XSSFSheet sheet = wb.createSheet("Suppliers");

            CellStyle headerStyle = buildHeaderStyle(wb);
            CellStyle hintStyle   = buildHintStyle(wb);

            Row headerRow = sheet.createRow(0);
            headerRow.setHeightInPoints(20);
            for (int i = 0; i < HEADERS.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(HEADERS[i]);
                cell.setCellStyle(headerStyle);
            }

            // Sample row (phone starts with 00 — invalid, auto-skipped on import)
            Row sampleRow = sheet.createRow(1);
            String[] sample = {
                "Example Supplier Ltd", "Contact Name", "0000000001", "", "contact@example.com",
                "123 Sample Street", "Chennai", "Tamil Nadu", "33AAAAA0000A1Z5", "",
                "SBI", "SBIN0001234", "00000000001"
            };
            for (int i = 0; i < sample.length; i++) {
                Cell cell = sampleRow.createCell(i);
                cell.setCellValue(sample[i]);
                cell.setCellStyle(hintStyle);
            }

            int[] widths = { 8000, 6000, 4000, 4000, 7000, 10000, 4000, 4000, 5500, 5500, 4000, 4000, 5000 };
            for (int i = 0; i < widths.length; i++) sheet.setColumnWidth(i, widths[i]);
            sheet.createFreezePane(0, 1);

            wb.write(out);
            return out.toByteArray();
        }
    }

    // ── Import ────────────────────────────────────────────────────────────────

    @Transactional
    public SupplierDtos.ImportResult importSuppliers(MultipartFile file, UUID tenantId) throws IOException {
        int created = 0, skipped = 0;
        List<String> errors = new ArrayList<>();

        try (Workbook wb = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = wb.getSheetAt(0);
            int lastRow = sheet.getLastRowNum();

            // Detect column positions by reading the header row — handles extra/shifted columns
            int colName=0, colContact=1, colPhone=2, colAltPhone=3, colEmail=4,
                colAddress=5, colCity=6, colState=7, colGstin=8, colFssai=9,
                colBankName=10, colBankIfsc=11, colBankAccount=12;

            Row hdr = sheet.getRow(0);
            if (hdr != null) {
                for (int c = 0; c < hdr.getLastCellNum(); c++) {
                    String h = cellStr(hdr, c);
                    if (h == null) continue;
                    h = h.toLowerCase().replaceAll("[*\\s.]+", " ").strip();
                    switch (h) {
                        case "name"           -> colName        = c;
                        case "contact person" -> colContact     = c;
                        case "phone"          -> colPhone       = c;
                        case "alt phone"      -> colAltPhone    = c;
                        case "email"          -> colEmail       = c;
                        case "address"        -> colAddress     = c;
                        case "city"           -> colCity        = c;
                        case "state"          -> colState       = c;
                        case "gstin"          -> colGstin       = c;
                        case "fssai no"       -> colFssai       = c;
                        case "bank name"      -> colBankName    = c;
                        case "bank ifsc"      -> colBankIfsc    = c;
                        case "account number" -> colBankAccount = c;
                        default -> {}
                    }
                }
            }

            for (int i = 1; i <= lastRow; i++) {
                Row row = sheet.getRow(i);
                if (row == null || isBlankRow(row)) continue;

                String name  = cellStr(row, colName);
                String phone = cellStr(row, colPhone);

                if (name == null || name.isBlank()) {
                    errors.add("Row " + (i + 1) + ": Name is required");
                    skipped++;
                    continue;
                }
                if (name.equalsIgnoreCase("Example Supplier Ltd")) {
                    skipped++;
                    continue;
                }
                if (phone == null || phone.isBlank() || !phone.matches("\\d{10,15}") || phone.startsWith("00")) {
                    errors.add("Row " + (i + 1) + " (" + name + "): Phone is required and must be 10–15 digits");
                    skipped++;
                    continue;
                }
                if (supplierRepository.existsByTenantIdAndPhoneAndActiveTrue(tenantId, phone)) {
                    errors.add("Row " + (i + 1) + " (" + name + "): Phone " + phone + " already exists");
                    skipped++;
                    continue;
                }

                Tenant tenant = new Tenant(); tenant.setId(tenantId);
                Supplier s = Supplier.builder()
                        .tenant(tenant)
                        .name(limit(name, 200))
                        .contactPerson(limit(cellStr(row, colContact), 100))
                        .phone(phone)
                        .altPhone(limit(cellStr(row, colAltPhone), 15))
                        .email(limit(cellStr(row, colEmail), 100))
                        .address(limit(cellStr(row, colAddress), 500))
                        .city(limit(cellStr(row, colCity), 100))
                        .state(limit(cellStr(row, colState), 50))
                        .gstin(limit(upper(cellStr(row, colGstin)), 15))
                        .fssaiNumber(limit(cellStr(row, colFssai), 20))
                        .bankName(limit(cellStr(row, colBankName), 100))
                        .bankIfsc(limit(upper(cellStr(row, colBankIfsc)), 15))
                        .bankAccount(limit(cellStr(row, colBankAccount), 30))
                        .build();
                supplierRepository.save(s);
                created++;
            }
        }

        SupplierDtos.ImportResult result = new SupplierDtos.ImportResult();
        result.setCreated(created);
        result.setSkipped(skipped);
        result.setErrors(errors);
        return result;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void writeCell(Row row, int col, String value, CellStyle style) {
        Cell cell = row.createCell(col);
        cell.setCellValue(value != null ? value : "");
        cell.setCellStyle(style);
    }

    private String cellStr(Row row, int col) {
        Cell cell = row.getCell(col, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        if (cell == null) return null;
        String val = switch (cell.getCellType()) {
            case STRING  -> clean(cell.getStringCellValue());
            case NUMERIC -> String.valueOf((long) cell.getNumericCellValue());
            default -> null;
        };
        return (val == null || val.isBlank()) ? null : val;
    }

    private static String limit(String v, int max) {
        if (v == null) return null;
        return v.length() > max ? null : v;
    }

    private static String upper(String v) {
        return v != null ? v.toUpperCase() : null;
    }

    private static String clean(String v) {
        if (v == null) return null;
        return v.replaceAll("^[\\s\\u00A0\\u200B\\uFEFF\\u200C\\u200D\\u202F\\u2060\\u00AD]+|[\\s\\u00A0\\u200B\\uFEFF\\u200C\\u200D\\u202F\\u2060\\u00AD]+$", "");
    }

    private boolean isBlankRow(Row row) {
        for (int i = 0; i < HEADERS.length; i++) {
            if (cellStr(row, i) != null) return false;
        }
        return true;
    }

    private CellStyle buildHeaderStyle(XSSFWorkbook wb) {
        XSSFCellStyle style = wb.createCellStyle();
        XSSFFont font = wb.createFont();
        font.setBold(true); font.setColor(new XSSFColor(new byte[]{(byte) 255, (byte) 255, (byte) 255}, null));
        font.setFontHeightInPoints((short) 10);
        style.setFont(font);
        style.setFillForegroundColor(new XSSFColor(new byte[]{(byte) 5, (byte) 150, (byte) 105}, null));
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.LEFT);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBottomBorderColor(new XSSFColor(new byte[]{(byte) 3, (byte) 105, (byte) 73}, null));
        return style;
    }

    private CellStyle buildDataStyle(XSSFWorkbook wb) {
        XSSFCellStyle style = wb.createCellStyle();
        XSSFFont font = wb.createFont();
        font.setFontHeightInPoints((short) 10);
        style.setFont(font);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBottomBorderColor(new XSSFColor(new byte[]{(byte) 226, (byte) 232, (byte) 240}, null));
        return style;
    }

    private CellStyle buildAltDataStyle(XSSFWorkbook wb) {
        XSSFCellStyle style = (XSSFCellStyle) buildDataStyle(wb);
        style.setFillForegroundColor(new XSSFColor(new byte[]{(byte) 248, (byte) 250, (byte) 252}, null));
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }

    private CellStyle buildHintStyle(XSSFWorkbook wb) {
        XSSFCellStyle style = wb.createCellStyle();
        XSSFFont font = wb.createFont();
        font.setColor(new XSSFColor(new byte[]{(byte) 148, (byte) 163, (byte) 184}, null));
        font.setItalic(true);
        font.setFontHeightInPoints((short) 10);
        style.setFont(font);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        return style;
    }
}
