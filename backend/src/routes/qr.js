import express from 'express';
import QRCode from 'qrcode';
import h3 from 'h3-js';

const router = express.Router();

/**
 * QR Code Data Structure:
 * {
 *   "type": "citizen_report",
 *   "cityCode": "CITY-IND-BPL8",
 *   "locationId": "unique-location-id",
 *   "createdAt": "ISO-timestamp"
 * }
 */

// POST /api/v1/qr/generate - Generate QR code for a location
router.post('/generate', async (req, res, next) => {
  try {
    const { cityCode, locationId, latitude, longitude, label } = req.body;

    if (!cityCode || !locationId) {
      return res.status(400).json({
        error: 'ERR_MISSING_FIELDS',
        message: 'cityCode and locationId are required'
      });
    }

    // Validate city code format
    if (!cityCode.match(/^CITY-IND-[A-Z]{3}\d+$/)) {
      return res.status(400).json({
        error: 'ERR_INVALID_CITY_CODE',
        message: 'City code must match format: CITY-IND-XXX (e.g., CITY-IND-BPL8)'
      });
    }

    // Generate H3 index if lat/lon provided
    let h3Index = null;
    if (latitude && longitude) {
      try {
        h3Index = h3.latLngToCell(latitude, longitude, 8);
      } catch (error) {
        console.error('H3 generation error:', error);
      }
    }

    // QR Code Data Structure
    const qrData = {
      type: 'citizen_report',
      cityCode,
      locationId,
      h3Index,
      label: label || `Location ${locationId}`,
      createdAt: new Date().toISOString()
    };

    // Generate QR Code as base64 image
    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
      width: 300,
      margin: 2,
      color: {
        dark: '#1D4ED8',
        light: '#FFFFFF'
      }
    });

    res.json({
      success: true,
      qrCode: qrCodeDataURL,
      data: qrData,
      h3Index
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/qr/batch-generate - Generate multiple QR codes for locations
router.post('/batch-generate', async (req, res, next) => {
  try {
    const { cityCode, locations } = req.body;

    if (!cityCode || !Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({
        error: 'ERR_INVALID_REQUEST',
        message: 'cityCode and locations array are required'
      });
    }

    const qrCodes = await Promise.all(
      locations.map(async (location) => {
        const { locationId, latitude, longitude, label } = location;

        // Generate H3 index if lat/lon provided
        let h3Index = null;
        if (latitude && longitude) {
          try {
            h3Index = h3.latLngToCell(latitude, longitude, 8);
          } catch (error) {
            console.error('H3 generation error:', error);
          }
        }

        const qrData = {
          type: 'citizen_report',
          cityCode,
          locationId,
          h3Index,
          label: label || `Location ${locationId}`,
          createdAt: new Date().toISOString()
        };

        const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
          width: 300,
          margin: 2,
          color: {
            dark: '#1D4ED8',
            light: '#FFFFFF'
          }
        });

        return {
          locationId,
          qrCode: qrCodeDataURL,
          data: qrData,
          h3Index
        };
      })
    );

    res.json({
      success: true,
      count: qrCodes.length,
      qrCodes
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/qr/decode - Decode QR code data (for testing/validation)
router.get('/decode', (req, res) => {
  const { data } = req.query;

  if (!data) {
    return res.status(400).json({
      error: 'ERR_MISSING_DATA',
      message: 'data parameter is required'
    });
  }

  try {
    const decoded = JSON.parse(decodeURIComponent(data));
    res.json({
      success: true,
      decoded
    });
  } catch (error) {
    res.status(400).json({
      error: 'ERR_INVALID_JSON',
      message: 'Invalid JSON data in QR code'
    });
  }
});

export default router;
