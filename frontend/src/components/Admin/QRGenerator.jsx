import { useState } from 'react';
import { apiRequest } from '../../api.js';
import ProductShell from '../Shared/ProductShell.jsx';

function QRGenerator() {
  const [cityCode, setCityCode] = useState('CITY-IND-BPL8');
  const [locations, setLocations] = useState([{ locationId: 'LOC-001', latitude: 23.2599, longitude: 77.4126, label: 'New Market Area' }]);
  const [qrCodes, setQrCodes] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');

  const addLocation = () => {
    setLocations([...locations, { locationId: `LOC-${String(locations.length + 1).padStart(3, '0')}`, latitude: '', longitude: '', label: '' }]);
  };

  const removeLocation = (index) => {
    setLocations(locations.filter((_, i) => i !== index));
  };

  const updateLocation = (index, field, value) => {
    const updated = [...locations];
    updated[index][field] = value;
    setLocations(updated);
  };

  const generateQRCodes = async () => {
    setGenerating(true);
    setMessage('');

    try {
      const response = await apiRequest('/v1/qr/batch-generate', {
        method: 'POST',
        body: { cityCode, locations }
      });

      if (response.success) {
        setQrCodes(response.qrCodes);
        setMessage(`Generated ${response.count} QR codes successfully!`);
      } else {
        setMessage('Failed to generate QR codes');
      }
    } catch (error) {
      setMessage(error.message || 'Network error');
    } finally {
      setGenerating(false);
    }
  };

  const downloadQRCode = (qrCode, locationId) => {
    const link = document.createElement('a');
    link.href = qrCode;
    link.download = `qr-${locationId}.png`;
    link.click();
  };

  const downloadAllQRCodes = () => {
    qrCodes.forEach((qr, index) => {
      setTimeout(() => {
        downloadQRCode(qr.qrCode, qr.locationId);
      }, index * 500);
    });
  };

  return (
    <ProductShell title="QR Code Generator">
      <div className="qr-generator-container">
        {message && (
          <div className={`alert-banner ${message.includes('success') || message.includes('Generated') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        <div className="qr-config-section">
          <h3>City Configuration</h3>
          <div className="form-group">
            <label htmlFor="cityCode">City Code</label>
            <select
              id="cityCode"
              value={cityCode}
              onChange={(e) => setCityCode(e.target.value)}
            >
              <option value="CITY-IND-BPL8">Bhopal (CITY-IND-BPL8)</option>
              <option value="CITY-IND-IDR1">Indore (CITY-IND-IDR1)</option>
              <option value="CITY-IND-SHR2">Sehore (CITY-IND-SHR2)</option>
            </select>
          </div>
        </div>

        <div className="qr-locations-section">
          <h3>Locations</h3>
          {locations.map((location, index) => (
            <div key={index} className="location-row">
              <div className="location-fields">
                <div className="form-group">
                  <label>Location ID</label>
                  <input
                    type="text"
                    value={location.locationId}
                    onChange={(e) => updateLocation(index, 'locationId', e.target.value)}
                    placeholder="LOC-001"
                  />
                </div>
                <div className="form-group">
                  <label>Latitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={location.latitude}
                    onChange={(e) => updateLocation(index, 'latitude', parseFloat(e.target.value) || '')}
                    placeholder="23.2599"
                  />
                </div>
                <div className="form-group">
                  <label>Longitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={location.longitude}
                    onChange={(e) => updateLocation(index, 'longitude', parseFloat(e.target.value) || '')}
                    placeholder="77.4126"
                  />
                </div>
                <div className="form-group">
                  <label>Label</label>
                  <input
                    type="text"
                    value={location.label}
                    onChange={(e) => updateLocation(index, 'label', e.target.value)}
                    placeholder="Area name"
                  />
                </div>
              </div>
              <button
                type="button"
                className="btn-delete"
                onClick={() => removeLocation(index)}
                disabled={locations.length === 1}
              >
                Remove
              </button>
            </div>
          ))}

          <button type="button" className="btn-secondary" onClick={addLocation}>
            + Add Location
          </button>
        </div>

        <div className="qr-actions">
          <button
            type="button"
            className="btn-submit"
            onClick={generateQRCodes}
            disabled={generating}
          >
            {generating ? 'Generating...' : 'Generate QR Codes'}
          </button>
        </div>

        {qrCodes.length > 0 && (
          <div className="qr-results-section">
            <h3>Generated QR Codes</h3>
            <button
              type="button"
              className="btn-secondary"
              onClick={downloadAllQRCodes}
            >
              Download All
            </button>
            <div className="qr-grid">
              {qrCodes.map((qr, index) => (
                <div key={index} className="qr-card">
                  <img src={qr.qrCode} alt={`QR Code for ${qr.locationId}`} />
                  <p><strong>{qr.locationId}</strong></p>
                  <p>{qr.data.label}</p>
                  {qr.h3Index && <p><small>H3: {qr.h3Index}</small></p>}
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => downloadQRCode(qr.qrCode, qr.locationId)}
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ProductShell>
  );
}

export default QRGenerator;
