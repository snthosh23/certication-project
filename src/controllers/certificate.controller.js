const Certificate = require('../models/certificate.model');
const VerificationLog = require('../models/verificationLog.model');
const AuditLog = require('../models/auditLog.model');
const { generateQRCode } = require('../utils/qrGenerator');
const { generateCertificatePDF } = require('../utils/pdfGenerator');
const { sendCertificateEmail } = require('../utils/emailSender');
const fs = require('fs');
const readline = require('readline');

// Utility: Generate Unique Certificate ID
const generateUniqueId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CERT-${timestamp}-${randomStr}`;
};

// 1. Issue Single Certificate
exports.issueCertificate = async (req, res, next) => {
  try {
    const { recipientName, recipientEmail, courseName, organization, expiryDate, templateConfig } = req.body;

    if (!recipientName || !recipientEmail || !courseName) {
      return res.status(400).json({ success: false, message: 'Recipient name, email, and course name are required' });
    }

    const certificateId = generateUniqueId();
    
    // Create base verification link
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const verificationUrl = `${baseUrl}/verify.html?id=${certificateId}`;

    // Generate QR Code
    const qrCodeUrl = await generateQRCode(verificationUrl);

    // Setup template config (support uploaded files)
    const finalTemplate = {
      templateId: templateConfig?.templateId || 'default',
      backgroundColor: templateConfig?.backgroundColor || '#ffffff',
      primaryColor: templateConfig?.primaryColor || '#2563eb',
      secondaryColor: templateConfig?.secondaryColor || '#7c3aed',
      customText: templateConfig?.customText || '',
      logoUrl: req.files?.logo ? `uploads/${req.files.logo[0].filename}` : templateConfig?.logoUrl || '',
      backgroundImageUrl: req.files?.backgroundImage ? `uploads/${req.files.backgroundImage[0].filename}` : templateConfig?.backgroundImageUrl || ''
    };

    const certificate = await Certificate.create({
      certificateId,
      recipientName,
      recipientEmail,
      courseName,
      organization: organization || 'Digital Certification Authority',
      expiryDate: expiryDate || null,
      qrCodeUrl,
      issuedBy: req.user._id,
      templateConfig: finalTemplate
    });

    // Create Audit Log
    await AuditLog.create({
      userId: req.user._id,
      username: req.user.username,
      action: 'ISSUE_CERTIFICATE',
      targetType: 'Certificate',
      targetId: certificateId,
      details: `Issued to ${recipientName} (${recipientEmail}) for ${courseName}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.status(201).json({
      success: true,
      message: 'Certificate issued successfully',
      certificate
    });
  } catch (error) {
    next(error);
  }
};

