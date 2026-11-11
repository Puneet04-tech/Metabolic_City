import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  CloudRain,
  Database,
  GitBranch,
  Layers3,
  Network,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import AppShell from '../components/shell/AppShell/AppShell';
import Button from '../components/ui/Button/Button';
import EmptyState from '../components/ui/EmptyState/EmptyState';
import Input from '../components/ui/Input/Input';
import Notice from '../components/ui/Notice/Notice';
import Select from '../components/ui/Select/Select';
import SeverityBadge from '../components/ui/SeverityBadge/SeverityBadge';
import Skeleton from '../components/ui/Skeleton/Skeleton';
import StatBlock from '../components/ui/StatBlock/StatBlock';
import { apiRequest, clearSession, getStoredUser } from '../api.js';
import { getNavItems } from '../lib/routes.js';
import styles from './Intelligence.module.css';

const CITY_NAMES = {
  'CITY-MP-BPL': 'Bhopal',
  'CITY-MP-SHR': 'Sehore',
  'CITY-MP-IDR': 'Indore',
  'CITY-MP-AST': 'Ashta',
  'CITY-IND-BPL8': 'Bhopal',
  'CITY-IND-INR6': 'Indore',
  'CITY-IND-SHR4': 'Sehore',
  'CITY-IND-AST4': 'Ashta',
};

const severityFor = (risk) => (Number(risk) >= 7 ? 'critical' : Number(risk) >= 5 ? 'caution' : 'normal');

const cellLabel = (cell) => {
  const streets = cell?.context?.streets?.filter(Boolean) || [];
  return streets.length ? streets.slice(0, 2).join(' · ') : cell?.h3Index || 'Unknown cell';
};

const formatPercent = (value) => `${Math.round((Number(value) || 0) * 100)}%`;

const SOURCE_LABELS = {
  WEATHER_API: 'Weather',
  TRAFFIC_API: 'Traffic',
  GTFS_TRANSIT: 'Transit',
  CITIZEN_311: 'Citizen',
  IOT_SENSOR: 'IoT sensor',
  GIS_STATIC: 'Terrain',
};

const sourceLabel = (sourceType) => SOURCE_LABELS[sourceType] || sourceType || 'Unknown';

