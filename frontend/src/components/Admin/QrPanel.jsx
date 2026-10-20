import { useCallback, useState } from 'react';
import { Copy, Plus, QrCode, Trash2 } from 'lucide-react';
import Button from '../ui/Button/Button';
import Input from '../ui/Input/Input';
import Notice from '../ui/Notice/Notice';
import Select from '../ui/Select/Select';
import { useToast } from '../ui/Toast/Toast';
import { apiRequest } from '../../api.js';
import styles from './QrPanel.module.css';

const CITY_CODES = [
  { value: 'CITY-IND-BPL8', label: 'Bhopal' },
  { value: 'CITY-IND-INR6', label: 'Indore' },
  { value: 'CITY-IND-SHR4', label: 'Sehore' },
];

const emptyLocation = () => ({ locationId: '', latitude: '', longitude: '', label: '' });

export default function QrPanel({ cityCode: defaultCityCode = CITY_CODES[0].value }) {
  const { push } = useToast();
  const [cityCode, setCityCode] = useState(defaultCityCode);
  const [locations, setLocations] = useState([{ ...emptyLocation(), locationId: 'LOC-001' }]);
  const [codes, setCodes] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const update = useCallback((index, field, value) => {
    setLocations((current) => current.map((location, i) => (i === index ? { ...location, [field]: value } : location)));
  }, []);

  const add = useCallback(() => {
    setLocations((current) => [
      ...current,
      { ...emptyLocation(), locationId: `LOC-${String(current.length + 1).padStart(3, '0')}` },
    ]);
  }, []);

  const remove = useCallback((index) => {
    setLocations((current) => current.filter((_, i) => i !== index));
  }, []);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError('');
    setCodes([]);
    try {
      const response = await apiRequest('/v1/qr/batch-generate', {
        method: 'POST',
        body: {
          cityCode,
          locations: locations.map((location) => ({
            locationId: location.locationId,
            latitude: Number(location.latitude),
            longitude: Number(location.longitude),
            label: location.label || location.locationId,
          })),
        },
      });
      setCodes(response.qrCodes || []);
      push(`${(response.qrCodes || []).length} code${(response.qrCodes || []).length === 1 ? '' : 's'} generated.`, 'success');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setGenerating(false);
    }
  }, [cityCode, locations, push]);

  const copy = useCallback(
    async (url) => {
      try {
        await navigator.clipboard.writeText(url);
        push('Link copied.', 'success');
      } catch {
        push('The link could not be copied.', 'error');
      }
    },
    [push]
  );

  return (
    <section className={styles.panel} aria-label="QR codes">
      <header className={styles.header}>
        <h2 className={styles.title}>QR codes</h2>
        <p className={styles.description}>
          A code for each public location. Scanning it opens the citizen report form for that place, pre-filled with
          the location.
        </p>
      </header>

      {error ? (
        <Notice tone="error" title="The codes were not generated">
          {error}
        </Notice>
      ) : null}

      <div className={styles.form}>
        <label className={styles.label} htmlFor="qr-city">
          Municipality
        </label>
        <Select id="qr-city" value={cityCode} onChange={(event) => setCityCode(event.target.value)}>
          {CITY_CODES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <ul className={styles.locations}>
          {locations.map((location, index) => (
            <li key={index} className={styles.location}>
              <Input
                aria-label={`Location id ${index + 1}`}
                placeholder="LOC-001"
                value={location.locationId}
                onChange={(event) => update(index, 'locationId', event.target.value)}
              />
              <Input
                aria-label={`Latitude for location ${index + 1}`}
                type="number"
                step="0.0001"
                placeholder="Latitude"
                value={location.latitude}
                onChange={(event) => update(index, 'latitude', event.target.value)}
              />
              <Input
                aria-label={`Longitude for location ${index + 1}`}
                type="number"
                step="0.0001"
                placeholder="Longitude"
                value={location.longitude}
                onChange={(event) => update(index, 'longitude', event.target.value)}
              />
              <Input
                aria-label={`Label for location ${index + 1}`}
                placeholder="Label"
                value={location.label}
                onChange={(event) => update(index, 'label', event.target.value)}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(index)}
                disabled={locations.length === 1}
                aria-label={`Remove location ${index + 1}`}
              >
                <Trash2 size={14} aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>

        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={add}>
            <Plus size={14} aria-hidden="true" />
            Add location
          </Button>
          <Button variant="primary" size="sm" onClick={generate} loading={generating}>
            <QrCode size={14} aria-hidden="true" />
            Generate codes
          </Button>
        </div>
      </div>

      {codes.length ? (
        <ul className={styles.codes}>
          {codes.map((code) => (
            <li key={code.locationId} className={styles.code}>
              <img className={styles.codeImage} src={code.qrCode} alt={`QR code for ${code.label || code.locationId}`} width={160} height={160} />
              <p className={styles.codeLabel}>{code.label || code.locationId}</p>
              <p className={styles.codeId}>{code.locationId}</p>
              <Button variant="ghost" size="sm" onClick={() => copy(code.url)}>
                <Copy size={13} aria-hidden="true" />
                Copy report link
              </Button>
              <a className={styles.codeLink} href={code.qrCode} download={`${code.locationId}.png`}>
                Download PNG
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