// 2. Bulk Issue Certificates via CSV Upload
exports.bulkIssueCertificates = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a CSV file' });
    }

    const filePath = req.file.path;
    const certificatesToCreate = [];
    const errors = [];
    
    // Parse CSV line by line
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let isHeader = true;
    let headers = [];

    for await (const line of rl) {
      if (!line.trim()) continue;

      const columns = line.split(',').map(col => col.trim().replace(/^["']|["']$/g, '')); // split and clean quotes

      if (isHeader) {
        headers = columns.map(h => h.toLowerCase());
        isHeader = false;
        continue;
      }

      // Map columns
      const rowData = {};
      headers.forEach((header, index) => {
        rowData[header] = columns[index];
      });

      const recipientName = rowData['name'] || rowData['recipientname'] || rowData['recipient_name'];
      const recipientEmail = rowData['email'] || rowData['recipientemail'] || rowData['recipient_email'];
      const courseName = rowData['course'] || rowData['coursename'] || rowData['course_name'] || rowData['title'];
      const organization = rowData['organization'] || rowData['org'] || 'Digital Certification Authority';

      if (!recipientName || !recipientEmail || !courseName) {
        errors.push(`Row format invalid: Missing recipient name, email, or course name. Row content: ${line}`);
        continue;
      }

      const certificateId = generateUniqueId();
      const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
      const verificationUrl = `${baseUrl}/verify.html?id=${certificateId}`;

      // Generate QR Code async later inside map, or wait sequentially
      const qrCodeUrl = await generateQRCode(verificationUrl);

      certificatesToCreate.push({
        certificateId,
        recipientName,
        recipientEmail,
        courseName,
        organization,
        qrCodeUrl,
        issuedBy: req.user._id,
        templateConfig: {
          templateId: 'default',
          backgroundColor: '#ffffff',
          primaryColor: '#2563eb',
          secondaryColor: '#7c3aed'
        }
      });
    }

    // Clean up uploaded CSV file
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error('CSV cleanup failed:', err);
    }

    if (certificatesToCreate.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid records found in the CSV file',
        errors
      });
    }

    // Bulk write to MongoDB
    const createdCertificates = await Certificate.insertMany(certificatesToCreate);

    // Create Audit Log
    await AuditLog.create({
      userId: req.user._id,
      username: req.user.username,
      action: 'BULK_ISSUE_CERTIFICATES',
      targetType: 'Certificate',
      targetId: `${createdCertificates.length} certs`,
      details: `Bulk issued ${createdCertificates.length} certificates via CSV. Failed rows: ${errors.length}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.status(201).json({
      success: true,
      message: `Successfully issued ${createdCertificates.length} certificates`,
      count: createdCertificates.length,
      errors: errors.length > 0 ? errors : null
    });
  } catch (error) {
    next(error);
  }
};

// 3. Edit Certificate Details
exports.updateCertificate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { recipientName, recipientEmail, courseName, organization, expiryDate, status } = req.body;

    const cert = await Certificate.findOne({ certificateId: id });
    if (!cert) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }

    // Update details
    if (recipientName) cert.recipientName = recipientName;
    if (recipientEmail) cert.recipientEmail = recipientEmail;
    if (courseName) cert.courseName = courseName;
    if (organization) cert.organization = organization;
    if (expiryDate !== undefined) cert.expiryDate = expiryDate || null;
    if (status) cert.status = status;

    await cert.save();

    // Create Audit Log
    await AuditLog.create({
      userId: req.user._id,
      username: req.user.username,
      action: 'UPDATE_CERTIFICATE',
      targetType: 'Certificate',
      targetId: id,
      details: `Updated details for certificate ID: ${id}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.status(200).json({
      success: true,
      message: 'Certificate updated successfully',
      certificate: cert
    });
  } catch (error) {
    next(error);
  }
};