const formatAge = (value) => {
  if (!value) return 'no data';
  const ageMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ageMs)) return 'unknown';
  const seconds = Math.max(0, Math.round(ageMs / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
};

const ageAgo = (value) => (value ? `${formatAge(value)} ago` : 'no data');

const formatClock = (value) => (value ? new Date(value).toLocaleTimeString() : 'pending');

const interpolationLabel = (weather) => {
  if (!weather?.latest) return 'No weather observation stored';
  const interpolation = weather.latest.interpolation;
  if (interpolation?.method) {
    const method = String(interpolation.method).replace(/-/g, ' ');
    if (interpolation.exact) return `Exact provider observation (${method})`;
    const distance = Number(interpolation.nearestDistanceKm);
    return `Interpolated ${method}${Number.isFinite(distance) ? ` · nearest ${distance.toFixed(2)} km` : ''}`;
  }
  return 'Provider weather · interpolation provenance unavailable';
};

function MemoryChart({ points }) {
  if (!points?.length) return <p className={styles.empty}>No risk samples have been recorded for this cell yet.</p>;
  const values = points.map((point) => Number(point.compositeRisk) || 0);
  const max = Math.max(7, ...values);
  const min = Math.min(0, ...values);
  const range = Math.max(0.01, max - min);
  const coords = values
    .map((value, index) => {
      const x = 4 + (index / Math.max(1, values.length - 1)) * 292;
      const y = 82 - ((value - min) / range) * 68;
      return `${x},${y}`;
    })
    .join(' ');
  const thresholdY = 82 - ((7 - min) / range) * 68;
  return (
    <svg viewBox="0 0 300 90" className={styles.memoryChart} role="img" aria-label="Composite risk memory for this cell">
      <line x1="4" y1={thresholdY} x2="296" y2={thresholdY} className={styles.thresholdLine} />
      <polyline points={coords} className={styles.memoryLine} />
      <line x1="4" y1="82" x2="296" y2="82" className={styles.axisLine} />
    </svg>
  );
}

function SectionHeader({ icon: Icon, title, note }) {
  return (
    <div className={styles.sectionHeader}>
      <div className={styles.sectionTitleWrap}>
        <Icon size={16} aria-hidden="true" />
        <h2 className={styles.sectionTitle}>{title}</h2>
      </div>
      {note ? <p className={styles.sectionNote}>{note}</p> : null}
    </div>
  );
}

export default function Intelligence() {
  const user = getStoredUser();
  const navItems = useMemo(() => getNavItems(user.role), [user.role]);
  const [cells, setCells] = useState([]);
  const [overview, setOverview] = useState(null);
  const [health, setHealth] = useState(null);
  const [quality, setQuality] = useState(null);
  const [selectedH3, setSelectedH3] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [run, setRun] = useState(null);

  const loadIntelligence = useCallback(async (h3Index) => {
    if (!h3Index) return;
    setLoading(true);
    setError('');
    try {
      const payload = await apiRequest(`/v1/intelligence/cells/${h3Index}/intelligence`);
      setData(payload);
      setQuery(payload.retrieval?.query || '');
      setRun(payload.latestRuns?.[0] || null);
    } catch (requestError) {
      setError(requestError.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [overviewPayload, cellPayload, healthPayload, qualityPayload] = await Promise.all([
          apiRequest('/v1/intelligence/overview'),
          apiRequest('/v1/spatial-cells?limit=200'),
          apiRequest('/v1/intelligence/health').catch(() => null),
          apiRequest('/v1/intelligence/data-quality').catch(() => null),
        ]);
        if (cancelled) return;
        setOverview(overviewPayload);
        setHealth(healthPayload);
        setQuality(qualityPayload);
        const sorted = [...(cellPayload.cells || [])].sort(
          (a, b) => Number(b.compositeRisk || 0) - Number(a.compositeRisk || 0)
        );
        setCells(sorted);
        const chosen = overviewPayload.topRiskCells?.[0]?.h3Index || sorted[0]?.h3Index || '';
        setSelectedH3(chosen);
      } catch (requestError) {
        if (!cancelled) setError(requestError.message);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedH3) loadIntelligence(selectedH3);
  }, [selectedH3, loadIntelligence]);

  useEffect(() => {
    let cancelled = false;
    const refreshQuality = async () => {
      try {
        const [overall, cell] = await Promise.all([
          apiRequest('/v1/intelligence/data-quality'),
          selectedH3
            ? apiRequest(`/v1/intelligence/data-quality?h3Index=${encodeURIComponent(selectedH3)}`)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setQuality(overall);
        if (cell) {
          setData((current) => (current ? { ...current, dataQuality: cell } : current));
        }
      } catch {
        // Keep the last live snapshot rather than replacing it with an error.
      }
    };
    const timer = setInterval(refreshQuality, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selectedH3]);

  const selectedCell = useMemo(
    () => cells.find((cell) => cell.h3Index === selectedH3) || data?.cell || null,
    [cells, selectedH3, data]
  );

  const status = health?.status || (error ? 'degraded' : 'checking');
  const memory = data?.memory;
  const multi = data?.multiResolution;
  const graph = data?.graph;
  const retrieval = data?.retrieval;
  const cellQuality = data?.dataQuality;
  const trace = run?.trace || [];

  const refreshKnowledge = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest('/v1/intelligence/knowledge/rebuild', { method: 'POST' });
      setNotice(`Knowledge base rebuilt: ${result.documents} documents (${result.incidents} incidents, ${result.sops} playbooks).`);
      await loadIntelligence(selectedH3);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }, [loadIntelligence, selectedH3]);

  const runAgents = useCallback(async () => {
    if (!selectedH3) return;
    setRunning(true);
    setError('');
    setNotice('');
    try {
      const result = await apiRequest(`/v1/intelligence/cells/${selectedH3}/agents`, { method: 'POST', body: {} });
      setRun(result);
      setNotice('Advisory agent workflow completed. No crew, SMS or incident status was changed.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRunning(false);
    }
  }, [selectedH3]);

  const searchEvidence = useCallback(
    async (event) => {
      event.preventDefault();
      if (!selectedH3) return;
      setBusy(true);
      setError('');
      try {
        const result = await apiRequest(
          `/v1/intelligence/cells/${selectedH3}/retrieve?q=${encodeURIComponent(query)}&k=6`
        );
        setData((current) => ({ ...current, retrieval: result }));
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setBusy(false);
      }
    },
    [query, selectedH3]
  );

  const handleSignOut = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      /* local session is cleared either way */
    }
    clearSession();
    window.location.assign('/');
  }, []);

  return (
    <AppShell
      title="H3 intelligence"
      titleAs="span"
      cityCode={user.cityCode}
      user={user}
      navItems={navItems}
      onSignOut={handleSignOut}
    >
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <div className={styles.eyebrow}>
              <BrainCircuit size={14} aria-hidden="true" />
              Python intelligence microservice
            </div>
            <h1 className={styles.title}>One cell, every scale of context</h1>
            <p className={styles.description}>
              Cell memory, multi-resolution H3, graph propagation, hybrid retrieval and a
              LangGraph incident workflow. The Node API authenticates every call; the browser
              never reaches the Python service directly.
            </p>
          </div>
          <div className={styles.headerMeta}>
            <span className={styles.statusChip} data-status={status}>
              <span className={styles.statusDot} aria-hidden="true" />
              {status === 'healthy' ? 'Service healthy' : status === 'degraded' ? 'Service degraded' : 'Checking service'}
            </span>
            <span className={styles.providerChip}>
              <Database size={12} aria-hidden="true" />
              {health?.providers?.vectorStore || 'MongoDB local vectors'}
            </span>
            <span className={styles.providerChip}>
              <Sparkles size={12} aria-hidden="true" />
              {health?.providers?.briefGeneration === 'cloudflare-workers-ai'
                ? 'Cloudflare AI briefs'
                : health?.providers?.briefGeneration === 'openai'
                  ? 'OpenAI briefs'
                  : 'Deterministic brief'}
            </span>
            <span className={styles.providerChip}>
              <Database size={12} aria-hidden="true" />
              {health?.realtime?.mode === 'change-stream'
                ? 'Live Mongo stream'
                : health?.realtime?.mode === 'polling'
                  ? 'Live Mongo poll'
                  : 'Live sync starting'}
            </span>
          </div>
        </header>

        {error ? <Notice tone="error">{error}</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}

        <section className={styles.statGrid} aria-label="Intelligence overview">
          <StatBlock label="H3 cells" value={overview?.cells ?? '—'} period="Across all configured cities" />
          <StatBlock label="Peak city risk" value={overview?.peakRisk ?? '—'} unit="/10" period="Computed from stored cell scores" />
          <StatBlock
            label="Historical incidents"
            value={overview?.historicalIncidents ?? '—'}
            period="Indexed for retrieval"
          />
          <StatBlock label="Agent runs" value={overview?.agentRuns ?? '—'} period="Advisory workflows recorded" />
        </section>

        <section className={styles.qualityCard} aria-label="Live data quality">
          <SectionHeader
            icon={ShieldCheck}
            title="Live data quality"
            note="Aggregated from the current telemetryevents collection on every refresh. No fixed sample values."
          />
          <div className={styles.qualityGrid}>
            <div className={styles.qualityMetric}>
              <span className={styles.metricLabel}>Telemetry events</span>
              <strong>{quality?.totalEvents ?? '—'}</strong>
              <small>{quality?.sourceCounts?.length ?? 0} source types stored</small>
            </div>
            <div className={styles.qualityMetric} data-tone={(quality?.synthetic ?? 0) === 0 ? 'good' : 'warn'}>
              <span className={styles.metricLabel}>Synthetic flag</span>
              <strong>{quality?.synthetic ?? '—'}</strong>
              <small>rawPayload.synthetic</small>
            </div>
            <div className={styles.qualityMetric} data-tone={(quality?.simulated ?? 0) === 0 ? 'good' : 'warn'}>
              <span className={styles.metricLabel}>Simulated flag</span>
              <strong>{quality?.simulated ?? '—'}</strong>
              <small>rawPayload.simulated</small>
            </div>
            <div
              className={styles.qualityMetric}
              data-tone={quality?.freshness === 'fresh' ? 'good' : quality?.freshness === 'no-data' ? 'warn' : 'caution'}
            >
              <span className={styles.metricLabel}>Last observation</span>
              <strong>{quality ? ageAgo(quality.lastObservedAt) : '—'}</strong>
              <small>{quality?.freshness || 'loading'}</small>
            </div>
            <div className={styles.qualityMetric}>
              <span className={styles.metricLabel}>Weather interpolation</span>
              <strong>{quality?.weather ? `${quality.weather.interpolated}/${quality.weather.events}` : '—'}</strong>
              <small>
                {quality?.weather?.averageNearestDistanceKm != null
                  ? `avg nearest ${quality.weather.averageNearestDistanceKm} km`
                  : 'no distance recorded'}
              </small>
            </div>
          </div>
          <div className={styles.sourceRow}>
            {(quality?.sourceCounts || []).map((source) => (
              <span key={source.sourceType} className={styles.sourcePill}>
                {sourceLabel(source.sourceType)}
                <strong>{source.count}</strong>
              </span>
            ))}
            {!quality?.sourceCounts?.length ? <span className={styles.emptyInline}>No telemetry stored.</span> : null}
          </div>
          <div className={styles.qualityFooter}>
            <span>
              <CloudRain size={12} aria-hidden="true" /> {interpolationLabel(quality?.weather)}
            </span>
            <span>
              <Clock3 size={12} aria-hidden="true" /> Cell updated {ageAgo(quality?.latestCellUpdate)}
            </span>
            <span>
              <RefreshCw size={12} aria-hidden="true" /> Snapshot {formatClock(quality?.generatedAt)}
            </span>
          </div>
        </section>

        <section className={styles.selectorBar} aria-label="Select a cell">
          <div className={styles.selectorIntro}>
            <Layers3 size={16} aria-hidden="true" />
            <span>Inspect one cell</span>
          </div>
          <Select value={selectedH3} onChange={(event) => setSelectedH3(event.target.value)} aria-label="H3 cell">
            {cells.map((cell) => (
              <option key={cell.h3Index} value={cell.h3Index}>
                {CITY_NAMES[cell.cityCode] || cell.cityCode || 'City'} · {cellLabel(cell)} · {Number(cell.compositeRisk || 0).toFixed(2)}
              </option>
            ))}
          </Select>
          <span className={styles.selectorId}>{selectedH3 || 'No cell selected'}</span>
          <Button variant="secondary" size="sm" onClick={() => loadIntelligence(selectedH3)} loading={loading}>
            <RefreshCw size={14} aria-hidden="true" />
            Refresh
          </Button>
        </section>

        {loading && !data ? (
          <div className={styles.loadingGrid}>
            <Skeleton height={220} />
            <Skeleton height={220} />
            <Skeleton height={220} />
          </div>
        ) : null}

        {!loading && !data && !error ? (
          <EmptyState title="No intelligence for this cell" description="Select a cell with stored risk history or run the data pipeline first." />
        ) : null}

        {data ? (
          <>
            <section className={styles.cellHeader} aria-label="Selected cell">
              <div>
                <p className={styles.eyebrow}>Selected cell</p>
                <h2 className={styles.cellTitle}>{cellLabel(data.cell)}</h2>
                <p className={styles.cellSubtitle}>
                  {data.cell.h3Index} · {CITY_NAMES[data.cell.cityCode] || data.cell.cityCode || 'Unknown city'}
                  {data.cell.context?.waterway ? ` · near ${data.cell.context.waterway}` : ''}
                </p>
              </div>
              <div className={styles.cellScore}>
                <div className={styles.cellScoreValue}>
                  <SeverityBadge severity={severityFor(data.cell.compositeRisk)} label={`${Number(data.cell.compositeRisk || 0).toFixed(2)} composite`} />
                  <span className={styles.cellEvidence}>{memory?.personality?.label?.replace(/-/g, ' ') || 'profile warming up'}</span>
                  <span className={styles.cellProvenanceNote}>Computed score from stored telemetry, not a direct sensor reading</span>
                </div>
                <div className={styles.cellProvenance}>
                  <span>
                    <CloudRain size={12} aria-hidden="true" /> {interpolationLabel(cellQuality?.weather)}
                  </span>
                  <span>
                    <Clock3 size={12} aria-hidden="true" /> Weather observed {ageAgo(cellQuality?.weather?.latest?.observedAt)}
                  </span>
                  <span>
                    <Database size={12} aria-hidden="true" /> Cell updated {ageAgo(cellQuality?.latestCellUpdate)}
                  </span>
                </div>
              </div>
            </section>

            <div className={styles.mainGrid}>
              <section className={styles.card} aria-label="Cell memory">
                <SectionHeader icon={Activity} title="Cell memory" note="Stored score history; weather may be interpolated" />
                <div className={styles.memoryStats}>
                  <div>
                    <span className={styles.metricLabel}>Samples</span>
                    <strong>{memory?.summary?.sampleCount ?? 0}</strong>
                  </div>
                  <div>
                    <span className={styles.metricLabel}>Baseline</span>
                    <strong>{memory?.summary?.baselineRisk ?? 0}</strong>
                  </div>
                  <div>
                    <span className={styles.metricLabel}>Peak</span>
                    <strong>{memory?.summary?.peakRisk ?? 0}</strong>
                  </div>
                  <div>
                    <span className={styles.metricLabel}>Trend</span>
                    <strong>{memory?.summary?.trend?.direction || 'unknown'}</strong>
                  </div>
                </div>
                <MemoryChart points={memory?.riskHistory || []} />
                <div className={styles.metaRow}>
                  <span><Clock3 size={12} aria-hidden="true" /> Volatility {memory?.summary?.trend?.volatility ?? 0}</span>
                  <span><GitBranch size={12} aria-hidden="true" /> {memory?.summary?.seasonality?.pattern || 'uniform'} pattern</span>
                  <span><CheckCircle2 size={12} aria-hidden="true" /> {memory?.personality?.incidentCount ?? 0} remembered incidents</span>
                  <span>
                    <Sparkles size={12} aria-hidden="true" /> Projected 3h {memory?.predictivePattern?.next3HourRisk ?? 0} ·{' '}
                    {memory?.predictivePattern?.label || 'warming up'}
                  </span>
                </div>
                <p className={styles.insight}>
                  {memory?.predictivePattern?.method}. Event memory: {memory?.eventPatterns?.recurrencePattern || 'no record'}.
                </p>
              </section>

              <section className={styles.card} aria-label="Multi-resolution H3">
                <SectionHeader icon={Layers3} title="Multi-resolution H3" note="Derived by grouping stored cells at H3 parents" />
                <div className={styles.resolutionList}>
                  {(multi?.resolutions || []).map((level) => (
                    <div key={level.resolution} className={styles.resolutionRow}>
                      <div className={styles.resolutionTop}>
                        <span className={styles.resBadge}>H3 r{level.resolution}</span>
                        <span className={styles.resLabel}>{level.label}</span>
                        <strong className={styles.resRisk}>{level.averageRisk}</strong>
                      </div>
                      <div className={styles.resTrack} aria-hidden="true">
                        <span className={styles.resFill} style={{ width: `${Math.min(100, Number(level.averageRisk) * 10)}%` }} />
                      </div>
                      <p className={styles.resMeta}>
                        {level.cellCount} cells · peak {level.peakRisk} · {formatPercent(level.contribution)} of parent risk
                      </p>
                    </div>
                  ))}
                </div>
                <p className={styles.insight}>{multi?.insight}</p>
              </section>

              <section className={styles.card} aria-label="H3 graph">
                <SectionHeader icon={Network} title="Propagation graph" note="Derived from stored cell adjacency, weighted by risk difference" />
                <div className={styles.graphSummary}>
                  <div>
                    <span className={styles.metricLabel}>Nodes / edges</span>
                    <strong>{graph?.nodeCount ?? 0} / {graph?.edgeCount ?? 0}</strong>
                  </div>
                  <div>
                    <span className={styles.metricLabel}>Flow</span>
                    <strong>{graph?.cascadeDirection || 'stable'}</strong>
                  </div>
                  <div>
                    <span className={styles.metricLabel}>Critical hub</span>
                    <strong className={styles.mono}>{graph?.criticalHub?.slice(0, 10) || '—'}</strong>
                  </div>
                </div>
                <div className={styles.route}>
                  <span className={styles.metricLabel}>Containment</span>
                  <p className={styles.routeNote}>{graph?.containment?.recommendation}</p>
                </div>
                <div className={styles.route}>
                  <span className={styles.metricLabel}>Response route</span>
                  <div className={styles.routeLine}>
                    {(graph?.responseRoute || []).length ? (
                      graph.responseRoute.map((node, index) => (
                        <span key={node} className={styles.routeNode}>
                          <span className={styles.mono}>{node.slice(-6)}</span>
                          {index < graph.responseRoute.length - 1 ? <ArrowRight size={11} aria-hidden="true" /> : null}
                        </span>
                      ))
                    ) : (
                      <span className={styles.emptyInline}>No route within the loaded graph.</span>
                    )}
                  </div>
                </div>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">Cell</th>
                        <th scope="col">Risk</th>
                        <th scope="col">Betweenness</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(graph?.nodes || []).slice(0, 5).map((node) => (
                        <tr key={node.h3Index}>
                          <td className={styles.mono}>{node.h3Index.slice(-8)}</td>
                          <td>{node.risk}</td>
                          <td>{node.betweennessCentrality}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <section className={styles.card} aria-label="Hybrid retrieval">
              <SectionHeader
                icon={Search}
                title="Grounded evidence"
                note="Spatial proximity + semantic match + season/time + outcome"
              />
              <form className={styles.searchForm} onSubmit={searchEvidence}>
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ask for flood, traffic, escalation or field evidence"
                  aria-label="Retrieval query"
                />
                <Button type="submit" variant="secondary" loading={busy}>
                  <Search size={14} aria-hidden="true" />
                  Retrieve
                </Button>
              </form>
              <p className={styles.retrievalMeta}>
                {retrieval?.method} ·{' '}
                {retrieval?.embeddingProvider === 'cloudflare-workers-ai'
                  ? 'Cloudflare AI'
                  : retrieval?.embeddingProvider === 'openai'
                    ? 'OpenAI'
                    : 'local hashed'}{' '}
                embeddings ·{' '}
                <span className={styles.warnText}>
                  <TriangleAlert size={11} aria-hidden="true" /> playbooks are project templates, not official SOPs
                </span>
              </p>
              <div className={styles.evidenceGrid}>
                {(retrieval?.results || []).map((item) => (
                  <article key={item.docId} className={styles.evidenceCard}>
                    <div className={styles.evidenceTop}>
                      <span className={styles.sourceTag} data-source={item.sourceType}>
                        {item.sourceType === 'historical_incident' ? 'Historical incident' : 'Playbook'}
                      </span>
                      <span className={styles.score}>{formatPercent(item.score)}</span>
                    </div>
                    <h3 className={styles.evidenceTitle}>{item.title}</h3>
                    <p className={styles.evidenceText}>{item.snippet}</p>
                    <div className={styles.scoreRow}>
                      <span>Semantic {formatPercent(item.semanticScore)}</span>
                      <span>Spatial {formatPercent(item.spatialScore)}</span>
                      <span>Temporal {formatPercent(item.temporalScore)}</span>
                    </div>
                    {item.sourceType === 'historical_incident' ? (
                      <p className={styles.evidenceFoot}>
                        {item.outcome} · {item.season} · {item.h3Index?.slice(-8)}
                      </p>
                    ) : (
                      <p className={styles.evidenceFoot}>Project playbook · not an official municipal SOP</p>
                    )}
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.agentCard} aria-label="LangGraph agent workflow">
              <div className={styles.agentHeader}>
                <div>
                  <div className={styles.eyebrow}>
                    <BrainCircuit size={14} aria-hidden="true" />
                    LangGraph orchestration
                  </div>
                  <h2 className={styles.agentTitle}>Incident resolution agents</h2>
                  <p className={styles.sectionNote}>
                    Detect → assess → retrieve → allocate → communicate → execute → escalate → learn.
                    This is a dry run: it reads live state, writes an evidence sample, and leaves dispatch to an operator.
                  </p>
                </div>
                <Button variant="primary" onClick={runAgents} loading={running}>
                  <Play size={14} aria-hidden="true" />
                  Run agent workflow
                </Button>
              </div>

              {!run ? (
                <p className={styles.empty}>No agent run for this cell yet. Run the workflow to see the trace.</p>
              ) : (
                <div className={styles.agentGrid}>
                  <div className={styles.tracePanel}>
                    <div className={styles.traceHeader}>
                      <span>Run {run.runId?.slice(0, 8)}</span>
                      <span>{run.completedAt ? new Date(run.completedAt).toLocaleTimeString() : ''}</span>
                    </div>
                    <ol className={styles.traceList}>
                      {trace.map((step) => (
                        <li key={step.node} className={styles.traceStep}>
                          <span className={styles.traceDot} aria-hidden="true" />
                          <div>
                            <p className={styles.traceNode}>{step.node.replace(/_/g, ' ')}</p>
                            <p className={styles.traceSummary}>{step.summary}</p>
                            <span className={styles.traceDuration}>{step.durationMs} ms</span>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className={styles.agentResult}>
                    <div className={styles.resultTop}>
                      <SeverityBadge severity={severityFor(run.riskAssessment?.effectiveRisk || 0)} label={`${run.severity} · ${run.urgency}`} />
                      <span className={styles.providerChip}>
                        {run.brief?.provider === 'cloudflare-workers-ai'
                          ? 'Cloudflare AI'
                          : run.brief?.provider === 'openai'
                            ? 'OpenAI'
                            : 'deterministic'}
                      </span>
                    </div>
                    <p className={styles.brief}>{run.brief?.text}</p>
                    <dl className={styles.resultFacts}>
                      <div>
                        <dt>Effective risk</dt>
                        <dd>{run.riskAssessment?.effectiveRisk}/10</dd>
                      </div>
                      <div>
                        <dt>Planning estimate</dt>
                        <dd>{run.estimatedResolutionMinutes} min</dd>
                      </div>
                      <div>
                        <dt>Advisory escalation</dt>
                        <dd>{run.escalation?.recommended ? 'Recommended' : 'Not needed'}</dd>
                      </div>
                    </dl>
                    <div className={styles.crewList}>
                      <span className={styles.metricLabel}>Crew options</span>
                      {(run.assignedCrews || []).length ? (
                        run.assignedCrews.map((crew) => (
                          <span key={crew.id} className={styles.crewChip}>
                            {crew.name}
                            {crew.staffId ? ` · ${crew.staffId}` : ` · ${crew.id.slice(-4)}`}{' '}
                            <small>{crew.match}</small>
                          </span>
                        ))
                      ) : (
                        <span className={styles.emptyInline}>No active field crew found.</span>
                      )}
                    </div>
                    <p className={styles.dispatch}>{run.dispatchMessage}</p>
                    <p className={styles.learningNote}>{run.learning?.reason}</p>
                  </div>
                </div>
              )}
            </section>

            <div className={styles.bottomGrid}>
              <section className={styles.card} aria-label="Critical hubs">
                <SectionHeader icon={Network} title="Critical hubs" note="Risk that can spread to neighbours" />
                <ul className={styles.hubList}>
                  {(overview?.criticalHubs || []).map((hub) => (
                    <li key={hub.h3Index}>
                      <button type="button" className={styles.hubButton} onClick={() => setSelectedH3(hub.h3Index)}>
                        <span>
                          <strong>{hub.streets?.join(' · ') || hub.h3Index.slice(-8)}</strong>
                          <small>{hub.cityCode} · {hub.neighbourCount} neighbours</small>
                        </span>
                        <span className={styles.hubScore}>{hub.spreadRisk}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <section className={styles.card} aria-label="Memory incidents">
                <SectionHeader icon={Clock3} title="Remembered incidents" note="Outcomes that inform the next response" />
                {memory?.incidentHistory?.length ? (
                  <ul className={styles.incidentList}>
                    {memory.incidentHistory.slice(0, 5).map((incident) => (
                      <li key={incident.incidentId}>
                        <span className={styles.incidentType}>{incident.type}</span>
                        <span className={styles.incidentMeta}>{incident.status} · risk {incident.riskScore}</span>
                        <span className={styles.incidentDate}>
                          {incident.detectedAt ? new Date(incident.detectedAt).toLocaleDateString() : '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.empty}>No incident has been recorded for this cell.</p>
                )}
                {user.role === 'administrator' ? (
                  <Button variant="ghost" size="sm" onClick={refreshKnowledge} loading={busy}>
                    <RefreshCw size={13} aria-hidden="true" />
                    Rebuild knowledge base
                  </Button>
                ) : null}
              </section>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}