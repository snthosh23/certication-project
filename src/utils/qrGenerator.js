const QRCode = require('qrcode');

/**
 * Generate a QR Code as a Data URL (Base64 PNG)
 * @param {string} text - The URL or text to encode
 * @returns {Promise<string>} - Base64 Data URL
 */
const generateQRCode = async (text) => {
  try {
    const options = {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      margin: 1,
      color: {
        dark: '#2563eb', // Blue theme color matching primary
        light: '#ffffff'
      }
    };
    return await QRCode.toDataURL(text, options);
  } catch (err) {
    console.error('QR Generation Error:', err);
    throw err;
  }
};

module.exports = { generateQRCode };