// 4. Revoke Certificate
exports.revokeCertificate = async (req, res, next) => {
  try {
    const { id } = req.params;

    const cert = await Certificate.findOne({ certificateId: id });
    if (!cert) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }

    cert.status = 'Revoked';
    await cert.save();

    // Create Audit Log
    await AuditLog.create({
      userId: req.user._id,
      username: req.user.username,
      action: 'REVOKE_CERTIFICATE',
      targetType: 'Certificate',
      targetId: id,
      details: `Revoked certificate ID: ${id}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.status(200).json({
      success: true,
      message: `Certificate ${id} has been revoked`,
      certificate: cert
    });
  } catch (error) {
    next(error);
  }
};

// 5. Delete Certificate
exports.deleteCertificate = async (req, res, next) => {
  try {
    const { id } = req.params;

    const cert = await Certificate.findOneAndDelete({ certificateId: id });
    if (!cert) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }

    // Create Audit Log
    await AuditLog.create({
      userId: req.user._id,
      username: req.user.username,
      action: 'DELETE_CERTIFICATE',
      targetType: 'Certificate',
      targetId: id,
      details: `Deleted certificate ID: ${id} (Recipient: ${cert.recipientName})`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.status(200).json({
      success: true,
      message: `Certificate ${id} has been deleted permanently`
    });
  } catch (error) {
    next(error);
  }
};

// 6. Public Verify Certificate (No auth required)
exports.verifyCertificate = async (req, res, next) => {
  try {
    const { id } = req.params;

    const cert = await Certificate.findOne({ certificateId: id })
      .populate('issuedBy', 'username email');

    if (!cert) {
      // Log failed verification attempt
      await VerificationLog.create({
        certificateId: id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Unknown',
        status: 'Failed',
        details: 'Certificate ID not found'
      });

      return res.status(404).json({
        success: false,
        valid: false,
        message: 'Invalid Certificate. This Certificate ID does not exist in our registry.'
      });
    }

    // Increment verification count
    cert.verificationCount += 1;
    await cert.save();

    const isExpired = cert.expiryDate ? new Date(cert.expiryDate) < new Date() : false;
    const isValid = cert.status === 'Valid' && !isExpired;

    // Log verification hit
    await VerificationLog.create({
      certificateId: id,
      certificateRef: cert._id,
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'Unknown',
      status: 'Success',
      details: isValid ? 'Certificate is Valid' : (isExpired ? 'Certificate has Expired' : 'Certificate is Revoked')
    });

    res.status(200).json({
      success: true,
      valid: isValid,
      status: isExpired ? 'Expired' : cert.status,
      certificate: {
        certificateId: cert.certificateId,
        recipientName: cert.recipientName,
        courseName: cert.courseName,
        organization: cert.organization,
        issueDate: cert.issueDate,
        expiryDate: cert.expiryDate,
        qrCodeUrl: cert.qrCodeUrl,
        verificationCount: cert.verificationCount,
        issuedBy: cert.issuedBy?.username || 'System'
      }
    });
  } catch (error) {
    next(error);
  }
};

// 7. Get Certificates (Admin query with pagination/search/filtering)
exports.getCertificates = async (req, res, next) => {
  try {
    const { search, status, course, page = 1, limit = 10 } = req.query;

    const query = {};

    // Search matches recipient name, email, or certificate ID
    if (search) {
      query.$or = [
        { certificateId: { $regex: search, $options: 'i' } },
        { recipientName: { $regex: search, $options: 'i' } },
        { recipientEmail: { $regex: search, $options: 'i' } }
      ];
    }

    // Status filter
    if (status) {
      if (status === 'Expired') {
        query.expiryDate = { $lt: new Date() };
      } else {
        query.status = status;
      }
    }

    // Course filter
    if (course) {
      query.courseName = { $regex: course, $options: 'i' };
    }

    const skipIdx = (page - 1) * limit;
    const total = await Certificate.countDocuments(query);
    const certificates = await Certificate.find(query)
      .populate('issuedBy', 'username email')
      .sort({ createdAt: -1 })
      .skip(skipIdx)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: certificates.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      certificates
    });
  } catch (error) {
    next(error);
  }
};

// 8. Download Certificate PDF (Publicly accessible)
exports.downloadPDF = async (req, res, next) => {
  try {
    const { id } = req.params;

    const cert = await Certificate.findOne({ certificateId: id });
    if (!cert) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }

    // Generate PDF Binary
    const pdfBuffer = await generateCertificatePDF(cert, cert.qrCodeUrl);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=certificate-${id}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

// 9. Send Certificate via Email
exports.sendEmail = async (req, res, next) => {
  try {
    const { id } = req.params;

    const cert = await Certificate.findOne({ certificateId: id });
    if (!cert) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }

    // Generate PDF Binary
    const pdfBuffer = await generateCertificatePDF(cert, cert.qrCodeUrl);

    // Send email
    const success = await sendCertificateEmail(
      cert.recipientEmail,
      cert.recipientName,
      cert.certificateId,
      cert.courseName,
      pdfBuffer
    );

    if (!success) {
      return res.status(500).json({ success: false, message: 'Failed to send certificate email. Check SMTP settings.' });
    }

    // Audit log
    await AuditLog.create({
      userId: req.user._id,
      username: req.user.username,
      action: 'EMAIL_CERTIFICATE',
      targetType: 'Certificate',
      targetId: id,
      details: `Emailed certificate to ${cert.recipientEmail}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.status(200).json({
      success: true,
      message: `Certificate has been emailed successfully to ${cert.recipientEmail}`
    });
  } catch (error) {
    next(error);
  }
};

// 10. Export Excel/CSV Report of issued certificates
exports.exportCSV = async (req, res, next) => {
  try {
    const certificates = await Certificate.find({}).populate('issuedBy', 'username');
    
    // Construct CSV Header
    let csv = 'Certificate ID,Recipient Name,Recipient Email,Course,Organization,Issue Date,Status,Verifications,Issued By\n';
    
    certificates.forEach(c => {
      const issueDate = new Date(c.issueDate).toISOString().split('T')[0];
      const issuer = c.issuedBy?.username || 'System';
      csv += `"${c.certificateId}","${c.recipientName.replace(/"/g, '""')}","${c.recipientEmail}","${c.courseName.replace(/"/g, '""')}","${c.organization.replace(/"/g, '""')}","${issueDate}","${c.status}",${c.verificationCount},"${issuer}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=certificates-report.csv');
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};
