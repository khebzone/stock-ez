package com.stockez.api.module.route.service;

import com.stockez.api.module.customer.entity.Customer;
import com.stockez.api.module.customer.repository.CustomerRepository;
import com.stockez.api.module.route.entity.Route;
import com.stockez.api.module.route.entity.RoutePlace;
import com.stockez.api.module.route.repository.RoutePlaceRepository;
import com.stockez.api.module.route.repository.RouteRepository;
import com.stockez.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RouteExcelService {

    private static final String[] HEADERS = {
        "Stop No.", "Stop Name", "#", "Business Name", "Owner Name",
        "Phone", "Alt Phone", "Address", "GSTIN",
        "Credit", "Credit Days", "Credit Limit (₹)"
    };

    private final RouteRepository routeRepository;
    private final RoutePlaceRepository routePlaceRepository;
    private final CustomerRepository customerRepository;

    @Transactional(readOnly = true)
    public byte[] exportRoute(UUID routeId, UUID tenantId) throws IOException {
        Route route = routeRepository.findByIdAndTenantId(routeId, tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Route", routeId.toString()));

        List<RoutePlace> places = routePlaceRepository
                .findByRouteIdAndActiveTrueOrderBySortOrderAsc(routeId);

        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            String sheetName = sanitizeSheetName(route.getName());
            XSSFSheet sheet = wb.createSheet(sheetName);

            // Styles
            CellStyle titleStyle    = buildTitleStyle(wb);
            CellStyle headerStyle   = buildHeaderStyle(wb);
            CellStyle stopStyle     = buildStopStyle(wb);
            CellStyle dataStyle     = buildDataStyle(wb);
            CellStyle altDataStyle  = buildAltDataStyle(wb);
            CellStyle creditStyle   = buildCreditStyle(wb);

            int rowNum = 0;

            // Title row
            Row titleRow = sheet.createRow(rowNum++);
            titleRow.setHeightInPoints(22);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("Route: " + route.getName() + "   |   Generated: " + LocalDate.now());
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, HEADERS.length - 1));

            // Column header row
            Row headerRow = sheet.createRow(rowNum++);
            headerRow.setHeightInPoints(18);
            for (int i = 0; i < HEADERS.length; i++) {
                Cell c = headerRow.createCell(i);
                c.setCellValue(HEADERS[i]);
                c.setCellStyle(headerStyle);
            }

            sheet.createFreezePane(0, 2);

            // Data
            int altToggle = 0;
            for (int pi = 0; pi < places.size(); pi++) {
                RoutePlace place = places.get(pi);
                List<Customer> customers = customerRepository
                        .findByTenantIdAndRoutePlaceIdAndActiveTrueOrderByVisitOrderAsc(tenantId, place.getId());

                // Stop header row
                Row stopRow = sheet.createRow(rowNum++);
                stopRow.setHeightInPoints(20);
                Cell stopCell = stopRow.createCell(0);
                stopCell.setCellValue("Stop " + (pi + 1) + "   —   " + place.getName()
                        + "   (" + customers.size() + " customer" + (customers.size() != 1 ? "s" : "") + ")");
                stopCell.setCellStyle(stopStyle);
                sheet.addMergedRegion(new CellRangeAddress(rowNum - 1, rowNum - 1, 0, HEADERS.length - 1));

                altToggle = 0;
                for (int ci = 0; ci < customers.size(); ci++) {
                    Customer c = customers.get(ci);
                    CellStyle rowStyle = (altToggle++ % 2 == 0) ? dataStyle : altDataStyle;

                    Row row = sheet.createRow(rowNum++);
                    writeCell(row, 0,  String.valueOf(pi + 1),                              rowStyle);
                    writeCell(row, 1,  place.getName(),                                     rowStyle);
                    writeCell(row, 2,  String.valueOf(ci + 1),                              rowStyle);
                    writeCell(row, 3,  c.getBusinessName(),                                 rowStyle);
                    writeCell(row, 4,  c.getOwnerName(),                                    rowStyle);
                    writeCell(row, 5,  c.getPhone(),                                        rowStyle);
                    writeCell(row, 6,  nvl(c.getAltPhone()),                                rowStyle);
                    writeCell(row, 7,  nvl(c.getAddress()),                                 rowStyle);
                    writeCell(row, 8,  nvl(c.getGstin()),                                   rowStyle);
                    writeCell(row, 9,  c.isCreditAllowed() ? "Yes" : "No",                  c.isCreditAllowed() ? creditStyle : rowStyle);
                    writeNum (row, 10, c.isCreditAllowed() ? c.getCreditDays()    : null,   rowStyle);
                    writeNum (row, 11, c.isCreditAllowed() ? c.getCreditLimit()   : null,   rowStyle);
                }

                if (customers.isEmpty()) {
                    Row emptyRow = sheet.createRow(rowNum++);
                    Cell ec = emptyRow.createCell(0);
                    ec.setCellValue("   (no customers at this stop)");
                    ec.setCellStyle(buildEmptyHintStyle(wb));
                    sheet.addMergedRegion(new CellRangeAddress(rowNum - 1, rowNum - 1, 0, HEADERS.length - 1));
                }

                rowNum++; // blank spacer between stops
            }

            // Column widths
            int[] widths = { 2800, 5000, 1800, 8000, 5500, 3800, 3800, 9000, 5000, 2800, 3200, 4500 };
            for (int i = 0; i < widths.length; i++) sheet.setColumnWidth(i, widths[i]);

            // Summary footer
            int totalCustomers = places.stream()
                    .mapToInt(p -> customerRepository.findByTenantIdAndRoutePlaceIdAndActiveTrueOrderByVisitOrderAsc(tenantId, p.getId()).size())
                    .sum();
            Row footerRow = sheet.createRow(rowNum);
            Cell footerCell = footerRow.createCell(0);
            footerCell.setCellValue("Total: " + places.size() + " stop" + (places.size() != 1 ? "s" : "")
                    + "   |   " + totalCustomers + " customer" + (totalCustomers != 1 ? "s" : ""));
            footerCell.setCellStyle(buildFooterStyle(wb));
            sheet.addMergedRegion(new CellRangeAddress(rowNum, rowNum, 0, HEADERS.length - 1));

            wb.write(out);
            return out.toByteArray();
        }
    }

    @Transactional(readOnly = true)
    public byte[] exportAllRoutes(UUID tenantId) throws IOException {
        List<Route> routes = routeRepository.findByTenantIdAndActiveTrue(tenantId);

        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            if (routes.isEmpty()) {
                XSSFSheet sheet = wb.createSheet("No Routes");
                sheet.createRow(0).createCell(0).setCellValue("No active routes found.");
                wb.write(out);
                return out.toByteArray();
            }

            CellStyle titleStyle   = buildTitleStyle(wb);
            CellStyle headerStyle  = buildHeaderStyle(wb);
            CellStyle stopStyle    = buildStopStyle(wb);
            CellStyle dataStyle    = buildDataStyle(wb);
            CellStyle altDataStyle = buildAltDataStyle(wb);
            CellStyle creditStyle  = buildCreditStyle(wb);

            for (Route route : routes) {
                String sheetName = sanitizeSheetName(route.getName());
                XSSFSheet sheet = wb.createSheet(sheetName);

                List<RoutePlace> places = routePlaceRepository
                        .findByRouteIdAndActiveTrueOrderBySortOrderAsc(route.getId());

                int rowNum = 0;

                Row titleRow = sheet.createRow(rowNum++);
                titleRow.setHeightInPoints(22);
                Cell titleCell = titleRow.createCell(0);
                titleCell.setCellValue("Route: " + route.getName() + "   |   Generated: " + LocalDate.now());
                titleCell.setCellStyle(titleStyle);
                sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, HEADERS.length - 1));

                Row headerRow = sheet.createRow(rowNum++);
                headerRow.setHeightInPoints(18);
                for (int i = 0; i < HEADERS.length; i++) {
                    Cell c = headerRow.createCell(i);
                    c.setCellValue(HEADERS[i]);
                    c.setCellStyle(headerStyle);
                }
                sheet.createFreezePane(0, 2);

                for (int pi = 0; pi < places.size(); pi++) {
                    RoutePlace place = places.get(pi);
                    List<Customer> customers = customerRepository
                            .findByTenantIdAndRoutePlaceIdAndActiveTrueOrderByVisitOrderAsc(tenantId, place.getId());

                    Row stopRow = sheet.createRow(rowNum++);
                    stopRow.setHeightInPoints(20);
                    Cell stopCell = stopRow.createCell(0);
                    stopCell.setCellValue("Stop " + (pi + 1) + "   —   " + place.getName()
                            + "   (" + customers.size() + " customer" + (customers.size() != 1 ? "s" : "") + ")");
                    stopCell.setCellStyle(stopStyle);
                    sheet.addMergedRegion(new CellRangeAddress(rowNum - 1, rowNum - 1, 0, HEADERS.length - 1));

                    int altToggle = 0;
                    for (int ci = 0; ci < customers.size(); ci++) {
                        Customer c = customers.get(ci);
                        CellStyle rowStyle = (altToggle++ % 2 == 0) ? dataStyle : altDataStyle;
                        Row row = sheet.createRow(rowNum++);
                        writeCell(row, 0,  String.valueOf(pi + 1),                       rowStyle);
                        writeCell(row, 1,  place.getName(),                              rowStyle);
                        writeCell(row, 2,  String.valueOf(ci + 1),                       rowStyle);
                        writeCell(row, 3,  c.getBusinessName(),                          rowStyle);
                        writeCell(row, 4,  c.getOwnerName(),                             rowStyle);
                        writeCell(row, 5,  c.getPhone(),                                 rowStyle);
                        writeCell(row, 6,  nvl(c.getAltPhone()),                         rowStyle);
                        writeCell(row, 7,  nvl(c.getAddress()),                          rowStyle);
                        writeCell(row, 8,  nvl(c.getGstin()),                            rowStyle);
                        writeCell(row, 9,  c.isCreditAllowed() ? "Yes" : "No",           c.isCreditAllowed() ? creditStyle : rowStyle);
                        writeNum (row, 10, c.isCreditAllowed() ? c.getCreditDays() : null, rowStyle);
                        writeNum (row, 11, c.isCreditAllowed() ? c.getCreditLimit() : null, rowStyle);
                    }

                    if (customers.isEmpty()) {
                        Row emptyRow = sheet.createRow(rowNum++);
                        Cell ec = emptyRow.createCell(0);
                        ec.setCellValue("   (no customers at this stop)");
                        ec.setCellStyle(buildEmptyHintStyle(wb));
                        sheet.addMergedRegion(new CellRangeAddress(rowNum - 1, rowNum - 1, 0, HEADERS.length - 1));
                    }

                    rowNum++;
                }

                int[] widths = { 2800, 5000, 1800, 8000, 5500, 3800, 3800, 9000, 5000, 2800, 3200, 4500 };
                for (int i = 0; i < widths.length; i++) sheet.setColumnWidth(i, widths[i]);
            }

            wb.write(out);
            return out.toByteArray();
        }
    }

    // ── Style helpers ─────────────────────────────────────────────────────────

    private CellStyle buildTitleStyle(XSSFWorkbook wb) {
        XSSFCellStyle s = wb.createCellStyle();
        XSSFFont f = wb.createFont();
        f.setBold(true); f.setFontHeightInPoints((short) 12);
        f.setColor(new XSSFColor(new byte[]{(byte) 15, (byte) 23, (byte) 42}, null));
        s.setFont(f);
        s.setFillForegroundColor(new XSSFColor(new byte[]{(byte) 236, (byte) 253, (byte) 245}, null));
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        s.setVerticalAlignment(VerticalAlignment.CENTER);
        s.setBorderBottom(BorderStyle.MEDIUM);
        s.setBottomBorderColor(new XSSFColor(new byte[]{(byte) 5, (byte) 150, (byte) 105}, null));
        return s;
    }

    private CellStyle buildHeaderStyle(XSSFWorkbook wb) {
        XSSFCellStyle s = wb.createCellStyle();
        XSSFFont f = wb.createFont();
        f.setBold(true); f.setFontHeightInPoints((short) 10);
        f.setColor(new XSSFColor(new byte[]{(byte) 255, (byte) 255, (byte) 255}, null));
        s.setFont(f);
        s.setFillForegroundColor(new XSSFColor(new byte[]{(byte) 5, (byte) 150, (byte) 105}, null));
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        s.setAlignment(HorizontalAlignment.LEFT);
        s.setVerticalAlignment(VerticalAlignment.CENTER);
        s.setBorderBottom(BorderStyle.THIN);
        s.setBottomBorderColor(new XSSFColor(new byte[]{(byte) 3, (byte) 105, (byte) 73}, null));
        return s;
    }

    private CellStyle buildStopStyle(XSSFWorkbook wb) {
        XSSFCellStyle s = wb.createCellStyle();
        XSSFFont f = wb.createFont();
        f.setBold(true); f.setFontHeightInPoints((short) 10);
        f.setColor(new XSSFColor(new byte[]{(byte) 6, (byte) 95, (byte) 70}, null));
        s.setFont(f);
        s.setFillForegroundColor(new XSSFColor(new byte[]{(byte) 209, (byte) 250, (byte) 229}, null));
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        s.setVerticalAlignment(VerticalAlignment.CENTER);
        s.setBorderTop(BorderStyle.THIN);
        s.setBorderBottom(BorderStyle.THIN);
        s.setTopBorderColor(new XSSFColor(new byte[]{(byte) 110, (byte) 231, (byte) 183}, null));
        s.setBottomBorderColor(new XSSFColor(new byte[]{(byte) 110, (byte) 231, (byte) 183}, null));
        return s;
    }

    private CellStyle buildDataStyle(XSSFWorkbook wb) {
        XSSFCellStyle s = wb.createCellStyle();
        XSSFFont f = wb.createFont(); f.setFontHeightInPoints((short) 10); s.setFont(f);
        s.setVerticalAlignment(VerticalAlignment.CENTER);
        s.setBorderBottom(BorderStyle.THIN);
        s.setBottomBorderColor(new XSSFColor(new byte[]{(byte) 226, (byte) 232, (byte) 240}, null));
        return s;
    }

    private CellStyle buildAltDataStyle(XSSFWorkbook wb) {
        XSSFCellStyle s = (XSSFCellStyle) buildDataStyle(wb);
        s.setFillForegroundColor(new XSSFColor(new byte[]{(byte) 248, (byte) 250, (byte) 252}, null));
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return s;
    }

    private CellStyle buildCreditStyle(XSSFWorkbook wb) {
        XSSFCellStyle s = (XSSFCellStyle) buildDataStyle(wb);
        XSSFFont f = wb.createFont();
        f.setBold(true); f.setFontHeightInPoints((short) 10);
        f.setColor(new XSSFColor(new byte[]{(byte) 5, (byte) 150, (byte) 105}, null));
        s.setFont(f);
        return s;
    }

    private CellStyle buildEmptyHintStyle(XSSFWorkbook wb) {
        XSSFCellStyle s = wb.createCellStyle();
        XSSFFont f = wb.createFont();
        f.setItalic(true); f.setFontHeightInPoints((short) 10);
        f.setColor(new XSSFColor(new byte[]{(byte) 148, (byte) 163, (byte) 184}, null));
        s.setFont(f);
        return s;
    }

    private CellStyle buildFooterStyle(XSSFWorkbook wb) {
        XSSFCellStyle s = wb.createCellStyle();
        XSSFFont f = wb.createFont();
        f.setBold(true); f.setFontHeightInPoints((short) 10);
        f.setColor(new XSSFColor(new byte[]{(byte) 100, (byte) 116, (byte) 139}, null));
        s.setFont(f);
        s.setFillForegroundColor(new XSSFColor(new byte[]{(byte) 248, (byte) 250, (byte) 252}, null));
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        s.setBorderTop(BorderStyle.MEDIUM);
        s.setTopBorderColor(new XSSFColor(new byte[]{(byte) 226, (byte) 232, (byte) 240}, null));
        s.setVerticalAlignment(VerticalAlignment.CENTER);
        return s;
    }

    // ── Cell writers ──────────────────────────────────────────────────────────

    private void writeCell(Row row, int col, String value, CellStyle style) {
        Cell cell = row.createCell(col);
        cell.setCellValue(value != null ? value : "");
        cell.setCellStyle(style);
    }

    private void writeNum(Row row, int col, Object value, CellStyle style) {
        Cell cell = row.createCell(col);
        if (value instanceof Integer i)         cell.setCellValue(i);
        else if (value instanceof java.math.BigDecimal bd) cell.setCellValue(bd.doubleValue());
        else cell.setCellValue("");
        cell.setCellStyle(style);
    }

    private String nvl(String s) { return s != null ? s : ""; }

    private String sanitizeSheetName(String name) {
        String clean = name.replaceAll("[\\[\\]\\*\\?:/\\\\]", " ").trim();
        return clean.length() > 31 ? clean.substring(0, 31) : clean;
    }
}
