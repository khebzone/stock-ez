package com.stockez.api.module.invoice;

import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import com.lowagie.text.pdf.draw.LineSeparator;
import com.stockez.api.module.order.dto.OrderDtos;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;

@Service
public class PaymentReceiptPdfService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy");

    public byte[] generateBytes(OrderDtos.PublicPaymentReceiptResponse data) throws IOException {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            generatePdf(data, baos);
            return baos.toByteArray();
        }
    }

    private void generatePdf(OrderDtos.PublicPaymentReceiptResponse data, OutputStream out) throws IOException {
        OrderDtos.CompanyInfo company = data.getCompany();

        Document doc = new Document(PageSize.A5, 30, 30, 30, 30);
        try {
            PdfWriter.getInstance(doc, out);
            doc.open();

            Font titleFont       = new Font(Font.HELVETICA, 15, Font.BOLD, new Color(30, 30, 30));
            Font receiptLabelFont = new Font(Font.HELVETICA, 13, Font.BOLD, new Color(30, 30, 30));
            Font sectionFont     = new Font(Font.HELVETICA, 9, Font.BOLD, new Color(80, 80, 80));
            Font normalFont      = new Font(Font.HELVETICA, 10, Font.NORMAL, new Color(50, 50, 50));
            Font boldFont        = new Font(Font.HELVETICA, 10, Font.BOLD, new Color(30, 30, 30));
            Font amountFont      = new Font(Font.HELVETICA, 22, Font.BOLD, new Color(5, 150, 105));

            // Header: company + receipt label
            PdfPTable header = new PdfPTable(2);
            header.setWidthPercentage(100);
            header.setWidths(new float[]{60, 40});
            header.setSpacingAfter(8);

            PdfPCell companyCell = new PdfPCell();
            companyCell.setBorder(Rectangle.NO_BORDER);
            companyCell.addElement(new Phrase(company.getName(), titleFont));
            if (company.getPhone() != null) companyCell.addElement(new Phrase("Ph: " + company.getPhone(), normalFont));
            String addr = buildAddress(company.getAddress(), company.getCity(), company.getState(), company.getPinCode());
            if (!addr.isBlank()) companyCell.addElement(new Phrase(addr, normalFont));
            header.addCell(companyCell);

            PdfPCell receiptLabelCell = new PdfPCell();
            receiptLabelCell.setBorder(Rectangle.NO_BORDER);
            receiptLabelCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
            receiptLabelCell.addElement(new Phrase("PAYMENT RECEIPT", receiptLabelFont));
            String date = data.getCollectionDate() != null ? data.getCollectionDate().format(DATE_FMT) : "";
            receiptLabelCell.addElement(new Phrase("Date: " + date, normalFont));
            header.addCell(receiptLabelCell);
            doc.add(header);

            addLine(doc);

            // Received From
            Paragraph receivedFromLabel = new Paragraph("RECEIVED FROM", sectionFont);
            receivedFromLabel.setSpacingBefore(8);
            doc.add(receivedFromLabel);
            if (data.getCustomer() != null) {
                OrderDtos.CustomerInfo cust = data.getCustomer();
                if (cust.getBusinessName() != null) doc.add(new Paragraph(cust.getBusinessName(), boldFont));
                if (cust.getPhone() != null) doc.add(new Paragraph("Ph: " + cust.getPhone(), normalFont));
            }

            // Amount — the headline
            Paragraph amountLabel = new Paragraph("AMOUNT RECEIVED", sectionFont);
            amountLabel.setSpacingBefore(14);
            doc.add(amountLabel);
            Paragraph amountPara = new Paragraph(fmt(data.getAmount()), amountFont);
            amountPara.setSpacingBefore(2);
            doc.add(amountPara);

            Paragraph spacer = new Paragraph(" ");
            spacer.setSpacingBefore(6);
            doc.add(spacer);
            addLine(doc);

            // Details table
            PdfPTable details = new PdfPTable(2);
            details.setWidthPercentage(100);
            details.setWidths(new float[]{40, 60});
            details.setSpacingBefore(8);

            addDetailRow(details, "Payment Mode", data.getPaymentMethodName() != null && !data.getPaymentMethodName().isBlank() ? data.getPaymentMethodName() : data.getPaymentMode(), sectionFont, normalFont);
            if (data.getReferenceNumber() != null && !data.getReferenceNumber().isBlank()) {
                addDetailRow(details, "Reference No.", data.getReferenceNumber(), sectionFont, normalFont);
            }
            if (data.getOrderNumber() != null) {
                addDetailRow(details, "Against Order", data.getOrderNumber(), sectionFont, normalFont);
            }
            if (data.getCollectedByName() != null) {
                addDetailRow(details, "Collected By", data.getCollectedByName(), sectionFont, normalFont);
            }
            doc.add(details);

            addLine(doc);
            Paragraph footer = new Paragraph("Thank you for your payment.", new Font(Font.HELVETICA, 8, Font.ITALIC, new Color(120, 120, 120)));
            footer.setAlignment(Element.ALIGN_CENTER);
            footer.setSpacingBefore(10);
            doc.add(footer);

        } catch (Exception e) {
            if (doc.isOpen()) doc.close();
            throw new IOException("PDF generation failed: " + e.getMessage(), e);
        }
        if (doc.isOpen()) doc.close();
    }

    private void addLine(Document doc) throws DocumentException {
        LineSeparator line = new LineSeparator();
        line.setLineColor(new Color(200, 200, 200));
        doc.add(new Chunk(line));
    }

    private void addDetailRow(PdfPTable table, String label, String value, Font labelFont, Font valueFont) {
        PdfPCell labelCell = new PdfPCell(new Phrase(label, labelFont));
        labelCell.setBorder(Rectangle.NO_BORDER);
        labelCell.setPadding(3);
        PdfPCell valueCell = new PdfPCell(new Phrase(value, valueFont));
        valueCell.setBorder(Rectangle.NO_BORDER);
        valueCell.setPadding(3);
        table.addCell(labelCell);
        table.addCell(valueCell);
    }

    private String fmt(BigDecimal val) {
        if (val == null) return "Rs.0.00";
        return "Rs." + String.format("%.2f", val);
    }

    private String buildAddress(String address, String city, String state, String pin) {
        StringBuilder sb = new StringBuilder();
        if (address != null && !address.isBlank()) sb.append(address);
        if (city != null && !city.isBlank()) { if (sb.length() > 0) sb.append(", "); sb.append(city); }
        if (state != null && !state.isBlank()) { if (sb.length() > 0) sb.append(", "); sb.append(state); }
        if (pin != null && !pin.isBlank()) { if (sb.length() > 0) sb.append(" - "); sb.append(pin); }
        return sb.toString();
    }
}
