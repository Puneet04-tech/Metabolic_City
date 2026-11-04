# Citizen QR Code Reporting System

## Overview

The Citizen QR Code Reporting System allows citizens to scan QR codes placed at specific locations to report municipal issues directly to the Metabolic City AI platform. Reports are automatically processed, converted to H3 cells, and displayed in the Operator Console for review and action.

## How It Works

### 1. QR Code Generation (Admin)

Administrators generate QR codes for specific locations using the **QR Generator** in the Admin Console:

**QR Code Data Structure:**
```json
{
  "type": "citizen_report",
  "cityCode": "CITY-IND-BPL8",
  "locationId": "LOC-001",
  "h3Index": "8928308280ffff",
  "label": "New Market Area",
  "createdAt": "2026-10-12T00:00:00.000Z"
}
```

**Steps:**
1. Log in as Administrator
2. Go to Admin Console → QR Codes tab
3. Select city code (Bhopal, Indore, or Sehore)
4. Add locations with:
   - Location ID (e.g., LOC-001)
   - Latitude (optional - for H3 cell calculation)
   - Longitude (optional - for H3 cell calculation)
   - Label (e.g., "New Market Area")
5. Click "Generate QR Codes"
6. Download individual QR codes or all at once
7. Print and place QR codes at physical locations

### 2. Citizen Reporting (Public)

Citizens scan QR codes using their phone's camera or QR scanner app:

**Steps:**
1. Scan QR code at location
2. QR code redirects to: `http://your-domain.com/citizen-report?data=<encoded-json>`
3. Citizen fills out the report form:
   - Problem Category (Infrastructure, Traffic, Flood, Sanitation, Emergency, Other)
   - Urgency Level (Low, Medium, High, Critical)
   - Description of the problem
4. System automatically captures GPS location (with permission)
5. Citizen submits the report

### 3. Data Processing (Backend)

When a citizen submits a report:

1. **Telemetry Ingestion:**
   - Report is sent to `POST /api/v1/telemetry/citizen`
   - Data includes: category, urgency, description, GPS location, location ID, city code

2. **H3 Cell Calculation:**
   - If GPS coordinates are provided, H3 index is calculated at resolution 8
   - If QR code has pre-calculated H3 index, it's used
   - Cell is created or updated in the `SpatialCell` collection

3. **Risk Scoring:**
   - Citizen reports contribute to the cell's risk score
   - High urgency reports increase risk more than low urgency
   - Reports are logged for analytics

4. **Operator Notification:**
   - If cell risk exceeds threshold (7), it appears as critical in Operator Console
   - Operators can view the citizen report details
   - Operators can approve, dispatch, or take action

### 4. Operator Action (Operator Console)

Operators see citizen reports in the Operator Console:

**Steps:**
1. Critical cells appear on the map with red indicators
2. Click on a cell to view details
3. Action drawer shows:
   - Cell risk score
   - Recent citizen reports
   - Recommended actions
4. Operator can:
   - Claim 60-second lock
   - Approve & Dispatch to field crew
   - Override with custom action

## API Endpoints

### QR Code Generation

**POST /api/v1/qr/generate**
Generate a single QR code for a location.

**Request Body:**
```json
{
  "cityCode": "CITY-IND-BPL8",
  "locationId": "LOC-001",
  "latitude": 23.2599,
  "longitude": 77.4126,
  "label": "New Market Area"
}
```

**Response:**
```json
{
  "success": true,
  "qrCode": "data:image/png;base64,...",
  "data": {
    "type": "citizen_report",
    "cityCode": "CITY-IND-BPL8",
    "locationId": "LOC-001",
    "h3Index": "8928308280ffff",
    "label": "New Market Area",
    "createdAt": "2026-10-12T00:00:00.000Z"
  },
  "h3Index": "8928308280ffff"
}
```

**POST /api/v1/qr/batch-generate**
Generate multiple QR codes for multiple locations.

**Request Body:**
```json
{
  "cityCode": "CITY-IND-BPL8",
  "locations": [
    {
      "locationId": "LOC-001",
      "latitude": 23.2599,
      "longitude": 77.4126,
      "label": "New Market Area"
    },
    {
      "locationId": "LOC-002",
      "latitude": 23.2650,
      "longitude": 77.4200,
      "label": "Railway Station"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "qrCodes": [
    {
      "locationId": "LOC-001",
      "qrCode": "data:image/png;base64,...",
      "data": {...},
      "h3Index": "8928308280ffff"
    },
    {
      "locationId": "LOC-002",
      "qrCode": "data:image/png;base64,...",
      "data": {...},
      "h3Index": "8928308280fffb"
    }
  ]
}
```

