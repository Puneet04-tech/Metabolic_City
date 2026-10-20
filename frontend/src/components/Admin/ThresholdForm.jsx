import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, RotateCcw, Save } from 'lucide-react';
import Button from '../ui/Button/Button';
import Notice from '../ui/Notice/Notice';
import NumberInput from '../ui/NumberInput/NumberInput';
import { Dialog, DialogContent } from '../ui/Dialog/Dialog';
import { useToast } from '../ui/Toast/Toast';
import { apiRequest } from '../../api.js';
import styles from './ThresholdForm.module.css';

const WEIGHT_FIELDS = [
  { key: 'Wm', label: 'Mobility weight', hint: 'How much transit disruption counts towards risk.' },
  { key: 'Wc', label: 'Climate weight', hint: 'How much weather disruption counts towards risk.' },
  { key: 'Wv', label: 'Vulnerability weight', hint: 'How much the survey vulnerability counts towards risk.' },
];

/** The caution band is fixed by the risk engine, so the critical band must sit above it. */
const CAUTION_THRESHOLD = 5;

export default function ThresholdForm() {
  const { push } = useToast();
  const [weights, setWeights] = useState({ Wm: 0.4, Wc: 0.4, Wv: 0.2 });
  const [threshold, setThreshold] = useState(7);
  const [loaded, setLoaded] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [audit, setAudit] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [config, logs] = await Promise.all([
        apiRequest('/v1/admin/weights'),
        apiRequest('/v1/admin/audit-logs?action=WEIGHTS_UPDATED&limit=1').catch(() => null),
      ]);
      setWeights(config?.weights ?? { Wm: 0.4, Wc: 0.4, Wv: 0.2 });
      setThreshold(config?.threshold ?? 7);
      setLoaded({ weights: config?.weights ?? { Wm: 0.4, Wc: 0.4, Wv: 0.2 }, threshold: config?.threshold ?? 7 });
      setPreview(null);
      const last = logs?.logs?.[0];
      if (last) {
        setAudit({
          by: last.actorId?.name || 'an administrator',
          at: new Date(last.createdAt),
        });
      }
    } catch (requestError) {
      setError(requestError.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sum = useMemo(
    () => Object.values(weights ?? {}).reduce((total, value) => total + Number(value || 0), 0),
    [weights]
  );

  const dirty = useMemo(() => {
    if (!loaded) return false;
    return (
      Math.abs(sum - 1) > 0.0001 ||
      Number(threshold) !== Number(loaded.threshold) ||
      WEIGHT_FIELDS.some((field) => Number(weights?.[field.key]) !== Number(loaded.weights[field.key]))
    );
  }, [loaded, sum, threshold, weights]);

  const problems = useMemo(() => {
    const list = [];
    if (Math.abs(sum - 1) > 0.0001) list.push(`The three weights must add up to 1.00. They currently add up to ${sum.toFixed(2)}.`);
    if (Number(threshold) < 3 || Number(threshold) > 10) list.push('The critical threshold must be between 3 and 10.');
    if (Number(threshold) <= CAUTION_THRESHOLD) list.push(`The critical threshold must be above the caution band (${CAUTION_THRESHOLD}), which the risk engine fixes.`);
    return list;
  }, [sum, threshold]);

  const runPreview = useCallback(async () => {
    setPreviewing(true);
    setError('');
    try {
      const result = await apiRequest('/v1/admin/weights/dry-run', {
        method: 'POST',
        body: { ...weights, threshold: Number(threshold) },
      });
      setPreview(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPreviewing(false);
    }
  }, [weights, threshold]);

  const save = useCallback(async () => {
    setConfirmOpen(false);
    setSaving(true);
    setError('');
    try {
      await apiRequest('/v1/admin/weights', { method: 'PUT', body: { ...weights, threshold: Number(threshold) } });
      push('Weights saved. The active cells are being recalculated.', 'success');
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }, [weights, threshold, load, push]);

  const reset = useCallback(() => {
    if (!loaded) return;
    setWeights(loaded.weights);
    setThreshold(loaded.threshold);
    setPreview(null);
  }, [loaded]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const changed = preview?.preview?.filter((entry) => entry.currentRiskLevel !== entry.projectedRiskLevel) ?? [];

  return (
    <section className={styles.panel} aria-label="Risk thresholds">
      <header className={styles.header}>
        <h2 className={styles.title}>Risk thresholds</h2>
        <p className={styles.description}>
          The weights decide how much each signal counts towards a cell&rsquo;s composite risk, and the threshold
          decides when a cell counts as critical.
        </p>
      </header>

      {error ? (
        <Notice tone="error" title="The change was not applied">
          {error}
        </Notice>
      ) : null}

      <div className={styles.form}>
        {WEIGHT_FIELDS.map((field) => (
          <NumberInput
            key={field.key}
            label={field.label}
            unit="weight"
            min={0}
            max={1}
            step={0.01}
            hint={field.hint}
            value={weights[field.key]}
            onChange={(event) =>
              setWeights((current) => ({ ...current, [field.key]: Number(event.target.value) }))
            }
          />
        ))}

        <p className={styles.sum} data-ok={Math.abs(sum - 1) <= 0.0001 ? 'true' : 'false'}>
          Weights total {sum.toFixed(2)} of 1.00
        </p>

        <NumberInput
          label="Critical threshold"
          unit="Rc"
          min={3}
          max={10}
          step={0.1}
          value={threshold}
          hint={`Cells at or above this score are critical. The caution band is fixed at ${CAUTION_THRESHOLD} by the risk engine.`}
          onChange={(event) => setThreshold(Number(event.target.value))}
        />
      </div>

      {problems.length ? (
        <Notice tone="warning" title="Fix this before saving">
          <ul className={styles.problems}>
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <div className={styles.actions}>
        <Button variant="secondary" onClick={runPreview} loading={previewing} disabled={problems.length > 0}>
          Preview the effect
        </Button>
        <Button variant="ghost" onClick={reset} disabled={!dirty}>
          <RotateCcw size={14} aria-hidden="true" />
          Reset
        </Button>
        <Button variant="primary" onClick={() => setConfirmOpen(true)} disabled={!dirty || problems.length > 0}>
          <Save size={14} aria-hidden="true" />
          Save changes
        </Button>
      </div>

      {dirty ? (
        <p className={styles.dirty}>
          <AlertTriangle size={13} aria-hidden="true" />
          You have unsaved changes. They are kept if you leave the page without saving.
        </p>
      ) : null}

      {preview ? (
        <div className={styles.preview}>
          <h3 className={styles.previewTitle}>Preview</h3>
          <dl className={styles.previewFacts}>
            <div>
              <dt>Critical now</dt>
              <dd>{preview.criticalCountCurrent}</dd>
            </div>
            <div>
              <dt>Critical after</dt>
              <dd>{preview.criticalCountProjected}</dd>
            </div>
            <div>
              <dt>Cells changing band</dt>
              <dd>{changed.length}</dd>
            </div>
            <div>
              <dt>Cells checked</dt>
              <dd>{preview.preview?.length ?? 0}</dd>
            </div>
          </dl>
          {changed.length ? (
            <ul className={styles.changedList}>
              {changed.slice(0, 8).map((entry) => (
                <li key={entry.h3Index}>
                  <span className={styles.changedCell}>{entry.h3Index}</span>
                  <span className={styles.changedFrom}>{entry.currentRiskLevel}</span>
                  <span aria-hidden="true">→</span>
                  <span className={styles.changedTo}>{entry.projectedRiskLevel}</span>
                </li>
              ))}
              {changed.length > 8 ? <li className={styles.more}>and {changed.length - 8} more</li> : null}
            </ul>
          ) : (
            <p className={styles.previewNote}>
              <Check size={13} aria-hidden="true" />
              No cell changes band with these settings.
            </p>
          )}
        </div>
      ) : null}

      {audit ? (
        <p className={styles.audit}>
          Last changed by {audit.by} at {audit.at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          title="Apply the new thresholds?"
          description="Every active cell is recalculated with these weights. The change is recorded in the audit trail."
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={save} loading={saving}>
                Apply changes
              </Button>
            </>
          }
        >
          <p className={styles.confirmText}>
            Critical will be at or above {Number(threshold).toFixed(1)} and the weights will total {sum.toFixed(2)}.
          </p>
        </DialogContent>
      </Dialog>
    </section>
  );
}
