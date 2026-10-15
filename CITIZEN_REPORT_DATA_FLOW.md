# Citizen Report Data Flow - Complete Explanation

## 📱 Step-by-Step Data Flow

### **Step 1: Citizen Submits Report**
**Location:** `CitizenReport.jsx` component

When a citizen fills out the form and clicks "SUBMIT REPORT":

```javascript
// File: frontend/src/components/Citizen/CitizenReport.jsx
const reportData = {
  sourceType: 'citizen',
  latitude: location?.latitude || qrData?.latitude,  // GPS from phone or QR code
  longitude: location?.longitude || qrData?.longitude,
  observedAt: new Date().toISOString(),
  reportText: "Large pothole on main road",          // User's description
  category: "infrastructure",                        // Problem category
  urgency: "high",                                   // Urgency level
  locationId: qrData?.locationId,                   // LOC-001
  cityCode: qrData?.cityCode,                       // CITY-IND-BPL8
  h3Index: qrData?.h3Index,                         // Pre-calculated from QR code
  senderId: `citizen-${Date.now()}`                 // Unique sender ID
};

// Send to backend
const response = await fetch('http://localhost:5000/api/v1/telemetry/citizen', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(reportData),
});
```

---

### **Step 2: Backend Receives Report**
**Location:** `backend/src/routes/telemetry.js`

The report is received at `POST /api/v1/telemetry/citizen`:

```javascript
// File: backend/src/routes/telemetry.js
router.post('/citizen', citizenLimiter, coordValidators, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ accepted: false, message: errors.array()[0].msg });
  return handleIngest('CITIZEN_311', req, res);
});
```

**Rate Limiting:** 60 reports per 5 minutes per IP (prevents spam)

---

### **Step 3: Ingest Telemetry Event**
**Location:** `backend/src/routes/telemetry.js` - `ingest()` function

The `ingest()` function processes the report:

```javascript
export async function ingest(sourceType, payload) {
  // 1. Normalize coordinates and calculate H3 index
  const { latitude, longitude, h3Index } = normalizeCoordinates(
    payload.latitude, 
    payload.longitude
  );
  
  // 2. Create TelemetryEvent in MongoDB
  const event = await TelemetryEvent.create({
    sourceType: 'CITIZEN_311',
    h3Index: '883d914f17fffff',  // H3 resolution-8 cell
    latitude: 23.2599,
    longitude: 77.4126,
    cityCode: 'CITY-IND-BPL8',
    observedAt: new Date(),
    category: 'infrastructure',
    senderId: 'citizen-1697123456789',
    reportText: 'Large pothole on main road',
    rawPayload: payload,  // Complete original data
  });

  // 3. Recalculate the H3 cell with new telemetry
  const cell = await recalculateCell(h3Index);
  
  return { event, cell };
}
```

**What happens:**
- GPS coordinates are converted to H3 index (resolution 8)
- Report is stored in `TelemetryEvent` collection
- H3 cell is recalculated with this new data

---

### **Step 4: Recalculate H3 Cell**
**Location:** `backend/src/engine/risk.js` - `recalculateCell()` function

The `recalculateCell()` function calculates risk scores:

```javascript
export async function recalculateCell(h3Index) {
  // 1. Fetch all telemetry events for this cell in last 15 minutes
  const windowStart = new Date(Date.now() - WINDOW_MS);  // 15 min window
  const events = await TelemetryEvent.find({ 
    h3Index, 
    observedAt: { $gte: windowStart } 
  }).lean();

  // 2. Calculate sub-scores from telemetry
  const scored = scoreCellEvents(events, previousCell, activeWeights, threshold);
  // Returns: mobility, climate, vulnerability scores
  
  // 3. Calculate composite risk
  // Rc = (Wm × Sm) + (Wc × Sc) + (Wv × Sv)
  // Default weights: Wm=0.4, Wc=0.4, Wv=0.2
  
  // 4. Update or create SpatialCell in MongoDB
  const updatedCell = await SpatialCell.findOneAndUpdate(
    { h3Index },
    {
      h3Index: '883d914f17fffff',
      latitude: 23.2599,
      longitude: 77.4126,
      scores: {
        mobility: 3.2,
        climate: 2.8,
        vulnerability: 4.5,
      },
      compositeRisk: 3.5,  // Calculated from sub-scores
      riskLevel: 'WARNING',  // NORMAL, WARNING, CRITICAL
      lastUpdated: new Date(),
      history: [...previous snapshots],
    },
    { upsert: true, returnDocument: 'after' }
  );

  // 5. Broadcast cell update via SSE stream
  broadcastCells([updatedCell]);
  
  return updatedCell;
}
```

**How Citizen Reports Affect Risk:**
- **Critical urgency:** +3 to risk score
- **High urgency:** +2 to risk score
- **Medium urgency:** +1 to risk score
- **Low urgency:** +0.5 to risk score
- Reports decay over time (5-minute half-life)

---

### **Step 5: Broadcast to Operator Console**
**Location:** `backend/src/engine/stream.js` - `broadcastCells()` function

The updated cell is broadcast via Server-Sent Events (SSE):

```javascript
export function broadcastCells(cells) {
  // Send to all connected Operator Consoles via SSE
  io.emit('cells:update', cells);
}
```

**What happens:**
- Cell update is sent to all connected Operator Consoles
- Operators see the cell update in real-time (no refresh needed)

---

### **Step 6: Operator Console Receives Update**
**Location:** `frontend/src/components/Operator/OperatorConsole.jsx`

The Operator Console receives the SSE stream:

