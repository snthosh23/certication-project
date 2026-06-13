const nodemailer = require('nodemailer');

/**
 * Sends a certificate email with the PDF attached
 * @param {string} to - Recipient email
 * @param {string} name - Recipient name
 * @param {string} certificateId - Unique Certificate ID
 * @param {string} courseName - Course Name
 * @param {Buffer} pdfBuffer - Buffer of the generated PDF
 * @returns {Promise<boolean>} - Success state
 */
const sendCertificateEmail = async (to, name, certificateId, courseName, pdfBuffer) => {
  try {
    let transporter;

    // Check if custom SMTP is defined in environment
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } else {
      // Fallback for development/testing: use ethereal.email
      console.warn('SMTP configuration missing in .env. Creating test email credentials on Ethereal...');
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    }

    const verifyUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/verify.html?id=${certificateId}`;

    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@certificate-verifier.com',
      to: to,
      subject: `Congratulations! Your Certificate for ${courseName} is Ready`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #2563eb; text-align: center;">Certification of Completion</h2>
          <p>Dear <strong>${name}</strong>,</p>
          <p>Congratulations on successfully completing the course <strong>${courseName}</strong>!</p>
          <p>Your unique Certificate ID is <strong>${certificateId}</strong>.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Certificate</a>
          </div>
          <p>We have also attached your official certificate PDF to this email for your records.</p>
          <p>If you have any questions, feel free to contact us.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="font-size: 11px; color: #9ca3af; text-align: center;">This is an automated email from the Digital Certification Authority. Please do not reply directly.</p>
        </div>
      `,
      attachments: [
        {
          filename: `certificate-${certificateId}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email successfully dispatched. MessageId: ${info.messageId}`);
    
    // Log Ethereal preview link if using Ethereal account
    if (!process.env.SMTP_HOST) {
      console.log(`Ethereal Email Preview: ${nodemailer.getTestMessageUrl(info)}`);
    }

    return true;
  } catch (error) {
    console.error('Email Dispatch Error:', error);
    return false;
  }
};

module.exports = { sendCertificateEmail };
