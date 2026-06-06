package com.stockez.api.module.invoice;

import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import com.stockez.api.module.order.dto.OrderDtos;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.FileOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
@Slf4j
public class InvoicePdfService {

    @Value("${app.upload.dir:./uploads}")
    private String uploadDir;

    @Value("${app.upload.base-url:http://localhost:8080}")
    private String baseUrl;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy").withZone(ZoneId.systemDefault());

    public String generateAndStore(OrderDtos.PublicInvoiceResponse data) throws IOException {
        Path invoiceDir = Paths.get(uploadDir, "invoices");
        if (!Files.exists(invoiceDir)) Files.createDirectories(invoiceDir);

        String filename = data.getOrder().getOrderNumber() + ".pdf";
        Path filePath = invoiceDir.resolve(filename);

        if (Files.exists(filePath)) {
            return baseUrl + "/uploads/invoices/" + filename;
        }

        generatePdf(data, filePath);
        return baseUrl + "/uploads/invoices/" + filename;
    }

    private void generatePdf(OrderDtos.PublicInvoiceResponse data, Path filePath) throws IOException {
        OrderDtos.OrderResponse order = data.getOrder();
        OrderDtos.CompanyInfo company = data.getCompany();

        Document doc = new Document(PageSize.A4, 36, 36, 36, 36);
        try (FileOutputStream fos = new FileOutputStream(filePath.toFile())) {
            PdfWriter.getInstance(doc, fos);
            doc.open();

            Font titleFont = new Font(Font.HELVETICA, 18, Font.BOLD, new Color(30, 30, 30));
            Font sectionFont = new Font(Font.HELVETICA, 9, Font.BOLD, new Color(80, 80, 80));
            Font normalFont = new Font(Font.HELVETICA, 9, Font.NORMAL, new Color(50, 50, 50));
            Font boldFont = new Font(Font.HELVETICA, 9, Font.BOLD, new Color(30, 30, 30));
            Font headerFont = new Font(Font.HELVETICA, 8, Font.BOLD, Color.WHITE);
            Font totalFont = new Font(Font.HELVETICA, 10, Font.BOLD, new Color(30, 30, 30));

            // Header: Company name + Invoice label
            PdfPTable header = new PdfPTable(2);
            header.setWidthPercentage(100);
            header.setWidths(new float[]{65, 35});
            header.setSpacingAfter(12);

            PdfPCell companyCell = new PdfPCell();
            companyCell.setBorder(Rectangle.NO_BORDER);
            companyCell.addElement(new Phrase(company.getName(), titleFont));
            if (company.getGstin() != null && !company.getGstin().isBlank()) {
                companyCell.addElement(new Phrase("GSTIN: " + company.getGstin(), normalFont));
            }
            if (company.getPhone() != null) {
                companyCell.addElement(new Phrase("Ph: " + company.getPhone(), normalFont));
            }
            String addr = buildAddress(company.getAddress(), company.getCity(), company.getState(), company.getPinCode());
            if (!addr.isBlank()) companyCell.addElement(new Phrase(addr, normalFont));
            header.addCell(companyCell);

            PdfPCell invoiceLabelCell = new PdfPCell();
            invoiceLabelCell.setBorder(Rectangle.NO_BORDER);
            invoiceLabelCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
            invoiceLabelCell.addElement(new Phrase("TAX INVOICE", new Font(Font.HELVETICA, 14, Font.BOLD, new Color(30, 30, 30))));
            invoiceLabelCell.addElement(new Phrase(order.getOrderNumber(), boldFont));
            String orderDate = order.getOrderDate() != null ? order.getOrderDate().format(DateTimeFormatter.ofPattern("dd MMM yyyy")) : "";
            invoiceLabelCell.addElement(new Phrase("Date: " + orderDate, normalFont));
            invoiceLabelCell.addElement(new Phrase("Status: " + order.getStatus(), normalFont));
            header.addCell(invoiceLabelCell);
            doc.add(header);

            // Divider
            addLine(doc);

            // Bill To
            doc.add(new Paragraph("BILL TO", sectionFont));
            doc.add(Chunk.NEWLINE);
            if (order.getCustomer() != null) {
                OrderDtos.CustomerInfo cust = order.getCustomer();
                if (cust.getBusinessName() != null) doc.add(new Paragraph(cust.getBusinessName(), boldFont));
                if (cust.getOwnerName() != null) doc.add(new Paragraph(cust.getOwnerName(), normalFont));
                if (cust.getPhone() != null) doc.add(new Paragraph("Ph: " + cust.getPhone(), normalFont));
                if (cust.getAddress() != null) doc.add(new Paragraph(cust.getAddress(), normalFont));
            } else if (order.getWalkInName() != null) {
                doc.add(new Paragraph(order.getWalkInName(), boldFont));
                if (order.getWalkInPhone() != null) doc.add(new Paragraph("Ph: " + order.getWalkInPhone(), normalFont));
            }
            doc.add(Chunk.NEWLINE);
            addLine(doc);

            // Items table
            PdfPTable table = new PdfPTable(7);
            table.setWidthPercentage(100);
            table.setWidths(new float[]{5, 28, 8, 10, 10, 10, 12});
            table.setSpacingBefore(8);
            table.setSpacingAfter(8);

            Color headerBg = new Color(45, 55, 72);
            addTableHeader(table, "#", headerFont, headerBg, Element.ALIGN_CENTER);
            addTableHeader(table, "Product", headerFont, headerBg, Element.ALIGN_LEFT);
            addTableHeader(table, "Qty", headerFont, headerBg, Element.ALIGN_CENTER);
            addTableHeader(table, "Rate", headerFont, headerBg, Element.ALIGN_RIGHT);
            addTableHeader(table, "Disc %", headerFont, headerBg, Element.ALIGN_RIGHT);
            addTableHeader(table, "GST %", headerFont, headerBg, Element.ALIGN_RIGHT);
            addTableHeader(table, "Total", headerFont, headerBg, Element.ALIGN_RIGHT);

            int idx = 1;
            Color altBg = new Color(248, 249, 250);
            for (OrderDtos.OrderItemResponse item : order.getItems()) {
                Color rowBg = (idx % 2 == 0) ? altBg : Color.WHITE;
                String productName = item.getProduct() != null ? item.getProduct().getName() : "-";
                String unit = item.getProduct() != null ? item.getProduct().getUnit() : "";
                String brand = item.getProduct() != null && item.getProduct().getBrand() != null ? item.getProduct().getBrand() : "";

                addTableCell(table, String.valueOf(idx++), normalFont, rowBg, Element.ALIGN_CENTER);
                PdfPCell nameCell = new PdfPCell();
                nameCell.setBackgroundColor(rowBg);
                nameCell.setBorderColor(new Color(220, 220, 220));
                nameCell.setPadding(4);
                nameCell.addElement(new Phrase(productName, normalFont));
                if (!brand.isBlank()) nameCell.addElement(new Phrase(brand + (unit.isBlank() ? "" : " | " + unit), new Font(Font.HELVETICA, 7, Font.NORMAL, new Color(120, 120, 120))));
                table.addCell(nameCell);
                addTableCell(table, String.valueOf(item.getQuantity()), normalFont, rowBg, Element.ALIGN_CENTER);
                addTableCell(table, fmt(item.getUnitPrice()), normalFont, rowBg, Element.ALIGN_RIGHT);
                addTableCell(table, item.getDiscountPercent() != null ? item.getDiscountPercent().stripTrailingZeros().toPlainString() + "%" : "-", normalFont, rowBg, Element.ALIGN_RIGHT);
                addTableCell(table, item.getGstPercent() != null ? item.getGstPercent().stripTrailingZeros().toPlainString() + "%" : "-", normalFont, rowBg, Element.ALIGN_RIGHT);
                addTableCell(table, fmt(item.getLineTotal()), boldFont, rowBg, Element.ALIGN_RIGHT);
            }
            doc.add(table);

            addLine(doc);

            // Totals
            PdfPTable totals = new PdfPTable(2);
            totals.setWidthPercentage(45);
            totals.setHorizontalAlignment(Element.ALIGN_RIGHT);
            totals.setWidths(new float[]{55, 45});
            totals.setSpacingBefore(6);

            addTotalRow(totals, "Subtotal (excl. GST)", fmt(order.getSubTotal()), normalFont, boldFont);
            addTotalRow(totals, "GST", fmt(order.getTotalGst()), normalFont, boldFont);

            PdfPCell grandLabelCell = new PdfPCell(new Phrase("TOTAL", totalFont));
            grandLabelCell.setBorder(Rectangle.TOP);
            grandLabelCell.setPaddingTop(4);
            grandLabelCell.setBorderColor(new Color(180, 180, 180));
            PdfPCell grandValueCell = new PdfPCell(new Phrase(fmt(order.getTotalAmount()), totalFont));
            grandValueCell.setBorder(Rectangle.TOP);
            grandValueCell.setPaddingTop(4);
            grandValueCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
            grandValueCell.setBorderColor(new Color(180, 180, 180));
            totals.addCell(grandLabelCell);
            totals.addCell(grandValueCell);

            addTotalRow(totals, "Paid", fmt(order.getPaidAmount()), normalFont, boldFont);
            addTotalRow(totals, "Balance Due", fmt(order.getBalanceAmount()), normalFont, boldFont);
            doc.add(totals);

            // Footer
            doc.add(Chunk.NEWLINE);
            addLine(doc);
            Paragraph footer = new Paragraph("Thank you for your business.", new Font(Font.HELVETICA, 8, Font.ITALIC, new Color(120, 120, 120)));
            footer.setAlignment(Element.ALIGN_CENTER);
            doc.add(footer);

        } finally {
            if (doc.isOpen()) doc.close();
        }
    }

