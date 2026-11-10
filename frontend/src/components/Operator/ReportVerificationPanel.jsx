import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cellRef } from '../../lib/cells/index.js';
import { absoluteTime } from '../../lib/useRelativeTime.js';
import styles from './ReportVerificationPanel.module.css';

const STATES = [
  {
    value: 'UNVERIFIED',
    label: 'Unverified',
    hint: 'One report, awaiting independent evidence',
  },
  {
    value: 'CORROBORATED',
    label: 'Corroborated',
    hint: 'Two or more distinct reporters',
  },
  {
    value: 'VERIFIED',
    label: 'Field verified',
    hint: 'Confirmed by a field crew',
  },
];

const STATUS_LABELS = {
  OPEN: 'Open',
  ACKNOWLEDGED: 'Acknowledged',
};

const stateFor = (alert) =>
  STATES.some((state) => state.value === alert.verification)
    ? alert.verification
    : 'UNVERIFIED';

const parseTimestamp = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const timestampNode = (value, className) => {
  const date = parseTimestamp(value);
  if (!date) return <span className={className}>Unknown time</span>;
  return (
    <time className={className} dateTime={date.toISOString()} title={absoluteTime(date)}>
      {absoluteTime(date)}
    </time>
  );
};

/**
 * The evidence level of citizen and field reports.
 *
 * A report is not automatically true. One resident is unverified, two
 * independent residents corroborate it, and a field crew verifies it. Keeping
 * those states visible is what lets an operator decide how much weight to give
 * a report before dispatching anyone.
 */
export default function ReportVerificationPanel({ alerts = [], onSelect }) {
  const [expandedKey, setExpandedKey] = useState(null);
  const detailId = useId();
  const reports = alerts.filter((alert) => alert.type === 'REPORT');
  const counts = Object.fromEntries(STATES.map((state) => [state.value, 0]));
  for (const report of reports) counts[stateFor(report)] += 1;

  return (
    <section
      className={styles.panel}
      aria-label="Citizen and field report verification"
      aria-live="polite"
    >
      <header className={styles.header}>
        <h3 className={styles.title}>Citizen &amp; field reports</h3>
        <span className={styles.count}>
          {reports.length} in the current alert window
        </span>
      </header>

      <dl className={styles.states}>
        {STATES.map((state) => (
          <div key={state.value} className={styles.state} data-state={state.value}>
            <dt className={styles.stateLabel}>{state.label}</dt>
            <dd className={styles.stateValue}>
              {counts[state.value]}
              <span className={styles.stateHint}>{state.hint}</span>
            </dd>
          </div>
        ))}
      </dl>

      {reports.length ? (
        <>
          <ul className={styles.list}>
            {reports.slice(0, 3).map((report, index) => {
              const state = stateFor(report);
              const stateLabel = STATES.find((item) => item.value === state)?.label;
              const evidence = Array.isArray(report.evidence) ? report.evidence : [];
              const evidenceCount = Number(report.evidenceCount) || 1;
              const reportCount = evidence.length || evidenceCount;
              const reportKey =
                report.alertKey || report._id || `${report.h3Index}-${index}`;
              const expanded = expandedKey === reportKey;
              const reportDetailId = `${detailId}-${index}`;
              const evidenceTimes = evidence
                .map((item) => parseTimestamp(item.at))
                .filter(Boolean);
              const latestEvidenceAt = evidenceTimes.length
                ? new Date(Math.max(...evidenceTimes.map((date) => date.getTime())))
                : null;
              const content = (
                <>
                  <span className={styles.reportText}>
                    <span className={styles.reportTitle}>{report.title}</span>
                    <span className={styles.reportMeta}>
                      Cell {cellRef(report.h3Index)} ·{' '}
                      {STATUS_LABELS[report.status] || report.status} · {reportCount}{' '}
                      {reportCount === 1 ? 'report' : 'reports'}
                    </span>
                  </span>
                  <span className={styles.badge} data-state={state}>
                    {stateLabel}
                  </span>
                  <ChevronDown
                    size={14}
                    className={styles.chevron}
                    data-expanded={expanded}
                    aria-hidden="true"
                  />
                </>
              );

              return (
                <li key={reportKey} className={styles.item}>
                  <button
                    type="button"
                    className={styles.report}
                    onClick={() =>
                      setExpandedKey((current) =>
                        current === reportKey ? null : reportKey
                      )
                    }
                    aria-expanded={expanded}
                    aria-controls={expanded ? reportDetailId : undefined}
                    aria-label={`${expanded ? 'Hide' : 'Show'} evidence for ${
                      report.title
                    } in cell ${cellRef(report.h3Index)}`}
                  >
                    {content}
                  </button>

                  {expanded ? (
                    <div className={styles.detail} id={reportDetailId}>
                      <dl className={styles.facts}>
                        <div className={styles.fact}>
                          <dt className={styles.factLabel}>First reported</dt>
                          <dd className={styles.factValue}>
                            {timestampNode(report.firstSeenAt, styles.factTime)}
                          </dd>
                        </div>
                        <div className={styles.fact}>
                          <dt className={styles.factLabel}>Latest evidence</dt>
                          <dd className={styles.factValue}>
                            {latestEvidenceAt
                              ? timestampNode(latestEvidenceAt, styles.factTime)
                              : 'None retained'}
                          </dd>
                        </div>
                      </dl>

                      <div className={styles.evidence}>
                        <div className={styles.evidenceHeader}>
                          <span className={styles.evidenceTitle}>
                            Reporter evidence
                          </span>
                          <span className={styles.evidenceCount}>
                            {evidenceCount} distinct{' '}
                            {evidenceCount === 1 ? 'reporter' : 'reporters'}
                          </span>
                        </div>

                        {evidence.length ? (
                          <ul className={styles.evidenceList}>
                            {evidence.slice(0, 5).map((item, evidenceIndex) => {
                              const label =
                                item.reporter ||
                                (item.kind === 'FIELD_CREW'
                                  ? 'Field crew'
                                  : 'Resident');
                              return (
                                <li
                                  key={`${label}-${item.at || 'unknown'}-${evidenceIndex}`}
                                  className={styles.evidenceRow}
                                >
                                  <span className={styles.reporter}>
                                    <span className={styles.reporterName}>
                                      {label}
                                    </span>
                                    <span className={styles.reporterKind}>
                                      {item.kind === 'FIELD_CREW'
                                        ? 'Field verified report'
                                        : 'Citizen report'}
                                    </span>
                                  </span>
                                  {timestampNode(
                                    item.at,
                                    styles.evidenceTime
                                  )}
                                </li>
                              );
                            })}
                            {evidence.length > 5 ? (
                              <li className={styles.moreEvidence}>
                                +{evidence.length - 5} more reports in the cell
                                record
                              </li>
                            ) : null}
                          </ul>
                        ) : (
                          <p className={styles.evidenceEmpty}>
                            No reporter-level evidence was retained for this
                            alert. The verification state reflects the alert
                            record.
                          </p>
                        )}
                      </div>

                      {onSelect ? (
                        <button
                          type="button"
                          className={styles.openCell}
                          onClick={() => onSelect(report)}
                        >
                          Open cell {cellRef(report.h3Index)}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {reports.length > 3 ? (
            <p className={styles.more}>
              +{reports.length - 3} more in the live alert feed
            </p>
          ) : null}
        </>
      ) : (
        <p className={styles.empty}>
          No citizen or field reports in the current alert window. A resident report starts
          unverified, two independent reporters corroborate it, and a field crew report is
          field verified.
        </p>
      )}
    </section>
  );
}
