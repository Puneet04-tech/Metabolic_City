import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, CloudOff, MapPin } from 'lucide-react';
import PublicReportShell from '../components/shell/PublicReportShell/PublicReportShell';
import Button from '../components/ui/Button/Button';
import FormField from '../components/ui/FormField/FormField';
import Notice from '../components/ui/Notice/Notice';
import Select from '../components/ui/Select/Select';
import Textarea from '../components/ui/Textarea/Textarea';
import { apiRequest } from '../api.js';
import styles from './CitizenReport.module.css';

const CATEGORIES = [
  { value: 'infrastructure', label: 'Infrastructure (roads, drainage, water)' },
  { value: 'traffic', label: 'Traffic and transport' },
  { value: 'flood', label: 'Flooding and waterlogging' },
  { value: 'sanitation', label: 'Sanitation and waste' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'other', label: 'Other' },
];

const URGENCY = [
  { value: 'low', label: 'Low — can be addressed within a week' },
  { value: 'medium', label: 'Medium — should be addressed within 48 hours' },
  { value: 'high', label: 'High — urgent, needs attention now' },
  { value: 'critical', label: 'Critical — emergency situation' },
];

/**
 * The public, QR-scoped report. No account, no app bar, no sign-out.
 */
export default function CitizenReport() {
  const [searchParams] = useSearchParams();
  const [qrData, setQrData] = useState(null);
  const [reportText, setReportText] = useState('');
  const [category, setCategory] = useState('infrastructure');
  const [urgency, setUrgency] = useState('medium');
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [offline, setOffline] = useState(() => (typeof navigator === 'undefined' ? false : !navigator.onLine));

  useEffect(() => {
    const data = searchParams.get('data');
    if (!data) {
      setError('This link is missing its location code. Please scan a valid code.');
      return;
    }
    try {
      setQrData(JSON.parse(decodeURIComponent(data)));
    } catch {
      setError('This link could not be read. Please scan a valid code.');
    }
  }, [searchParams]);

  // The device position is only requested when the citizen asks for it. The
  // QR code already carries the location of the report.
  const useMyPosition = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocateError('This device cannot report a position.');
      return;
    }
    setLocating(true);
    setLocateError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocateError('Your position could not be read. The report will use the place on the code.');
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!reportText.trim()) {
      setError('Please describe the problem.');
      return;
    }

    setSubmitting(true);
    setError('');

    const reportData = {
      sourceType: 'citizen',
      latitude: location?.latitude ?? qrData?.latitude,
      longitude: location?.longitude ?? qrData?.longitude,
      observedAt: new Date().toISOString(),
      reportText,
      category,
      urgency,
      locationId: qrData?.locationId,
      cityCode: qrData?.cityCode,
      h3Index: qrData?.h3Index,
      senderId: `citizen-${Date.now()}`,
    };

    try {
      // Public endpoint: no session is attached and no token is refreshed.
      await apiRequest('/v1/telemetry/citizen', { method: 'POST', body: reportData, auth: false });
      setSuccess(true);
      setReportText('');
    } catch (requestError) {
      setError(
        requestError.status
          ? requestError.message
          : 'The report could not be sent. Check your connection and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <PublicReportShell title="Report received" description="Thank you — the municipal operations team has your report.">
        <div className={styles.success}>
          <CheckCircle2 className={styles.successIcon} size={28} aria-hidden="true" />
          <p className={styles.successText}>
            {qrData?.locationId ? `Reference ${qrData.locationId}. ` : ''}
            Your report is in the queue for review.
          </p>
        </div>
      </PublicReportShell>
    );
  }

  return (
    <PublicReportShell
      title="Report a problem"
      description="Tell the municipality what you have found. The report goes to the operations team for the area."
    >
      {offline ? (
        <Notice tone="warning" title="You are offline">
          The report cannot be sent until the connection returns.
        </Notice>
      ) : null}

      {error ? (
        <Notice tone="error" title="Report not sent">
          {error}
        </Notice>
      ) : null}

      {qrData ? (
        <section className={styles.location} aria-label="Location">
          <h2 className={styles.sectionTitle}>Location</h2>
          <dl className={styles.facts}>
            {qrData.locationId ? (
              <div className={styles.fact}>
                <dt>Location</dt>
                <dd>{qrData.locationId}</dd>
              </div>
            ) : null}
            {qrData.cityCode ? (
              <div className={styles.fact}>
                <dt>City</dt>
                <dd>{qrData.cityCode}</dd>
              </div>
            ) : null}
            {qrData.label ? (
              <div className={styles.fact}>
                <dt>Place</dt>
                <dd>{qrData.label}</dd>
              </div>
            ) : null}
            {location ? (
              <div className={styles.fact}>
                <dt>Your position</dt>
                <dd className={styles.mono}>
                  <MapPin size={12} aria-hidden="true" />
                  {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                </dd>
              </div>
            ) : null}
          </dl>

          <div className={styles.position}>
            <Button variant="secondary" size="sm" onClick={useMyPosition} loading={locating}>
              <MapPin size={13} aria-hidden="true" />
              {location ? 'Update my position' : 'Use my current position'}
            </Button>
            {locateError ? (
              <p className={styles.positionError} role="status">
                {locateError}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <FormField label="What kind of problem is it?" required>
          {(props) => (
            <Select {...props} value={category} onChange={(event) => setCategory(event.target.value)}>
              {CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField label="How urgent is it?" required>
          {(props) => (
            <Select {...props} value={urgency} onChange={(event) => setUrgency(event.target.value)}>
              {URGENCY.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField label="Describe the problem" required>
          {(props) => (
            <Textarea
              {...props}
              value={reportText}
              onChange={(event) => setReportText(event.target.value)}
              placeholder="What is wrong, and where exactly?"
              rows={5}
            />
          )}
        </FormField>

        <Button type="submit" variant="primary" loading={submitting} disabled={submitting || offline}>
          Send report
        </Button>
      </form>

      <p className={styles.note}>
        For emergencies, call the municipal hotline directly. Reports are reviewed by the operations team for the
        area.
      </p>
    </PublicReportShell>
  );
}
