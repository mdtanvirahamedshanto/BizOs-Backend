import PDFDocument from 'pdfkit';

export class PdfService {
  /**
   * Generates a premium, business-grade PDF invoice buffer.
   */
  static async generateInvoice(sale: any, shop: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err) => reject(err));

        const currency = shop.currency || 'BDT';
        const formatCurrency = (cents: number) => {
          return `${(cents / 100).toFixed(2)} ${currency}`;
        };

        const formatDate = (date: Date) => {
          return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        };

        // ==========================================
        // 1. BRANDING & HEADER BLOCK
        // ==========================================
        
        // Draw Accent Primary Block (Initials logo box)
        doc.rect(50, 45, 50, 50).fill('#2B3E50');
        doc.fillColor('#FFFFFF')
           .font('Helvetica-Bold')
           .fontSize(20)
           .text(shop.name.substring(0, 2).toUpperCase(), 50, 60, { width: 50, align: 'center' });

        // Shop Details (Right aligned)
        doc.fillColor('#333333')
           .font('Helvetica-Bold')
           .fontSize(16)
           .text(shop.name, 120, 45, { align: 'left' });

        doc.font('Helvetica')
           .fontSize(9)
           .fillColor('#7F8C8D');

        const addressObj = typeof shop.address === 'string' ? JSON.parse(shop.address || '{}') : shop.address;
        const street = addressObj?.street || '';
        const city = addressObj?.city || '';
        const country = addressObj?.country || '';
        const addressStr = [street, city, country].filter(Boolean).join(', ');

        doc.text(addressStr || 'Address details not provided', 120, 65)
           .text(`Phone: ${shop.phone || 'N/A'}  |  Email: ${shop.email || 'N/A'}`, 120, 78);

        // Header Border
        doc.strokeColor('#BDC3C7')
           .lineWidth(1)
           .moveTo(50, 110)
           .lineTo(545, 110)
           .stroke();

        // ==========================================
        // 2. INVOICE META & CLIENT METADATA
        // ==========================================
        
        // Left Column: Bill To
        doc.fillColor('#2B3E50')
           .font('Helvetica-Bold')
           .fontSize(10)
           .text('BILL TO:', 50, 130);

        doc.fillColor('#333333')
           .font('Helvetica-Bold')
           .fontSize(11)
           .text(sale.customer ? sale.customer.name : 'Walk-in Customer', 50, 145);

        if (sale.customer) {
          doc.font('Helvetica')
             .fontSize(9)
             .fillColor('#7F8C8D')
             .text(`Phone: ${sale.customer.phone || 'N/A'}`, 50, 160)
             .text(`Email: ${sale.customer.email || 'N/A'}`, 50, 172);
        }

        // Right Column: Invoice Specs
        doc.fillColor('#2B3E50')
           .font('Helvetica-Bold')
           .fontSize(10)
           .text('INVOICE DETAILS:', 350, 130);

        doc.font('Helvetica')
           .fontSize(9)
           .fillColor('#333333')
           .text(`Invoice No:`, 350, 145)
           .font('Helvetica-Bold')
           .text(sale.invoiceNumber, 430, 145)
           .font('Helvetica')
           .text(`Date:`, 350, 158)
           .text(formatDate(sale.saleDate), 430, 158)
           .text(`Cashier:`, 350, 171)
           .text(sale.cashier ? sale.cashier.name : 'System', 430, 171)
           .text(`Status:`, 350, 184)
           .font('Helvetica-Bold')
           .fillColor(sale.status === 'COMPLETED' ? '#27AE60' : '#E74C3C')
           .text(sale.status, 430, 184);

        // Move cursor down
        let y = 220;

        // ==========================================
        // 3. TABLE GRID FOR ITEMS
        // ==========================================
        
        // Draw Table Header Background
        doc.rect(50, y, 495, 20).fill('#2B3E50');
        
        // Draw Header Text
        doc.fillColor('#FFFFFF')
           .font('Helvetica-Bold')
           .fontSize(9)
           .text('Product / Service', 60, y + 6, { width: 190 })
           .text('Unit Price', 250, y + 6, { width: 70, align: 'right' })
           .text('Qty', 330, y + 6, { width: 40, align: 'center' })
           .text('Discount', 380, y + 6, { width: 70, align: 'right' })
           .text('Total', 460, y + 6, { width: 75, align: 'right' });

        y += 20;

        // Draw Table Rows
        doc.fillColor('#333333').font('Helvetica').fontSize(9);

        let isAlt = false;
        for (const item of sale.items) {
          // Wrap safety check for pagination page breaks
          if (y > 700) {
            doc.addPage();
            y = 50;
            // Redraw header on new page
            doc.rect(50, y, 495, 20).fill('#2B3E50');
            doc.fillColor('#FFFFFF')
               .font('Helvetica-Bold')
               .text('Product / Service', 60, y + 6, { width: 190 })
               .text('Unit Price', 250, y + 6, { width: 70, align: 'right' })
               .text('Qty', 330, y + 6, { width: 40, align: 'center' })
               .text('Discount', 380, y + 6, { width: 70, align: 'right' })
               .text('Total', 460, y + 6, { width: 75, align: 'right' });
            y += 20;
            doc.fillColor('#333333').font('Helvetica');
          }

          // Shading for alternating rows
          if (isAlt) {
            doc.rect(50, y, 495, 20).fill('#F9FAFC');
            doc.fillColor('#333333');
          }
          isAlt = !isAlt;

          doc.text(item.productName, 60, y + 6, { width: 190, lineBreak: false })
             .text(formatCurrency(item.unitPriceCents), 250, y + 6, { width: 70, align: 'right' })
             .text(String(item.quantity), 330, y + 6, { width: 40, align: 'center' })
             .text(formatCurrency(item.discountCents), 380, y + 6, { width: 70, align: 'right' })
             .text(formatCurrency(item.totalCents), 460, y + 6, { width: 75, align: 'right' });

          // Thin border below row
          doc.strokeColor('#ECEFF1')
             .lineWidth(0.5)
             .moveTo(50, y + 20)
             .lineTo(545, y + 20)
             .stroke();

          y += 20;
        }

        y += 10;

        // ==========================================
        // 4. BREAKDOWN / TOTALS SECTION
        // ==========================================
        
        // Right side calculations
        doc.fillColor('#7F8C8D')
           .font('Helvetica')
           .fontSize(9);

        // Subtotal row
        doc.text('Subtotal:', 350, y)
           .font('Helvetica-Bold')
           .fillColor('#333333')
           .text(formatCurrency(sale.subtotalCents), 460, y, { align: 'right' });

        y += 15;

        // Discount row
        if (sale.discountCents > 0) {
          doc.fillColor('#7F8C8D')
             .font('Helvetica')
             .text('Discount:', 350, y)
             .font('Helvetica-Bold')
             .fillColor('#C0392B')
             .text(`- ${formatCurrency(sale.discountCents)}`, 460, y, { align: 'right' });
          y += 15;
        }

        // Tax row
        if (sale.taxCents > 0) {
          doc.fillColor('#7F8C8D')
             .font('Helvetica')
             .text('Tax (VAT):', 350, y)
             .font('Helvetica-Bold')
             .fillColor('#333333')
             .text(formatCurrency(sale.taxCents), 460, y, { align: 'right' });
          y += 15;
        }

        // Divider
        doc.strokeColor('#BDC3C7')
           .lineWidth(1)
           .moveTo(350, y + 2)
           .lineTo(545, y + 2)
           .stroke();

        y += 8;

        // Grand Total Row
        doc.fillColor('#2B3E50')
           .font('Helvetica-Bold')
           .fontSize(11)
           .text('Grand Total:', 350, y)
           .text(formatCurrency(sale.totalCents), 460, y, { align: 'right' });

        y += 20;

        // Paid Cents
        doc.fillColor('#27AE60')
           .font('Helvetica-Bold')
           .fontSize(9)
           .text('Amount Paid:', 350, y)
           .text(formatCurrency(sale.paidCents), 460, y, { align: 'right' });

        y += 15;

        // Due Cents
        doc.fillColor(sale.dueCents > 0 ? '#C0392B' : '#7F8C8D')
           .font('Helvetica-Bold')
           .text('Due Outstanding:', 350, y)
           .text(formatCurrency(sale.dueCents), 460, y, { align: 'right' });

        // Left side notes
        if (sale.notes) {
          doc.fillColor('#2B3E50')
             .font('Helvetica-Bold')
             .fontSize(8)
             .text('NOTES / MEMO:', 50, y - 55);
          doc.fillColor('#7F8C8D')
             .font('Helvetica')
             .fontSize(8)
             .text(sale.notes, 50, y - 43, { width: 260 });
        }

        // ==========================================
        // 5. RECEIPT FOOTER BLOCK
        // ==========================================
        
        // Sticky Footer at the bottom
        const footerY = 750;
        doc.strokeColor('#BDC3C7')
           .lineWidth(0.5)
           .moveTo(50, footerY)
           .lineTo(545, footerY)
           .stroke();

        const receiptMessage = shop.settings?.receiptMessage || 'Thank you for your business! Please visit us again.';
        doc.fillColor('#7F8C8D')
           .font('Helvetica')
           .fontSize(8)
           .text(receiptMessage, 50, footerY + 10, { align: 'center', width: 495 });

        doc.text('This is a computer-generated invoice and requires no signature.', 50, footerY + 22, { align: 'center', width: 495 });

        // Complete document stream
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
