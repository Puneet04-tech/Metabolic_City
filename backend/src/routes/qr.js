import express from 'express';
import QRCode from 'qrcode';
import h3 from 'h3-js';
import { protect, authorize } from '../middleware/auth.js';
import { normalizeCityCode } from '../services/cityConfig.js';

const router = express.Router();

// Both code families are accepted: CITY-MP-BPL (pipeline) and CITY-IND-BPL8
// (operator accounts and existing printed codes).
const CITY_CODE_PATTERN = /^CITY-[A-Z]{2,3}-[A-Z0-9]{2,8}$/;

function normalizeCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { latitude: lat, longitude: lon };
}

/**
 * QR Code Data Structure:
 * {
 *   "type": "citizen_report",
 *   "cityCode": "CITY-IND-BPL8",
 *   "locationId": "unique-location-id",
 *   "createdAt": "ISO-timestamp"
 * }
 */

// Get frontend URL from environment or use default
const getFrontendUrl = () => {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
};

// POST /api/v1/qr/generate - Generate QR code for a location
router.post('/generate', protect, authorize('operator', 'admin'), async (req, res, next) => {
  try {
    const { cityCode, locationId, label } = req.body;
    const normalizedCityCode = normalizeCityCode(cityCode);

    if (!normalizedCityCode || !locationId) {
      return res.status(400).json({
        error: 'ERR_MISSING_FIELDS',
        message: 'cityCode and locationId are required'
      });
    }

    // Validate city code format
    if (!CITY_CODE_PATTERN.test(normalizedCityCode)) {
      return res.status(400).json({
        error: 'ERR_INVALID_CITY_CODE',
        message: 'City code must look like CITY-MP-BPL or CITY-IND-BPL8.'
      });
    }

    const coords = normalizeCoordinates(req.body.latitude, req.body.longitude);

    // Generate H3 index if lat/lon provided
    let h3Index = null;
    if (coords) {
      try {
        h3Index = h3.latLngToCell(coords.latitude, coords.longitude, 8);
      } catch (error) {
        console.error('H3 generation error:', error);
      }
    }

    // QR Code Data Structure. Coordinates travel with the code so a resident
    // can report without enabling geolocation.
    const qrData = {
      type: 'citizen_report',
      cityCode: normalizedCityCode,
      locationId,
      h3Index,
      ...(coords || {}),
      label: label || `Location ${locationId}`,
      createdAt: new Date().toISOString()
    };

    // Encode the data as a URL query parameter
    const encodedData = encodeURIComponent(JSON.stringify(qrData));
    const reportUrl = `${getFrontendUrl()}/citizen-report?data=${encodedData}`;

    // Generate QR Code as base64 image (encodes the URL, not just JSON)
    const qrCodeDataURL = await QRCode.toDataURL(reportUrl, {
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
      reportUrl,
      data: qrData,
      h3Index
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/qr/batch-generate - Generate multiple QR codes for locations
router.post('/batch-generate', protect, authorize('operator', 'admin'), async (req, res, next) => {
  try {
    const { locations } = req.body;
    const normalizedCityCode = normalizeCityCode(req.body.cityCode);

    if (!normalizedCityCode || !Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({
        error: 'ERR_INVALID_REQUEST',
        message: 'cityCode and locations array are required'
      });
    }

    if (!CITY_CODE_PATTERN.test(normalizedCityCode)) {
      return res.status(400).json({
        error: 'ERR_INVALID_CITY_CODE',
        message: 'City code must look like CITY-MP-BPL or CITY-IND-BPL8.'
      });
    }

    const frontendUrl = getFrontendUrl();

    const qrCodes = await Promise.all(
      locations.map(async (location) => {
        const { locationId, label } = location;
        const coords = normalizeCoordinates(location.latitude, location.longitude);

        // Generate H3 index if lat/lon provided
        let h3Index = null;
        if (coords) {
          try {
            h3Index = h3.latLngToCell(coords.latitude, coords.longitude, 8);
          } catch (error) {
            console.error('H3 generation error:', error);
          }
        }

        const qrData = {
          type: 'citizen_report',
          cityCode: normalizedCityCode,
          locationId,
          h3Index,
          ...(coords || {}),
          label: label || `Location ${locationId}`,
          createdAt: new Date().toISOString()
        };

        // Encode the data as a URL query parameter
        const encodedData = encodeURIComponent(JSON.stringify(qrData));
        const reportUrl = `${frontendUrl}/citizen-report?data=${encodedData}`;

        // Generate QR Code as base64 image (encodes the URL, not just JSON)
        const qrCodeDataURL = await QRCode.toDataURL(reportUrl, {
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
          reportUrl,
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
