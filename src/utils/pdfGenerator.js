const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

/**
 * Generate a PDF Certificate
 * @param {Object} certificate - The certificate database document
 * @param {string} qrCodeBase64 - Base64 Data URL of the verification QR code
 * @returns {Promise<Buffer>} - Resolves to the PDF binary buffer
 */
const generateCertificatePDF = (certificate, qrCodeBase64) => {
  return new Promise((resolve, reject) => {
    try {
      // Create landscape A4 document
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 0 // We draw our custom margins
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', (err) => {
        reject(err);
      });

      const width = 841.89; // Landscape A4 dimensions
      const height = 595.27;

      const primaryColor = certificate.templateConfig?.primaryColor || '#2563eb';
      const secondaryColor = certificate.templateConfig?.secondaryColor || '#7c3aed';

      // 1. Draw Modern Background Geometric Patterns (Tech Seal theme)
      doc.save();
      doc.fillColor(primaryColor).opacity(0.04);
      doc.moveTo(0, 0)
         .lineTo(250, 0)
         .lineTo(0, 350)
         .closePath()
         .fill();

      doc.fillColor(secondaryColor).opacity(0.03);
      doc.moveTo(width, height)
         .lineTo(width - 300, height)
         .lineTo(width, height - 400)
         .closePath()
         .fill();

      // Additional elegant geometric accent
      doc.fillColor(primaryColor).opacity(0.02);
      doc.circle(width / 2, height / 2, 180).fill();
      doc.restore();

      // 2. Draw Borders
      // Outer border
      doc.save();
      doc.lineWidth(10);
      doc.rect(15, 15, width - 30, height - 30);
      doc.strokeColor(primaryColor);
      doc.stroke();

      // Inner thin border
      doc.lineWidth(1);
      doc.rect(25, 25, width - 50, height - 50);
      doc.strokeColor(secondaryColor).opacity(0.6);
      doc.stroke();
      doc.restore();

      // 3. Logo/Branding placement (Top Center)
      let logoDrawn = false;
      if (certificate.templateConfig?.logoUrl) {
        try {
          // Check if file path is absolute or needs resolution
          const logoPath = path.isAbsolute(certificate.templateConfig.logoUrl)
            ? certificate.templateConfig.logoUrl
            : path.join(__dirname, '../../', certificate.templateConfig.logoUrl);

          if (fs.existsSync(logoPath)) {
            doc.image(logoPath, width / 2 - 45, 45, { width: 90 });
            logoDrawn = true;
          }
        } catch (e) {
          console.warn('Could not draw certificate logo image:', e.message);
        }
      }

      const topOffset = logoDrawn ? 150 : 90;

      // 4. Institution Title
      doc.save();
      doc.fillColor('#4b5563'); // Dark gray
      doc.font('Helvetica-Bold');
      doc.fontSize(14);
      doc.text(certificate.organization.toUpperCase(), 0, topOffset, {
        align: 'center',
        width: width
      });
      doc.restore();

      // 5. Main Certificate Title
      doc.save();
      doc.fillColor('#1f2937'); // Almost black
      doc.font('Helvetica-Bold');
      doc.fontSize(36);
      doc.text('CERTIFICATE OF ACHIEVEMENT', 0, topOffset + 35, {
        align: 'center',
        width: width,
        characterSpacing: 1.5
      });
      doc.restore();

      // 6. Presentation Text
      doc.save();
      doc.fillColor('#6b7280'); // Medium gray
      doc.font('Helvetica');
      doc.fontSize(12);
      doc.text('THIS IS PROUDLY PRESENTED TO', 0, topOffset + 95, {
        align: 'center',
        width: width
      });
      doc.restore();

      // 7. Recipient Name
      doc.save();
      doc.fillColor(primaryColor);
      doc.font('Helvetica-Bold');
      doc.fontSize(28);
      doc.text(certificate.recipientName, 0, topOffset + 125, {
        align: 'center',
        width: width
      });
      
      // Decorative line under name
      doc.lineWidth(2);
      doc.moveTo(width / 2 - 120, topOffset + 165)
         .lineTo(width / 2 + 120, topOffset + 165)
         .strokeColor(secondaryColor)
         .stroke();
      doc.restore();

      // 8. Description text
      doc.save();
      doc.fillColor('#4b5563');
      doc.font('Helvetica');
      doc.fontSize(13);
      doc.text(
        certificate.templateConfig?.customText || 
        `for successfully fulfilling the qualifications and completing all criteria for the course`,
        50,
        topOffset + 185,
        {
          align: 'center',
          width: width - 100
        }
      );
      doc.restore();

      // 9. Course Name
      doc.save();
      doc.fillColor('#111827');
      doc.font('Helvetica-Bold');
      doc.fontSize(18);
      doc.text(certificate.courseName, 0, topOffset + 215, {
        align: 'center',
        width: width
      });
      doc.restore();

      // 10. Date and Signatures Section (Bottom area)
      const footerY = 460;

      // Date Column (Left)
      doc.save();
      doc.fillColor('#6b7280');
      doc.font('Helvetica');
      doc.fontSize(10);
      doc.text('DATE OF ISSUANCE', 80, footerY);
      doc.fillColor('#1f2937');
      doc.font('Helvetica-Bold');
      doc.fontSize(12);
      const dateStr = new Date(certificate.issueDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      doc.text(dateStr, 80, footerY + 18);
      doc.restore();

      // Signature Column (Right)
      doc.save();
      doc.fillColor('#6b7280');
      doc.font('Helvetica');
      doc.fontSize(10);
      doc.text('AUTHORIZED SIGNATORY', width - 260, footerY, { align: 'right', width: 180 });
      
      // Draw signature line placeholder
      doc.lineWidth(1);
      doc.moveTo(width - 260, footerY - 10)
         .lineTo(width - 80, footerY - 10)
         .strokeColor('#d1d5db')
         .stroke();

      // Fancy placeholder signature text
      doc.fillColor(secondaryColor);
      doc.font('Times-BoldItalic');
      doc.fontSize(16);
      doc.text('Admin Authority', width - 260, footerY - 28, { align: 'center', width: 180 });
      doc.restore();

      // 11. Embed QR code (Bottom Center-ish or Center Left)
      if (qrCodeBase64) {
        try {
          const qrBuffer = Buffer.from(qrCodeBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
          const qrX = width / 2 - 35;
          const qrY = footerY - 30;
          doc.image(qrBuffer, qrX, qrY, { width: 70 });
        } catch (e) {
          console.warn('Could not draw QR code image on PDF:', e.message);
        }
      }

      // 12. Certificate ID and Verification Notice (Footer Center)
      doc.save();
      doc.fillColor('#9ca3af');
      doc.font('Helvetica');
      doc.fontSize(9);
      doc.text(`Certificate ID: ${certificate.certificateId}`, 0, footerY + 50, {
        align: 'center',
        width: width
      });
      doc.text('Verify this certificate online at the official portal', 0, footerY + 62, {
        align: 'center',
        width: width
      });
      doc.restore();

      // Finalize document
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { generateCertificatePDF };
