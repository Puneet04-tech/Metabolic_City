import styles from './ForecastModelPanel.module.css';

/**
 * What the forecast model is, and how well it has done so far.
 *
 * The live score only exists once a forecast horizon has matured. The
 * historical persistence score is a benchmark from stored cell history, not a
 * disguised version of the live model, so the two are shown separately.
 */
export default function ForecastModelPanel({ accuracy }) {
  if (!accuracy) return null;

  const live = Number(accuracy.samples) || 0;
  const baseline = accuracy.historicalBaseline;
  const baselineSamples = Number(baseline?.samples) || 0;
  const changedShare = Number(baseline?.changedShare);
  const changedLabel = Number.isFinite(changedShare)
    ? ` · ${Math.round(changedShare * 100)}% changed`
    : '';

  return (
    <section className={styles.panel} aria-label="Forecast model status">
      <div className={styles.heading}>
        <span className={styles.label}>Forecast model</span>
        <span className={styles.model}>{accuracy.modelVersion}</span>
      </div>
      <div className={styles.metrics}>
        <span>
          Live:{' '}
          <strong>{live ? `${accuracy.mae.toFixed(2)} MAE · ${live} points` : 'awaiting first horizon'}</strong>
        </span>
        <span>
          Historical persistence:{' '}
          <strong>
            {baselineSamples
              ? `${Number(baseline.mae).toFixed(2)} MAE · ${baselineSamples} pairs${changedLabel}`
              : 'no history'}
          </strong>
        </span>
      </div>
      <p className={styles.note}>
        Live score compares each published point with the next cell observation. The historical
        number is a persistence baseline from stored history, not the live model.
        {baselineSamples && changedShare === 0
          ? ' Stored history did not move between samples, so this baseline scores zero error without proving forecast skill.'
          : ''}
      </p>
    </section>
  );
}
