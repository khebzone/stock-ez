package com.stockez.api.module.goodsreturn.service;

import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import com.stockez.api.module.goodsreturn.dto.GoodsReturnDtos;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * DEBIT NOTE for goods sent back to a supplier.
 *
 * Not an invoice: a purchase return is a debit note under GST, so it carries its own PRN serial,
 * the original supplier invoice it relates to, and the HSN / taxable / CGST-SGST split per line —
 * which is what the supplier's accountant needs to pass the credit.
 */
@Service
@Slf4j
public class DebitNotePdfService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy");

    private static final Color INK    = new Color(30, 30, 30);
    private static final Color MUTED  = new Color(110, 110, 110);
    private static final Color LINE   = new Color(200, 200, 200);
    private static final Color HEADBG = new Color(245, 245, 245);

    public byte[] generateBytes(GoodsReturnDtos.DebitNoteResponse data) throws IOException {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            generatePdf(data, baos);
            return baos.toByteArray();
        }
    }

    private void generatePdf(GoodsReturnDtos.DebitNoteResponse d, OutputStream out) throws IOException {
        Document doc = new Document(PageSize.A4, 30, 30, 30, 30);
        try {
            PdfWriter.getInstance(doc, out);
            doc.open();

            Font companyFont = new Font(Font.HELVETICA, 17, Font.BOLD, INK);
            Font titleFont   = new Font(Font.HELVETICA, 14, Font.BOLD, INK);
            Font labelFont   = new Font(Font.HELVETICA, 8, Font.BOLD, MUTED);
            Font smallFont   = new Font(Font.HELVETICA, 8.5f, Font.NORMAL, new Color(60, 60, 60));
            Font normalFont  = new Font(Font.HELVETICA, 9, Font.NORMAL, new Color(50, 50, 50));
            Font boldFont    = new Font(Font.HELVETICA, 9, Font.BOLD, INK);
            Font thFont      = new Font(Font.HELVETICA, 8, Font.BOLD, new Color(70, 70, 70));
            Font tdFont      = new Font(Font.HELVETICA, 8.5f, Font.NORMAL, new Color(45, 45, 45));
            Font totalFont   = new Font(Font.HELVETICA, 12, Font.BOLD, INK);

            doc.add(buildHeader(d, companyFont, titleFont, labelFont, smallFont, normalFont, boldFont));
            doc.add(buildParties(d, labelFont, boldFont, smallFont));
            doc.add(buildItems(d, thFont, tdFont));
            doc.add(buildTotals(d, labelFont, normalFont, boldFont, totalFont, thFont, tdFont));

            if (d.getReason() != null && !d.getReason().isBlank()) {
                Paragraph reason = new Paragraph("Reason for return: " + d.getReason(), smallFont);
                reason.setSpacingBefore(10);
                doc.add(reason);
            }

            doc.add(buildSettlement(d, labelFont, smallFont, boldFont));
            doc.add(buildSignatures(d, labelFont, smallFont));

        } catch (Exception e) {
            if (doc.isOpen()) doc.close();
            throw new IOException("Debit note generation failed: " + e.getMessage(), e);
        }
        if (doc.isOpen()) doc.close();
    }

    private PdfPTable buildHeader(GoodsReturnDtos.DebitNoteResponse d, Font companyFont, Font titleFont,
                                  Font labelFont, Font smallFont, Font normalFont, Font boldFont)
            throws DocumentException {
        GoodsReturnDtos.CompanyInfo c = d.getCompany();

        PdfPTable header = new PdfPTable(2);
        header.setWidthPercentage(100);
        header.setWidths(new float[]{58, 42});
        header.setSpacingAfter(6);

        PdfPCell left = new PdfPCell();
        left.setBorder(Rectangle.NO_BORDER);
        Image logo = loadImage(c.getLogoUrl(), 110, 46);
        if (logo != null) {
            PdfPCell logoHolder = new PdfPCell(logo, false);
            logoHolder.setBorder(Rectangle.NO_BORDER);
            PdfPTable logoRow = new PdfPTable(1);
            logoRow.setWidthPercentage(100);
            logoRow.addCell(logoHolder);
            left.addElement(logoRow);
        }
        left.addElement(new Phrase(c.getName(), companyFont));
        String addr = joinAddress(c);
        if (!addr.isBlank()) left.addElement(new Phrase(addr, smallFont));
        if (notBlank(c.getPhone())) left.addElement(new Phrase("Ph: " + c.getPhone(), smallFont));
        if (notBlank(c.getGstin())) left.addElement(new Phrase("GSTIN: " + c.getGstin(), smallFont));
        if (notBlank(c.getFssaiNumber())) left.addElement(new Phrase("FSSAI: " + c.getFssaiNumber(), smallFont));
        header.addCell(left);

        PdfPCell right = new PdfPCell();
        right.setBorder(Rectangle.NO_BORDER);
        right.setHorizontalAlignment(Element.ALIGN_RIGHT);
        Paragraph title = new Paragraph("DEBIT NOTE", titleFont);
        title.setAlignment(Element.ALIGN_RIGHT);
        right.addElement(title);
        right.addElement(rightLine("(Purchase Return)", labelFont));
        right.addElement(rightLine("No: " + d.getReturnNumber(), boldFont));
        if (d.getReturnDate() != null) {
            right.addElement(rightLine("Date: " + d.getReturnDate().format(DATE_FMT), normalFont));
        }
        if (notBlank(d.getAgainstInvoiceNumber())) {
            right.addElement(rightLine("Against Invoice: " + d.getAgainstInvoiceNumber(), normalFont));
        }
        if (d.getAgainstInvoiceDate() != null) {
            right.addElement(rightLine("Invoice Date: " + d.getAgainstInvoiceDate().format(DATE_FMT), normalFont));
        }
        if (notBlank(d.getAgainstEntryNumber())) {
            right.addElement(rightLine("Purchase Entry: " + d.getAgainstEntryNumber(), smallFont));
        }
        header.addCell(right);
        return header;
    }

    private PdfPTable buildParties(GoodsReturnDtos.DebitNoteResponse d, Font labelFont, Font boldFont, Font smallFont)
            throws DocumentException {
        GoodsReturnDtos.CompanyInfo c = d.getCompany();

        PdfPTable parties = new PdfPTable(2);
        parties.setWidthPercentage(100);
        parties.setWidths(new float[]{50, 50});
        parties.setSpacingBefore(4);
        parties.setSpacingAfter(8);

        PdfPCell to = boxedCell();
        to.addElement(new Phrase("DEBIT TO (SUPPLIER)", labelFont));
        to.addElement(new Phrase(d.getSupplierName() != null ? d.getSupplierName() : "—", boldFont));
        if (notBlank(d.getSupplierRefNumber())) {
            to.addElement(new Phrase("Supplier Ref: " + d.getSupplierRefNumber(), smallFont));
        }
        parties.addCell(to);

        PdfPCell from = boxedCell();
        from.addElement(new Phrase("RETURNED BY", labelFont));
        from.addElement(new Phrase(c.getName(), boldFont));
        String state = notBlank(c.getState()) ? c.getState() : "";
        if (notBlank(c.getStateCode())) state = state.isBlank() ? c.getStateCode() : state + " (" + c.getStateCode() + ")";
        if (!state.isBlank()) from.addElement(new Phrase("State: " + state, smallFont));
        if (notBlank(d.getCreatedByName())) from.addElement(new Phrase("Prepared by: " + d.getCreatedByName(), smallFont));
        parties.addCell(from);

        return parties;
    }

    private PdfPTable buildItems(GoodsReturnDtos.DebitNoteResponse d, Font thFont, Font tdFont)
            throws DocumentException {
        PdfPTable table = new PdfPTable(9);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{4, 26, 10, 12, 6, 10, 12, 8, 12});
        table.setHeaderRows(1);
        table.setSpacingAfter(4);

        for (String h : new String[]{"#", "Product", "HSN", "Batch", "Qty", "Rate", "Taxable", "GST%", "Amount"}) {
            PdfPCell th = new PdfPCell(new Phrase(h, thFont));
            th.setBackgroundColor(HEADBG);
            th.setBorderColor(LINE);
            th.setPadding(5);
            th.setHorizontalAlignment(isNumeric(h) ? Element.ALIGN_RIGHT : Element.ALIGN_LEFT);
            table.addCell(th);
        }

        List<GoodsReturnDtos.DebitNoteLine> lines = d.getLines();
        int i = 1;
        for (GoodsReturnDtos.DebitNoteLine l : lines) {
            table.addCell(td(String.valueOf(i++), tdFont, Element.ALIGN_LEFT));
            table.addCell(td(l.getProductName(), tdFont, Element.ALIGN_LEFT));
            table.addCell(td(l.getHsnCode(), tdFont, Element.ALIGN_LEFT));
            table.addCell(td(l.getBatchNumber(), tdFont, Element.ALIGN_LEFT));
            String qty = l.getQuantity() + (notBlank(l.getUnitName()) ? " " + l.getUnitName() : "");
            table.addCell(td(qty, tdFont, Element.ALIGN_RIGHT));
            table.addCell(td(fmt(l.getUnitRate()), tdFont, Element.ALIGN_RIGHT));
            table.addCell(td(fmt(l.getTaxableAmount()), tdFont, Element.ALIGN_RIGHT));
            table.addCell(td(trimPct(l.getGstPercent()), tdFont, Element.ALIGN_RIGHT));
            table.addCell(td(fmt(l.getAmount()), tdFont, Element.ALIGN_RIGHT));
        }
        return table;
    }

    private PdfPTable buildTotals(GoodsReturnDtos.DebitNoteResponse d, Font labelFont, Font normalFont,
                                  Font boldFont, Font totalFont, Font thFont, Font tdFont)
            throws DocumentException {
        PdfPTable wrap = new PdfPTable(2);
        wrap.setWidthPercentage(100);
        wrap.setWidths(new float[]{52, 48});
        wrap.setSpacingBefore(6);

        // GST slab breakup — what the supplier's accountant reverses.
        PdfPCell gstCell = new PdfPCell();
        gstCell.setBorder(Rectangle.NO_BORDER);
        if (d.getGstSummary() != null && !d.getGstSummary().isEmpty()) {
            gstCell.addElement(new Phrase("GST BREAK-UP", labelFont));
            PdfPTable gst = new PdfPTable(4);
            gst.setWidthPercentage(100);
            gst.setWidths(new float[]{18, 30, 26, 26});
            gst.setSpacingBefore(3);
            for (String h : new String[]{"Rate", "Taxable", "CGST", "SGST"}) {
                PdfPCell th = new PdfPCell(new Phrase(h, thFont));
                th.setBackgroundColor(HEADBG);
                th.setBorderColor(LINE);
                th.setPadding(4);
                th.setHorizontalAlignment(h.equals("Rate") ? Element.ALIGN_LEFT : Element.ALIGN_RIGHT);
                gst.addCell(th);
            }
            for (GoodsReturnDtos.GstSlab s : d.getGstSummary()) {
                gst.addCell(td(trimPct(s.getGstPercent()), tdFont, Element.ALIGN_LEFT));
                gst.addCell(td(fmt(s.getTaxableAmount()), tdFont, Element.ALIGN_RIGHT));
                gst.addCell(td(fmt(s.getCgst()), tdFont, Element.ALIGN_RIGHT));
                gst.addCell(td(fmt(s.getSgst()), tdFont, Element.ALIGN_RIGHT));
            }
            gstCell.addElement(gst);
        }
        wrap.addCell(gstCell);

        PdfPCell sumCell = new PdfPCell();
        sumCell.setBorder(Rectangle.NO_BORDER);
        PdfPTable sum = new PdfPTable(2);
        sum.setWidthPercentage(100);
        sum.setWidths(new float[]{55, 45});
        addSumRow(sum, "Taxable Value", fmt(d.getTotalTaxable()), normalFont, normalFont);
        addSumRow(sum, "Total GST", fmt(d.getTotalGst()), normalFont, normalFont);
        addSumRow(sum, "Total Debited", fmt(d.getTotalAmount()), boldFont, totalFont);
        sumCell.addElement(sum);
        Paragraph words = new Paragraph("Rupees " + inWords(d.getTotalAmount()) + " only", labelFont);
        words.setSpacingBefore(4);
        words.setAlignment(Element.ALIGN_RIGHT);
        sumCell.addElement(words);
        wrap.addCell(sumCell);

        return wrap;
    }

    private PdfPTable buildSettlement(GoodsReturnDtos.DebitNoteResponse d, Font labelFont, Font smallFont, Font boldFont)
            throws DocumentException {
        PdfPTable box = new PdfPTable(1);
        box.setWidthPercentage(100);
        box.setSpacingBefore(10);

        PdfPCell cell = boxedCell();
        cell.addElement(new Phrase("SETTLEMENT", labelFont));
        cell.addElement(new Phrase(settlementText(d), boldFont));
        if (d.getRefundDate() != null) {
            cell.addElement(new Phrase("Settled on " + d.getRefundDate().format(DATE_FMT), smallFont));
        }
        box.addCell(cell);
        return box;
    }

    private String settlementText(GoodsReturnDtos.DebitNoteResponse d) {
        if (!"PROCESSED".equals(d.getRefundStatus()) || d.getSettlementMode() == null) {
            return "Outstanding — please credit our account or replace the goods.";
        }
        return switch (d.getSettlementMode()) {
            case "ADJUST_AGAINST_BILL" -> "Adjusted against our outstanding bill with you.";
            case "CASH_REFUND"         -> "Amount refunded to us.";
            case "GOODS_REPLACED"      -> "Settled — replacement goods of equal value received.";
            default                    -> "Settled.";
        };
    }

    private PdfPTable buildSignatures(GoodsReturnDtos.DebitNoteResponse d, Font labelFont, Font smallFont)
            throws DocumentException {
        PdfPTable sign = new PdfPTable(2);
        sign.setWidthPercentage(100);
        sign.setWidths(new float[]{50, 50});
        sign.setSpacingBefore(26);

        sign.addCell(signCell("Supplier's Acknowledgement", labelFont, smallFont, Element.ALIGN_LEFT));
        sign.addCell(signCell("For " + d.getCompany().getName(), labelFont, smallFont, Element.ALIGN_RIGHT));
        return sign;
    }

    private PdfPCell signCell(String caption, Font labelFont, Font smallFont, int align) {
        PdfPCell c = new PdfPCell();
        c.setBorder(Rectangle.NO_BORDER);
        Paragraph rule = new Paragraph("____________________", smallFont);
        rule.setAlignment(align);
        Paragraph cap = new Paragraph(caption, labelFont);
        cap.setAlignment(align);
        c.addElement(rule);
        c.addElement(cap);
        return c;
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private Image loadImage(String url, float maxWidth, float maxHeight) {
        if (url == null || url.isBlank()) return null;
        try {
            Image img = Image.getInstance(new java.net.URL(url));
            img.scaleToFit(maxWidth, maxHeight);
            return img;
        } catch (Exception e) {
            log.warn("Debit note image skipped ({}): {}", url, e.getMessage());
            return null;
        }
    }

    private PdfPCell boxedCell() {
        PdfPCell c = new PdfPCell();
        c.setBorderColor(LINE);
        c.setPadding(7);
        return c;
    }

    private Paragraph rightLine(String text, Font font) {
        Paragraph p = new Paragraph(text, font);
        p.setAlignment(Element.ALIGN_RIGHT);
        return p;
    }

    private PdfPCell td(String text, Font font, int align) {
        PdfPCell c = new PdfPCell(new Phrase(text != null && !text.isBlank() ? text : "—", font));
        c.setBorderColor(LINE);
        c.setPadding(5);
        c.setHorizontalAlignment(align);
        return c;
    }

    private void addSumRow(PdfPTable t, String label, String value, Font labelFont, Font valueFont) {
        PdfPCell l = new PdfPCell(new Phrase(label, labelFont));
        l.setBorder(Rectangle.NO_BORDER);
        l.setPadding(3);
        l.setHorizontalAlignment(Element.ALIGN_RIGHT);
        PdfPCell v = new PdfPCell(new Phrase(value, valueFont));
        v.setBorder(Rectangle.NO_BORDER);
        v.setPadding(3);
        v.setHorizontalAlignment(Element.ALIGN_RIGHT);
        t.addCell(l);
        t.addCell(v);
    }

    private boolean isNumeric(String header) {
        return switch (header) {
            case "Qty", "Rate", "Taxable", "GST%", "Amount" -> true;
            default -> false;
        };
    }

    private boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private String joinAddress(GoodsReturnDtos.CompanyInfo c) {
        StringBuilder sb = new StringBuilder();
        if (notBlank(c.getAddress())) sb.append(c.getAddress());
        if (notBlank(c.getCity())) { if (sb.length() > 0) sb.append(", "); sb.append(c.getCity()); }
        if (notBlank(c.getState())) { if (sb.length() > 0) sb.append(", "); sb.append(c.getState()); }
        if (notBlank(c.getPinCode())) { if (sb.length() > 0) sb.append(" - "); sb.append(c.getPinCode()); }
        return sb.toString();
    }

    private String fmt(BigDecimal v) {
        return "Rs." + String.format("%.2f", v != null ? v : BigDecimal.ZERO);
    }

    private String trimPct(BigDecimal v) {
        if (v == null) return "0%";
        return v.stripTrailingZeros().toPlainString() + "%";
    }

    private static final String[] ONES = {
        "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
        "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
    };
    private static final String[] TENS = {
        "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
    };

    /** Indian numbering — a debit note is a document the supplier files, so the amount is spelled out. */
    private String inWords(BigDecimal amount) {
        if (amount == null) return "Zero";
        long rupees = amount.setScale(0, java.math.RoundingMode.DOWN).longValue();
        int paise = amount.subtract(BigDecimal.valueOf(rupees))
                .multiply(BigDecimal.valueOf(100)).setScale(0, java.math.RoundingMode.HALF_UP).intValue();

        StringBuilder sb = new StringBuilder();
        sb.append(groupWords(rupees));
        if (paise > 0) sb.append(" and ").append(below1000(paise)).append(" Paise");
        return sb.toString().trim();
    }

    private String groupWords(long n) {
        if (n == 0) return "Zero";
        StringBuilder sb = new StringBuilder();
        long crore = n / 10_000_000; n %= 10_000_000;
        long lakh  = n / 100_000;    n %= 100_000;
        long thou  = n / 1_000;      n %= 1_000;
        if (crore > 0) sb.append(below1000((int) crore)).append(" Crore ");
        if (lakh  > 0) sb.append(below1000((int) lakh)).append(" Lakh ");
        if (thou  > 0) sb.append(below1000((int) thou)).append(" Thousand ");
        if (n     > 0) sb.append(below1000((int) n));
        return sb.toString().trim();
    }

    private String below1000(int n) {
        StringBuilder sb = new StringBuilder();
        if (n >= 100) { sb.append(ONES[n / 100]).append(" Hundred "); n %= 100; }
        if (n >= 20)  { sb.append(TENS[n / 10]).append(" "); n %= 10; }
        if (n > 0)    { sb.append(ONES[n]); }
        return sb.toString().trim();
    }
}