    private void addLine(Document doc) throws DocumentException {
        LineSeparator line = new LineSeparator();
        line.setLineColor(new Color(200, 200, 200));
        doc.add(new Chunk(line));
        doc.add(Chunk.NEWLINE);
    }

    private void addTableHeader(PdfPTable table, String text, Font font, Color bg, int align) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setBackgroundColor(bg);
        cell.setHorizontalAlignment(align);
        cell.setPadding(5);
        cell.setBorderColor(new Color(60, 70, 90));
        table.addCell(cell);
    }

    private void addTableCell(PdfPTable table, String text, Font font, Color bg, int align) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setBackgroundColor(bg);
        cell.setHorizontalAlignment(align);
        cell.setPadding(4);
        cell.setBorderColor(new Color(220, 220, 220));
        table.addCell(cell);
    }

    private void addTotalRow(PdfPTable table, String label, String value, Font labelFont, Font valueFont) {
        PdfPCell labelCell = new PdfPCell(new Phrase(label, labelFont));
        labelCell.setBorder(Rectangle.NO_BORDER);
        labelCell.setPadding(2);
        PdfPCell valueCell = new PdfPCell(new Phrase(value, valueFont));
        valueCell.setBorder(Rectangle.NO_BORDER);
        valueCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        valueCell.setPadding(2);
        table.addCell(labelCell);
        table.addCell(valueCell);
    }

    private String fmt(BigDecimal val) {
        if (val == null) return "₹0.00";
        return "₹" + String.format("%.2f", val);
    }

    private String buildAddress(String address, String city, String state, String pin) {
        StringBuilder sb = new StringBuilder();
        if (address != null && !address.isBlank()) sb.append(address);
        if (city != null && !city.isBlank()) { if (sb.length() > 0) sb.append(", "); sb.append(city); }
        if (state != null && !state.isBlank()) { if (sb.length() > 0) sb.append(", "); sb.append(state); }
        if (pin != null && !pin.isBlank()) { if (sb.length() > 0) sb.append(" - "); sb.append(pin); }
        return sb.toString();
    }

    @Scheduled(cron = "0 0 2 * * ?")
    public void cleanupOldInvoices() {
        Path invoiceDir = Paths.get(uploadDir, "invoices");
        if (!Files.exists(invoiceDir)) return;

        Instant cutoff = Instant.now().minusSeconds(30L * 24 * 60 * 60);
        try (var stream = Files.list(invoiceDir)) {
            stream.filter(p -> p.toString().endsWith(".pdf")).forEach(p -> {
                try {
                    BasicFileAttributes attrs = Files.readAttributes(p, BasicFileAttributes.class);
                    if (attrs.creationTime().toInstant().isBefore(cutoff)) {
                        Files.deleteIfExists(p);
                        log.info("Deleted old invoice PDF: {}", p.getFileName());
                    }
                } catch (IOException e) {
                    log.warn("Could not delete invoice PDF {}: {}", p, e.getMessage());
                }
            });
        } catch (IOException e) {
            log.error("Invoice cleanup failed: {}", e.getMessage());
        }
    }
}
