package com.stockez.api.module.invoice;

import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import com.lowagie.text.pdf.draw.LineSeparator;
import com.stockez.api.module.order.dto.OrderDtos;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Mirrors the layout of the web "Print Invoice" view (InvoicePrint.tsx) as closely as OpenPDF
 * allows, so the bill a salesman shares with a customer looks the same as the one printed from
 * the Orders screen — same header, Bill To / Order Info block, item columns, GST-rate tax
 * summary, totals, and amount-in-words footer.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InvoicePdfService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy").withZone(ZoneId.systemDefault());

    private static final Color INK = new Color(28, 43, 54);
    private static final Color MUTED = new Color(85, 85, 85);
    private static final Color LIGHT_MUTED = new Color(120, 120, 120);
    private static final Color BORDER = new Color(221, 227, 234);
    private static final Color PANEL_BG = new Color(248, 250, 252);

    private static final String UNICODE_FONT = "/fonts/NotoSansTamil.ttf";
    private static BaseFont unicodeBase;

    /**
     * Helvetica has no Tamil glyphs, so a footer note in Tamil would print as blank boxes.
     * Loaded once, and falls back to Helvetica if the font is missing rather than failing
     * the whole invoice.
     */
    private static synchronized Font unicodeFont(float size, int style, Color colour) {
        if (unicodeBase == null) {
            try (java.io.InputStream in = InvoicePdfService.class.getResourceAsStream(UNICODE_FONT)) {
                if (in != null) {
                    unicodeBase = BaseFont.createFont(UNICODE_FONT, BaseFont.IDENTITY_H, BaseFont.EMBEDDED,
                            true, in.readAllBytes(), null);
                }
            } catch (Exception e) {
                log.warn("Unicode font unavailable, non-Latin text will not render: {}", e.getMessage());
            }
        }
        return unicodeBase != null ? new Font(unicodeBase, size, style, colour)
                                   : new Font(Font.HELVETICA, size, style, colour);
    }

    /**
     * Never let a missing or slow image break invoice generation — plenty of stored image
     * URLs point at objects that no longer exist in R2.
     */
    private Image loadImage(String url, float maxWidth, float maxHeight) {
        if (url == null || url.isBlank()) return null;
        try {
            Image img = Image.getInstance(new java.net.URL(url));
            img.scaleToFit(maxWidth, maxHeight);
            return img;
        } catch (Exception e) {
            log.warn("Invoice image skipped ({}): {}", url, e.getMessage());
            return null;
        }
    }

    public byte[] generateBytes(OrderDtos.PublicInvoiceResponse data) throws IOException {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            generatePdf(data, baos);
            return baos.toByteArray();
        }
    }

    private void generatePdf(OrderDtos.PublicInvoiceResponse data, OutputStream out) throws IOException {
        OrderDtos.OrderResponse order = data.getOrder();
        OrderDtos.CompanyInfo company = data.getCompany();

        Document doc = new Document(PageSize.A4, 30, 30, 30, 30);
        try {
            PdfWriter.getInstance(doc, out);
            doc.open();

            Font companyNameFont = new Font(Font.HELVETICA, 18, Font.BOLD, INK);
            Font invoiceTitleFont = new Font(Font.HELVETICA, 16, Font.BOLD, INK);
            Font sectionFont = new Font(Font.HELVETICA, 8, Font.BOLD, MUTED);
            Font normalFont = new Font(Font.HELVETICA, 9, Font.NORMAL, new Color(34, 34, 34));
            Font mutedFont = new Font(Font.HELVETICA, 8, Font.NORMAL, LIGHT_MUTED);
            Font boldFont = new Font(Font.HELVETICA, 9, Font.BOLD, INK);
            Font headerFont = new Font(Font.HELVETICA, 8, Font.BOLD, Color.WHITE);
            Font totalFont = new Font(Font.HELVETICA, 12, Font.BOLD, INK);

            buildHeader(doc, company, order, companyNameFont, invoiceTitleFont, boldFont, normalFont);
            addLine(doc, 10, 10);
            buildBillToOrderInfo(doc, order, sectionFont, boldFont, normalFont);
            buildBankAndQr(doc, company, sectionFont, boldFont, normalFont);
            addLine(doc, 10, 8);
            buildItemsTable(doc, order, headerFont, normalFont, boldFont, mutedFont);
            buildTaxSummaryAndTotals(doc, order, sectionFont, normalFont, boldFont, totalFont);
            buildAmountInWords(doc, order, sectionFont, boldFont);

            if (order.getNotes() != null && !order.getNotes().isBlank()) {
                Paragraph notesLabel = new Paragraph("NOTES", sectionFont);
                notesLabel.setSpacingBefore(6);
                doc.add(notesLabel);
                doc.add(new Paragraph(order.getNotes(), normalFont));
            }

            if (company.getInvoiceTerms() != null && !company.getInvoiceTerms().isBlank()) {
                addLine(doc, 8, 4);
                Paragraph termsLabel = new Paragraph("TERMS & CONDITIONS", sectionFont);
                doc.add(termsLabel);
                Paragraph termsBody = new Paragraph(company.getInvoiceTerms(), mutedFont);
                termsBody.setSpacingBefore(3);
                doc.add(termsBody);
            }

            addLine(doc, 10, 6);
            // Tenant's own closing line (often a quote, and often not in Latin script).
            if (company.getInvoiceFooterNote() != null && !company.getInvoiceFooterNote().isBlank()) {
                Paragraph note = new Paragraph(company.getInvoiceFooterNote(), unicodeFont(8.5f, Font.NORMAL, INK));
                note.setAlignment(Element.ALIGN_CENTER);
                doc.add(note);
            }
            Paragraph footer = new Paragraph("Generated by StockEz • Enterprise Distribution Platform",
                    new Font(Font.HELVETICA, 7, Font.ITALIC, LIGHT_MUTED));
            footer.setAlignment(Element.ALIGN_CENTER);
            footer.setSpacingBefore(4);
            doc.add(footer);

        } catch (Exception e) {
            if (doc.isOpen()) doc.close();
            throw new IOException("PDF generation failed: " + e.getMessage(), e);
        }
        if (doc.isOpen()) doc.close();
    }

    private void buildHeader(Document doc, OrderDtos.CompanyInfo company, OrderDtos.OrderResponse order,
                              Font companyNameFont, Font invoiceTitleFont, Font boldFont, Font normalFont) throws DocumentException {
        // 3 columns: logo + company details | decorative image | invoice meta.
        PdfPTable header = new PdfPTable(3);
        header.setWidthPercentage(100);
        header.setWidths(new float[]{48, 16, 36});

        PdfPCell companyCell = new PdfPCell();
        companyCell.setBorder(Rectangle.NO_BORDER);
        Image logo = loadImage(company.getLogoUrl(), 110, 45);
        if (logo != null) {
            Paragraph logoP = new Paragraph();
            logoP.add(new Chunk(logo, 0, 0));
            companyCell.addElement(logoP);
        }
        companyCell.addElement(new Phrase(company.getName() != null ? company.getName() : "Distribution Company", companyNameFont));
        if (company.getOwnerName() != null && !company.getOwnerName().isBlank()) {
            companyCell.addElement(new Phrase("Prop: " + company.getOwnerName(), boldFont));
        }
        String addr = buildAddress(company.getAddress(), company.getCity(), company.getState(), company.getPinCode());
        if (!addr.isBlank()) companyCell.addElement(new Phrase(addr, normalFont));
        if (company.getPhone() != null && !company.getPhone().isBlank()) {
            companyCell.addElement(new Phrase("Ph: " + company.getPhone(), boldFont));
        }
        if (company.getGstin() != null && !company.getGstin().isBlank()) {
            companyCell.addElement(new Phrase("GSTIN: " + company.getGstin(), boldFont));
        }
        if (company.getFssaiNumber() != null && !company.getFssaiNumber().isBlank()) {
            companyCell.addElement(new Phrase("FSSAI: " + company.getFssaiNumber(), boldFont));
        }
        if (company.getPanNumber() != null && !company.getPanNumber().isBlank()) {
            companyCell.addElement(new Phrase("PAN: " + company.getPanNumber(), boldFont));
        }
        if (company.getState() != null && !company.getState().isBlank()
                && company.getStateCode() != null && !company.getStateCode().isBlank()) {
            companyCell.addElement(new Phrase(
                    "State Name: " + company.getState() + ", Code: " + company.getStateCode(), normalFont));
        }
        header.addCell(companyCell);

        PdfPCell extraCell = new PdfPCell();
        extraCell.setBorder(Rectangle.NO_BORDER);
        extraCell.setHorizontalAlignment(Element.ALIGN_CENTER);
        Image extra = loadImage(company.getExtraImageUrl(), 70, 70);
        if (extra != null) {
            Paragraph extraP = new Paragraph();
            extraP.add(new Chunk(extra, 0, 0));
            extraP.setAlignment(Element.ALIGN_CENTER);
            extraCell.addElement(extraP);
        }
        header.addCell(extraCell);

        PdfPCell invoiceLabelCell = new PdfPCell();
        invoiceLabelCell.setBorder(Rectangle.NO_BORDER);
        invoiceLabelCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        Paragraph title = new Paragraph("TAX INVOICE", invoiceTitleFont);
        title.setAlignment(Element.ALIGN_RIGHT);
        invoiceLabelCell.addElement(title);
        Paragraph invNo = new Paragraph("Invoice No: " + order.getOrderNumber(), normalFont);
        invNo.setAlignment(Element.ALIGN_RIGHT);
        invoiceLabelCell.addElement(invNo);
        String orderDate = order.getOrderDate() != null ? order.getOrderDate().format(DATE_FMT) : "";
        Paragraph dateP = new Paragraph("Date: " + orderDate, normalFont);
        dateP.setAlignment(Element.ALIGN_RIGHT);
        invoiceLabelCell.addElement(dateP);
        if (order.getSalesPerson() != null && notBlank(order.getSalesPerson().getFullName())) {
            Paragraph sp = new Paragraph("Salesman: " + order.getSalesPerson().getFullName(), normalFont);
            sp.setAlignment(Element.ALIGN_RIGHT);
            invoiceLabelCell.addElement(sp);
        }
        // StockEz has no explicit payment-term field; an unsettled balance is what
        // actually makes a bill credit, so derive it rather than adding a column.
        BigDecimal balance = order.getBalanceAmount();
        String term = (balance != null && balance.compareTo(BigDecimal.ZERO) > 0) ? "CREDIT" : "CASH";
        Paragraph termP = new Paragraph("Term: " + term, boldFont);
        termP.setAlignment(Element.ALIGN_RIGHT);
        invoiceLabelCell.addElement(termP);
        header.addCell(invoiceLabelCell);

        doc.add(header);
    }

    /**
     * Bank details and payment QR, so the customer can pay straight off the printed bill.
     * Renders nothing at all when the tenant has configured neither.
     */
    private void buildBankAndQr(Document doc, OrderDtos.CompanyInfo company,
                                 Font sectionFont, Font boldFont, Font normalFont) throws DocumentException {
        boolean hasBank = notBlank(company.getBankName()) || notBlank(company.getBankAccountNumber())
                || notBlank(company.getBankIfsc());
        Image qr = loadImage(company.getPaymentQrImageUrl(), 85, 85);
        if (!hasBank && qr == null) return;

        PdfPTable panel = new PdfPTable(2);
        panel.setWidthPercentage(100);
        panel.setWidths(new float[]{72, 28});
        panel.setSpacingBefore(8);

        PdfPCell bankCell = new PdfPCell();
        bankCell.setBorder(Rectangle.BOX);
        bankCell.setBorderColor(BORDER);
        bankCell.setBackgroundColor(PANEL_BG);
        bankCell.setPadding(6);
        bankCell.addElement(new Paragraph("BANK DETAILS", sectionFont));
        addBankLine(bankCell, "Bank", company.getBankName(), boldFont, normalFont);
        addBankLine(bankCell, "Account Name", company.getBankAccountName(), boldFont, normalFont);
        addBankLine(bankCell, "Account No", company.getBankAccountNumber(), boldFont, normalFont);
        addBankLine(bankCell, "Branch", company.getBankBranch(), boldFont, normalFont);
        addBankLine(bankCell, "IFSC Code", company.getBankIfsc(), boldFont, normalFont);
        panel.addCell(bankCell);

        PdfPCell qrCell = new PdfPCell();
        qrCell.setBorder(Rectangle.BOX);
        qrCell.setBorderColor(BORDER);
        qrCell.setBackgroundColor(PANEL_BG);
        qrCell.setPadding(6);
        qrCell.setHorizontalAlignment(Element.ALIGN_CENTER);
        if (qr != null) {
            Paragraph qrP = new Paragraph();
            qrP.add(new Chunk(qr, 0, 0));
            qrP.setAlignment(Element.ALIGN_CENTER);
            qrCell.addElement(qrP);
            Paragraph scan = new Paragraph("Scan to pay", new Font(Font.HELVETICA, 7, Font.NORMAL, LIGHT_MUTED));
            scan.setAlignment(Element.ALIGN_CENTER);
            qrCell.addElement(scan);
        }
        panel.addCell(qrCell);

        doc.add(panel);
    }

    private void addBankLine(PdfPCell cell, String label, String value, Font boldFont, Font normalFont) {
        if (!notBlank(value)) return;
        Paragraph p = new Paragraph();
        p.add(new Chunk(label + ": ", normalFont));
        p.add(new Chunk(value, boldFont));
        cell.addElement(p);
    }

    private boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private void buildBillToOrderInfo(Document doc, OrderDtos.OrderResponse order,
                                       Font sectionFont, Font boldFont, Font normalFont) throws DocumentException {
        PdfPTable table = new PdfPTable(2);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{55, 45});
        table.setSpacingBefore(6);

        PdfPCell billCell = new PdfPCell();
        billCell.setBorder(Rectangle.NO_BORDER);
        billCell.addElement(new Paragraph("BILL TO", sectionFont));
        OrderDtos.CustomerInfo cust = order.getCustomer();
        if (cust != null) {
            billCell.addElement(new Paragraph(cust.getBusinessName(), new Font(Font.HELVETICA, 11, Font.BOLD, INK)));
            if (cust.getOwnerName() != null && !cust.getOwnerName().isBlank()
                    && !sameText(cust.getOwnerName(), cust.getBusinessName())) {
                billCell.addElement(new Paragraph(cust.getOwnerName(), normalFont));
            }
            if (cust.getPhone() != null) billCell.addElement(new Paragraph(cust.getPhone(), normalFont));
            if (cust.getAddress() != null && !cust.getAddress().isBlank()) {
                billCell.addElement(new Paragraph(cust.getAddress(), normalFont));
            }
            String cityLine = buildAddress(null, cust.getCity(), cust.getState(), cust.getPinCode());
            if (!cityLine.isBlank()) billCell.addElement(new Paragraph(cityLine, normalFont));
            if (cust.getGstin() != null && !cust.getGstin().isBlank()) {
                billCell.addElement(new Paragraph("GSTIN: " + cust.getGstin(), boldFont));
            }
        }
        table.addCell(billCell);

        PdfPCell infoCell = new PdfPCell();
        infoCell.setBorder(Rectangle.NO_BORDER);
        infoCell.addElement(new Paragraph("ORDER INFO", sectionFont));
        if (cust != null && cust.getRouteName() != null && !cust.getRouteName().isBlank()) {
            infoCell.addElement(new Paragraph("Route: " + cust.getRouteName(), normalFont));
            if (cust.getRoutePlaceName() != null && !cust.getRoutePlaceName().isBlank()
                    && !sameText(cust.getRoutePlaceName(), cust.getRouteName())) {
                infoCell.addElement(new Paragraph("Place: " + cust.getRoutePlaceName(), normalFont));
            }
        }
        if (order.getSalesPerson() != null) {
            String sp = "Sales By: " + order.getSalesPerson().getFullName();
            if (order.getSalesPerson().getPhone() != null) sp += " · " + order.getSalesPerson().getPhone();
            infoCell.addElement(new Paragraph(sp, normalFont));
        }
        if (order.getDeliveryPerson() != null) {
            infoCell.addElement(new Paragraph("Delivery By: " + order.getDeliveryPerson().getFullName(), normalFont));
        }
        if (order.getStatus() != null) {
            infoCell.addElement(new Paragraph("Status: " + order.getStatus().name().replace('_', ' '),
                    new Font(Font.HELVETICA, 9, Font.BOLD, new Color(15, 138, 95))));
        }
        table.addCell(infoCell);

        doc.add(table);
    }

    private boolean sameText(String a, String b) {
        return a != null && b != null && a.trim().equalsIgnoreCase(b.trim());
    }

    private void buildItemsTable(Document doc, OrderDtos.OrderResponse order,
                                  Font headerFont, Font normalFont, Font boldFont, Font mutedFont) throws DocumentException {
        PdfPTable table = new PdfPTable(10);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{4, 18, 9, 6, 8, 8, 7, 6, 9, 9});
        table.setSpacingBefore(6);
        table.setSpacingAfter(4);

        Font hsnFont = new Font(Font.HELVETICA, 7, Font.NORMAL, new Color(34, 34, 34));
        Color headerBg = new Color(28, 43, 54);
        addTableHeader(table, "#", headerFont, headerBg, Element.ALIGN_CENTER);
        addTableHeader(table, "Product", headerFont, headerBg, Element.ALIGN_LEFT);
        addTableHeader(table, "HSN", headerFont, headerBg, Element.ALIGN_CENTER);
        addTableHeader(table, "Qty", headerFont, headerBg, Element.ALIGN_CENTER);
        addTableHeader(table, "MRP", headerFont, headerBg, Element.ALIGN_RIGHT);
        addTableHeader(table, "Rate", headerFont, headerBg, Element.ALIGN_RIGHT);
        addTableHeader(table, "Disc", headerFont, headerBg, Element.ALIGN_RIGHT);
        addTableHeader(table, "GST%", headerFont, headerBg, Element.ALIGN_RIGHT);
        addTableHeader(table, "GST Amt", headerFont, headerBg, Element.ALIGN_RIGHT);
        addTableHeader(table, "Total", headerFont, headerBg, Element.ALIGN_RIGHT);

        int idx = 1;
        for (OrderDtos.OrderItemResponse item : order.getItems()) {
            Color rowBg = Color.WHITE;
            String productName = item.getProduct() != null ? item.getProduct().getName() : "-";
            String unit = item.getProduct() != null && item.getProduct().getUnit() != null ? item.getProduct().getUnit() : "";
            String brand = item.getProduct() != null && item.getProduct().getBrand() != null ? item.getProduct().getBrand() : "";
            String hsnCode = item.getProduct() != null && item.getProduct().getHsnCode() != null ? item.getProduct().getHsnCode() : "—";

            addTableCell(table, String.valueOf(idx++), normalFont, rowBg, Element.ALIGN_CENTER);

            PdfPCell nameCell = new PdfPCell();
            nameCell.setBackgroundColor(rowBg);
            nameCell.setBorderColor(BORDER);
            nameCell.setPadding(4);
            nameCell.addElement(new Phrase(productName, boldFont));
            if (!brand.isBlank()) nameCell.addElement(new Phrase(brand, mutedFont));
            table.addCell(nameCell);

            addTableCell(table, hsnCode, hsnFont, rowBg, Element.ALIGN_CENTER);
            addTableCell(table, item.getQuantity() + (unit.isBlank() ? "" : " " + unit), normalFont, rowBg, Element.ALIGN_CENTER);
            addTableCell(table, item.getMrp() != null ? fmt(item.getMrp()) : "—", normalFont, rowBg, Element.ALIGN_RIGHT);
            addTableCell(table, fmt(item.getUnitPrice()), normalFont, rowBg, Element.ALIGN_RIGHT);
            addTableCell(table, item.getDiscountAmount() != null && item.getDiscountAmount().signum() > 0 ? fmt(item.getDiscountAmount()) : "—", normalFont, rowBg, Element.ALIGN_RIGHT);
            addTableCell(table, item.getGstPercent() != null ? item.getGstPercent().stripTrailingZeros().toPlainString() + "%" : "0%", normalFont, rowBg, Element.ALIGN_RIGHT);
            addTableCell(table, fmt(item.getGstAmount()), normalFont, rowBg, Element.ALIGN_RIGHT);
            addTableCell(table, fmt(item.getLineTotal()), boldFont, rowBg, Element.ALIGN_RIGHT);
        }
        doc.add(table);
    }

    private void buildTaxSummaryAndTotals(Document doc, OrderDtos.OrderResponse order,
                                           Font sectionFont, Font normalFont, Font boldFont, Font totalFont) throws DocumentException {
        // GST rate-wise grouping, mirroring the web invoice's Tax Summary table.
        Map<BigDecimal, BigDecimal[]> gstGroups = new LinkedHashMap<>(); // rate -> [taxable, gst]
        for (OrderDtos.OrderItemResponse item : order.getItems()) {
            BigDecimal rate = item.getGstPercent() != null ? item.getGstPercent() : BigDecimal.ZERO;
            BigDecimal lineTotal = item.getLineTotal() != null ? item.getLineTotal() : BigDecimal.ZERO;
            BigDecimal gstAmt = item.getGstAmount() != null ? item.getGstAmount() : BigDecimal.ZERO;
            BigDecimal[] acc = gstGroups.computeIfAbsent(rate, r -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
            acc[0] = acc[0].add(lineTotal.subtract(gstAmt));
            acc[1] = acc[1].add(gstAmt);
        }

        PdfPTable outer = new PdfPTable(2);
        outer.setWidthPercentage(100);
        outer.setWidths(new float[]{55, 45});
        outer.setSpacingBefore(8);

        // Left: Tax Summary
        PdfPCell taxCell = new PdfPCell();
        taxCell.setBorder(Rectangle.NO_BORDER);
        taxCell.addElement(new Paragraph("TAX SUMMARY", sectionFont));
        PdfPTable taxTable = new PdfPTable(5);
        taxTable.setWidthPercentage(96);
        taxTable.setWidths(new float[]{12, 22, 22, 22, 22});
        taxTable.setSpacingBefore(4);
        Font taxHeaderFont = new Font(Font.HELVETICA, 8, Font.BOLD, new Color(34, 34, 34));
        addPanelHeaderCell(taxTable, "Tax%", taxHeaderFont, Element.ALIGN_CENTER);
        addPanelHeaderCell(taxTable, "Taxable", taxHeaderFont, Element.ALIGN_RIGHT);
        addPanelHeaderCell(taxTable, "CGST", taxHeaderFont, Element.ALIGN_RIGHT);
        addPanelHeaderCell(taxTable, "SGST", taxHeaderFont, Element.ALIGN_RIGHT);
        addPanelHeaderCell(taxTable, "Total GST", taxHeaderFont, Element.ALIGN_RIGHT);

        BigDecimal totalTaxable = BigDecimal.ZERO;
        BigDecimal totalCgst = BigDecimal.ZERO;
        BigDecimal totalSgst = BigDecimal.ZERO;
        for (Map.Entry<BigDecimal, BigDecimal[]> e : gstGroups.entrySet()) {
            BigDecimal taxable = e.getValue()[0];
            BigDecimal gst = e.getValue()[1];
            BigDecimal cgst = gst.divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
            BigDecimal sgst = gst.divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
            totalTaxable = totalTaxable.add(taxable);
            totalCgst = totalCgst.add(cgst);
            totalSgst = totalSgst.add(sgst);
            addPanelCell(taxTable, e.getKey().stripTrailingZeros().toPlainString() + "%", normalFont, Element.ALIGN_CENTER);
            addPanelCell(taxTable, fmt(taxable), normalFont, Element.ALIGN_RIGHT);
            addPanelCell(taxTable, fmt(cgst), normalFont, Element.ALIGN_RIGHT);
            addPanelCell(taxTable, fmt(sgst), normalFont, Element.ALIGN_RIGHT);
            addPanelCell(taxTable, fmt(cgst.add(sgst)), normalFont, Element.ALIGN_RIGHT);
        }
        if (gstGroups.size() > 1) {
            addPanelCell(taxTable, "Total", boldFont, Element.ALIGN_CENTER);
            addPanelCell(taxTable, fmt(totalTaxable), boldFont, Element.ALIGN_RIGHT);
            addPanelCell(taxTable, fmt(totalCgst), boldFont, Element.ALIGN_RIGHT);
            addPanelCell(taxTable, fmt(totalSgst), boldFont, Element.ALIGN_RIGHT);
            addPanelCell(taxTable, fmt(totalCgst.add(totalSgst)), boldFont, Element.ALIGN_RIGHT);
        }
        taxCell.addElement(taxTable);
        outer.addCell(taxCell);

        // Right: Totals panel
        PdfPCell totalsOuterCell = new PdfPCell();
        totalsOuterCell.setBorder(Rectangle.BOX);
        totalsOuterCell.setBorderColor(BORDER);
        totalsOuterCell.setPadding(0);

        PdfPTable totalsInner = new PdfPTable(2);
        totalsInner.setWidthPercentage(100);
        totalsInner.setWidths(new float[]{55, 45});

        // Prefer the order's own authoritative subtotal/GST (matches the web invoice); fall back
        // to the rate-wise sums above only if the order response didn't carry them.
        BigDecimal subTotal = order.getSubTotal() != null ? order.getSubTotal() : totalTaxable;
        BigDecimal orderGst = order.getTotalGst() != null ? order.getTotalGst() : totalCgst.add(totalSgst);
        BigDecimal cgstDisplay = orderGst.divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
        BigDecimal sgstDisplay = orderGst.subtract(cgstDisplay);

        // Bill-level (overall) discount — mirrors InvoicePrint.tsx: show the pre-discount items
        // total and the discount taken off, then relabel Sub Total to Taxable Value.
        BigDecimal overallDiscount = order.getOverallDiscountAmount() != null ? order.getOverallDiscountAmount() : BigDecimal.ZERO;
        if (overallDiscount.signum() > 0) {
            BigDecimal grossInclusive = BigDecimal.ZERO;
            for (OrderDtos.OrderItemResponse item : order.getItems()) {
                BigDecimal unitPrice = item.getUnitPrice() != null ? item.getUnitPrice() : BigDecimal.ZERO;
                BigDecimal qty = BigDecimal.valueOf(item.getQuantity() != null ? item.getQuantity() : 0);
                BigDecimal discAmt = item.getDiscountAmount() != null ? item.getDiscountAmount() : BigDecimal.ZERO;
                grossInclusive = grossInclusive.add(unitPrice.multiply(qty).subtract(discAmt));
            }
            String discountLabel = "PERCENT".equals(order.getOverallDiscountType()) && order.getOverallDiscountValue() != null
                    ? "Less: Discount (" + order.getOverallDiscountValue().stripTrailingZeros().toPlainString() + "%)"
                    : "Less: Discount";
            addTotalRow(totalsInner, "Items Total (incl. GST)", fmt(grossInclusive), normalFont, normalFont, 8);
            addTotalRow(totalsInner, discountLabel, "-" + fmt(overallDiscount),
                    new Font(Font.HELVETICA, 9, Font.BOLD, new Color(220, 38, 38)),
                    new Font(Font.HELVETICA, 9, Font.BOLD, new Color(220, 38, 38)), 8);
            addTotalRow(totalsInner, "Taxable Value", fmt(subTotal), normalFont, normalFont, 8);
        } else {
            addTotalRow(totalsInner, "Sub Total", fmt(subTotal), normalFont, normalFont, 8);
        }
        addTotalRow(totalsInner, "CGST", fmt(cgstDisplay), normalFont, normalFont, 8);
        addTotalRow(totalsInner, "SGST", fmt(sgstDisplay), normalFont, normalFont, 8);

        Font totalWhiteFont = new Font(totalFont.getFamily(), totalFont.getSize(), totalFont.getStyle(), Color.WHITE);
        PdfPCell grandLabelCell = new PdfPCell(new Phrase("TOTAL AMOUNT", totalWhiteFont));
        grandLabelCell.setBackgroundColor(INK);
        grandLabelCell.setBorder(Rectangle.NO_BORDER);
        grandLabelCell.setPadding(8);
        PdfPCell grandValueCell = new PdfPCell(new Phrase(fmt(order.getTotalAmount()), totalWhiteFont));
        grandValueCell.setBackgroundColor(INK);
        grandValueCell.setBorder(Rectangle.NO_BORDER);
        grandValueCell.setPadding(8);
        grandValueCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        totalsInner.addCell(grandLabelCell);
        totalsInner.addCell(grandValueCell);

        if (order.getPaidAmount() != null && order.getPaidAmount().signum() > 0) {
            addTotalRow(totalsInner, "Paid", fmt(order.getPaidAmount()), normalFont, new Font(Font.HELVETICA, 9, Font.BOLD, new Color(15, 138, 95)), 8);
        }
        BigDecimal balance = order.getBalanceAmount() != null ? order.getBalanceAmount() : BigDecimal.ZERO;
        addTotalRow(totalsInner, "Balance Due", fmt(balance),
                new Font(Font.HELVETICA, 9, Font.BOLD, INK),
                new Font(Font.HELVETICA, 9, Font.BOLD, balance.signum() > 0 ? new Color(220, 38, 38) : new Color(15, 138, 95)), 8);

        totalsOuterCell.addElement(totalsInner);
        outer.addCell(totalsOuterCell);

        doc.add(outer);
    }

    private void buildAmountInWords(Document doc, OrderDtos.OrderResponse order, Font sectionFont, Font boldFont) throws DocumentException {
        PdfPCell cell = new PdfPCell();
        cell.setBackgroundColor(PANEL_BG);
        cell.setBorderColor(BORDER);
        cell.setPadding(8);
        Phrase p = new Phrase();
        p.add(new Chunk("Amount in words: ", new Font(Font.HELVETICA, 9, Font.NORMAL, MUTED)));
        BigDecimal total = order.getTotalAmount() != null ? order.getTotalAmount() : BigDecimal.ZERO;
        p.add(new Chunk(toWords(total), boldFont));
        cell.addElement(p);

        PdfPTable wrap = new PdfPTable(1);
        wrap.setWidthPercentage(100);
        wrap.setSpacingBefore(8);
        wrap.addCell(cell);
        doc.add(wrap);
    }

    private void addPanelHeaderCell(PdfPTable table, String text, Font font, int align) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setBackgroundColor(PANEL_BG);
        cell.setHorizontalAlignment(align);
        cell.setPadding(4);
        cell.setBorderColor(BORDER);
        table.addCell(cell);
    }

    private void addPanelCell(PdfPTable table, String text, Font font, int align) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setHorizontalAlignment(align);
        cell.setPadding(4);
        cell.setBorderColor(BORDER);
        table.addCell(cell);
    }

    private void addLine(Document doc, float spacingBefore, float spacingAfter) throws DocumentException {
        LineSeparator line = new LineSeparator();
        line.setLineColor(BORDER);
        Chunk chunk = new Chunk(line);
        Paragraph p = new Paragraph();
        p.setSpacingBefore(spacingBefore);
        p.setSpacingAfter(spacingAfter);
        p.add(chunk);
        doc.add(p);
    }

    private void addTableHeader(PdfPTable table, String text, Font font, Color bg, int align) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setBackgroundColor(bg);
        cell.setHorizontalAlignment(align);
        cell.setPadding(4);
        cell.setBorderColor(new Color(60, 70, 90));
        table.addCell(cell);
    }

    private void addTableCell(PdfPTable table, String text, Font font, Color bg, int align) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setBackgroundColor(bg);
        cell.setHorizontalAlignment(align);
        cell.setPadding(3);
        cell.setBorderColor(BORDER);
        table.addCell(cell);
    }

    private void addTotalRow(PdfPTable table, String label, String value, Font labelFont, Font valueFont, float padding) {
        PdfPCell labelCell = new PdfPCell(new Phrase(label, labelFont));
        labelCell.setBorder(Rectangle.NO_BORDER);
        labelCell.setPadding(padding);
        PdfPCell valueCell = new PdfPCell(new Phrase(value, valueFont));
        valueCell.setBorder(Rectangle.NO_BORDER);
        valueCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        valueCell.setPadding(padding);
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

    // ─── Amount in words (Indian numbering — Lakh/Crore) ───────────────────────

    private static final String[] ONES = {"", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
            "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"};
    private static final String[] TENS = {"", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"};

    private String toWords(BigDecimal amount) {
        long rupees = amount.setScale(2, RoundingMode.HALF_UP).longValue();
        int paise = amount.setScale(2, RoundingMode.HALF_UP).subtract(BigDecimal.valueOf(rupees)).movePointRight(2).intValue();

        if (rupees == 0 && paise == 0) return "Zero Rupees Only";

        StringBuilder result = new StringBuilder(numberToWords(rupees).trim()).append(" Rupees");
        if (paise > 0) result.append(" and ").append(numberToWords(paise).trim()).append(" Paise");
        return result.append(" Only").toString();
    }

    private String numberToWords(long n) {
        if (n == 0) return "";
        if (n < 20) return ONES[(int) n] + " ";
        if (n < 100) return TENS[(int) (n / 10)] + (n % 10 != 0 ? " " + ONES[(int) (n % 10)] : "") + " ";
        if (n < 1000) return ONES[(int) (n / 100)] + " Hundred " + numberToWords(n % 100);
        if (n < 100000) return numberToWords(n / 1000) + "Thousand " + numberToWords(n % 1000);
        if (n < 10000000) return numberToWords(n / 100000) + "Lakh " + numberToWords(n % 100000);
        return numberToWords(n / 10000000) + "Crore " + numberToWords(n % 10000000);
    }
}
