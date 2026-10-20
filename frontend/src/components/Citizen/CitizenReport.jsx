import { memo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ProductShell from '../Shared/ProductShell.jsx';

function CitizenReport() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [qrData, setQrData] = useState(null);
  const [reportText, setReportText] = useState('');
  const [category, setCategory] = useState('infrastructure');
  const [urgency, setUrgency] = useState('medium');
  const [location, setLocation] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Parse QR code data from URL
    const qrDataParam = searchParams.get('data');
    if (qrDataParam) {
      try {
        const decoded = JSON.parse(decodeURIComponent(qrDataParam));
        setQrData(decoded);
      } catch (error) {
        setMessage('Invalid QR code data');
      }
    } else {
      setMessage('No QR code data found. Please scan a valid QR code.');
    }

    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
        },
        (err) => {
          console.log('Geolocation error:', err);
          // Location is optional, don't show error
        }
      );
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reportText.trim()) {
      setMessage('Please describe the problem');
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      const reportData = {
        sourceType: 'citizen',
        latitude: location?.latitude || qrData?.latitude,
        longitude: location?.longitude || qrData?.longitude,
        observedAt: new Date().toISOString(),
        reportText,
        category,
        urgency,
        locationId: qrData?.locationId,
        cityCode: qrData?.cityCode,
        h3Index: qrData?.h3Index,
        senderId: `citizen-${Date.now()}`
      };

      const response = await fetch('http://localhost:5000/api/v1/telemetry/citizen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(true);
        setMessage('Report submitted successfully! Thank you for your contribution.');
        setReportText('');
      } else {
        setMessage(result.message || 'Failed to submit report');
      }
    } catch (error) {
      setMessage('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <ProductShell title="Citizen Report - Success">
        <div className="citizen-success">
          <div className="success-icon">✓</div>
          <h2>Report Submitted Successfully</h2>
          <p>Your report has been received and will be reviewed by municipal authorities.</p>
          <p><strong>Location ID:</strong> {qrData?.locationId}</p>
          <p><strong>City:</strong> {qrData?.cityCode}</p>
          <button className="btn-submit" onClick={() => navigate('/')}>
            Submit Another Report
          </button>
        </div>
      </ProductShell>
    );
  }

  return (
    <ProductShell title="Citizen Report">
      <div className="citizen-report-container">
        {message && (
          <div className={`alert-banner ${success ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        {qrData && (
          <div className="qr-info">
            <h3>Location Information</h3>
            <p><strong>Location ID:</strong> {qrData.locationId}</p>
            <p><strong>City:</strong> {qrData.cityCode}</p>
            {qrData.label && <p><strong>Label:</strong> {qrData.label}</p>}
            {location && (
              <p><strong>Your Location:</strong> {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="citizen-form">
          <div className="form-group">
            <label htmlFor="category">Problem Category</label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            >
              <option value="infrastructure">Infrastructure (Roads, Drainage, Water)</option>
              <option value="traffic">Traffic & Transportation</option>
              <option value="flood">Flooding & Waterlogging</option>
              <option value="sanitation">Sanitation & Waste</option>
              <option value="emergency">Emergency</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="urgency">Urgency Level</label>
            <select
              id="urgency"
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
              required
            >
              <option value="low">Low - Can be addressed within a week</option>
              <option value="medium">Medium - Should be addressed within 48 hours</option>
              <option value="high">High - Urgent, needs immediate attention</option>
              <option value="critical">Critical - Emergency situation</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="reportText">Describe the Problem</label>
            <textarea
              id="reportText"
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              placeholder="Please describe the issue in detail..."
              rows={5}
              required
            />
          </div>

          <button type="submit" className="btn-submit" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </form>

        <div className="citizen-notice">
          <p><strong>Note:</strong> Your report will be processed by the municipal operations team. For emergencies, please call the municipal hotline directly.</p>
        </div>
      </div>
    </ProductShell>
  );
}

export default memo(CitizenReport);