```javascript
useEffect(() => {
  const controller = new AbortController();
  
  (async () => {
    await fetchStream('/v1/stream/h3', {
      signal: controller.signal,
      onMessage: (data) => {
        if (data.cells) {
          setCells(data.cells);  // Update cell list in real-time
          setConnection('live');
        }
      },
    });
  })();
  
  return () => controller.abort();
}, []);
```

**What operators see:**
- Cells are displayed on the map
- Color-coded by risk level:
  - **Green:** Normal (risk < 4)
  - **Orange:** Warning (4 ≤ risk < 7)
  - **Red:** Critical (risk ≥ 7)
- Cells update automatically when reports are submitted

---

### **Step 7: Operator Reviews and Takes Action**
**Location:** `frontend/src/components/Operator/OperatorConsole.jsx`

When an operator clicks on a cell:

```javascript
const select = (cell) => {
  setSelectedCell(cell);
  // Fetch incident details
  apiRequest(`/v1/incidents/${cell.h3Index}/action`)
    .then((data) => setActionDrawer(data));
};
```

**Action drawer shows:**
- Cell risk score
- Recent citizen reports (with descriptions)
- Recommended actions
- Priority level
- Dispatch text

**Operator can:**
1. **Claim 60-second lock** - Prevents duplicate decisions
2. **Approve & Dispatch** - Sends to field crew
3. **Override** - Custom action

---

### **Step 8: Field Crew Receives Task**
**Location:** `frontend/src/components/Field/FieldConsole.jsx`

If dispatched, field crew sees the task:

```javascript
const load = () => {
  apiRequest('/v1/field/tasks')
    .then((data) => {
      setTasks(data.incidents || []);  // Load assigned tasks
    });
};
```

**Field crew can:**
- Acknowledge task
- Mark as arrived
- Resolve with note and photo
- Attach GPS location

---

## 📊 Database Storage

### **TelemetryEvent Collection**
```javascript
{
  _id: ObjectId,
  sourceType: 'CITIZEN_311',
  h3Index: '883d914f17fffff',
  latitude: 23.2599,
  longitude: 77.4126,
  cityCode: 'CITY-IND-BPL8',
  observedAt: ISODate,
  category: 'infrastructure',
  urgency: 'high',
  reportText: 'Large pothole on main road',
  senderId: 'citizen-1697123456789',
  rawPayload: { ...complete report data }
}
```

### **SpatialCell Collection**
```javascript
{
  _id: ObjectId,
  h3Index: '883d914f17fffff',
  latitude: 23.2599,
  longitude: 77.4126,
  scores: {
    mobility: 3.2,
    climate: 2.8,
    vulnerability: 4.5,
  },
  compositeRisk: 3.5,
  riskLevel: 'WARNING',
  lastUpdated: ISODate,
  history: [...previous snapshots],
  telemetryStats: {
    eventCount: 5,
    citizenEventsCount: 2,
    lastObservedAt: ISODate,
  }
}
```

---

## 🎯 Summary

**Complete Flow:**
1. **Citizen** scans QR code → fills form → submits report
2. **Frontend** sends POST to `/api/v1/telemetry/citizen`
3. **Backend** validates → creates `TelemetryEvent` → calculates H3 index
4. **Risk Engine** recalculates cell → updates `SpatialCell` → broadcasts via SSE
5. **Operator Console** receives SSE update → shows cell on map
6. **Operator** clicks cell → reviews citizen reports → approves & dispatches
7. **Field Crew** receives task → resolves issue

**Key Points:**
- **Real-time:** Operators see updates instantly via SSE (no refresh needed)
- **H3 Integration:** GPS coordinates → H3 index (resolution 8) → SpatialCell
- **Risk Scoring:** Citizen reports contribute to cell risk based on urgency
- **Temporal Decay:** Report impact decreases over time (5-minute half-life)
- **Audit Trail:** All reports are logged and can be reviewed

---

## 🔍 Verification

To verify the flow works:

1. **Generate QR Code:**
   - Admin Console → QR Codes tab
   - Generate QR for a location
   - Test the QR code (opens citizen report form)

2. **Submit Citizen Report:**
   - Fill out the form
   - Click "SUBMIT REPORT"
   - Note the H3 index shown in the response

3. **Check Backend:**
   ```bash
   # Check telemetry event was created
   cd backend
   node -e "
   const mongoose = require('mongoose');
   mongoose.connect(process.env.MONGO_URI);
   const TelemetryEvent = require('./src/models/TelemetryEvent');
   TelemetryEvent.find({ sourceType: 'CITIZEN_311' })
     .sort({ createdAt: -1 })
     .limit(1)
     .then(console.log);
   "
   ```

4. **Check H3 Cell:**
   ```bash
   # Check spatial cell was updated
   node -e "
   const mongoose = require('mongoose');
   mongoose.connect(process.env.MONGO_URI);
   const SpatialCell = require('./src/models/SpatialCell');
   SpatialCell.findOne({ h3Index: '883d914f17fffff' })
     .then(console.log);
   "
   ```

5. **Check Operator Console:**
   - Go to Operator Console
   - The cell should appear on the map
   - Click the cell to see the citizen report

---

## 📈 Analytics

Citizen reports are tracked in the Analytics dashboard:
- **Total Citizen Reports:** Count of all citizen reports
- **Reports by Category:** Infrastructure, Traffic, Flood, etc.
- **Reports by Urgency:** Low, Medium, High, Critical
- **Response Time:** Time from report to operator action
- **Geographic Distribution:** Heatmap of report locations