### Citizen Reporting

**POST /api/v1/telemetry/citizen**
Submit a citizen report.

**Request Body:**
```json
{
  "sourceType": "citizen",
  "latitude": 23.2599,
  "longitude": 77.4126,
  "observedAt": "2026-10-12T00:00:00.000Z",
  "reportText": "Large pothole on main road",
  "category": "infrastructure",
  "urgency": "high",
  "locationId": "LOC-001",
  "cityCode": "CITY-IND-BPL8",
  "h3Index": "8928308280ffff",
  "senderId": "citizen-1697123456789"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Citizen report ingested successfully",
  "h3Index": "8928308280ffff",
  "cellUpdated": true
}
```

## H3 Cell Integration

Citizen reports are integrated into the H3 cell system:

1. **Cell Creation:** If the H3 cell doesn't exist, it's created with the citizen report data
2. **Cell Update:** If the cell exists, the report is added to the cell's telemetry history
3. **Risk Impact:** Citizen reports affect the cell's composite risk score:
   - Critical urgency: +3 to risk score
   - High urgency: +2 to risk score
   - Medium urgency: +1 to risk score
   - Low urgency: +0.5 to risk score
4. **Temporal Decay:** Citizen report impact decays over time (24-hour window)

## Deployment

### Frontend URL Configuration

Update the QR code URL in the citizen reporting system:

**Development:**
```
http://localhost:5173/citizen-report
```

**Production:**
```
https://your-domain.com/citizen-report
```

### Printing QR Codes

1. Generate QR codes in Admin Console
2. Download as PNG files
3. Print on weather-resistant material
4. Place at strategic locations:
   - Public squares
   - Market areas
   - Transportation hubs
   - Residential areas
   - Government buildings

### Best Practices

1. **Location Density:** Place QR codes every 500-1000 meters in urban areas
2. **Visibility:** Ensure QR codes are visible and accessible
3. **Durability:** Use weather-resistant materials for outdoor placement
4. **Accessibility:** Place QR codes at wheelchair-accessible heights
5. **Maintenance:** Regularly check and replace damaged QR codes

## Security Considerations

1. **No Authentication:** Citizen reporting is public (no login required)
2. **Rate Limiting:** Apply rate limiting to prevent abuse
3. **Data Validation:** Validate all citizen report inputs
4. **Location Verification:** Use GPS to verify citizen is near the QR code location
5. **Audit Logging:** All citizen reports are logged for accountability

## Analytics

Citizen reports are tracked in the Analytics dashboard:

- **Total Citizen Reports:** Count of all citizen reports
- **Reports by Category:** Breakdown by problem type
- **Reports by Urgency:** Breakdown by urgency level
- **Response Time:** Time from report to operator action
- **Geographic Distribution:** Heatmap of report locations

## Troubleshooting

### QR Code Not Working

**Issue:** QR code doesn't redirect to citizen report page

**Solution:**
1. Verify QR code data is valid JSON
2. Check frontend URL is correct
3. Ensure `/citizen-report` route is accessible

### Citizen Report Not Appearing in Operator Console

**Issue:** Submitted report doesn't show in Operator Console

**Solution:**
1. Check backend logs for errors
2. Verify H3 cell was created/updated
3. Check if cell risk exceeds threshold (7)
4. Refresh Operator Console (SSE stream should update automatically)

### GPS Location Not Captured

**Issue:** Citizen report doesn't capture GPS location

**Solution:**
1. Ensure user has granted location permission
2. Check browser supports Geolocation API
3. Fallback to QR code's pre-defined location

## Future Enhancements

1. **Photo Upload:** Allow citizens to attach photos
2. **Anonymous Reporting:** Option for anonymous reports
3. **Report Tracking:** Citizens can track report status
4. **Push Notifications:** Notify citizens when report is resolved
5. **Multi-language Support:** Support for multiple languages
6. **Offline Support:** Cache reports when offline, sync when online
