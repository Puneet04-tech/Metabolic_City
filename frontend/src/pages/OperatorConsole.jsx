import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import AppShell from '../components/shell/AppShell/AppShell';
import MapCanvas from '../components/map/MapCanvas';
import CellDetail from '../components/Operator/CellDetail';
import CellList from '../components/Operator/CellList';
import LensFilter from '../components/Operator/LensFilter';
import SummaryStrip from '../components/Operator/SummaryStrip';
import TelemetryStatus from '../components/Operator/TelemetryStatus';
import SearchInput from '../components/ui/SearchInput/SearchInput';
import Select from '../components/ui/Select/Select';
import { apiRequest, clearSession, getStoredUser } from '../api.js';
import {
  allInOneBand,
  cellBandFor,
  countByBand,
  getCellLabel,
  sortCells,
} from '../lib/cells/index.js';
import { getNavItems } from '../lib/routes.js';
import useLiveCells from '../lib/useLiveCells.js';
import styles from './OperatorConsole.module.css';

const THRESHOLD = 7;

/** The municipalities the console can show, by the code the cells carry. */
const CITY_NAMES = {
  'CITY-MP-BPL': 'Bhopal',
  'CITY-MP-SHR': 'Sehore',
  'CITY-MP-IDR': 'Indore',
  'CITY-MP-AST': 'Ashta',
};

export default function OperatorConsole() {
  const { cells, connection, lastUpdated, serverUpdated, cadence } = useLiveCells();
  const navigate = useNavigate();
  const user = getStoredUser();

  const [mode, setMode] = useState('composite');
  const [search, setSearch] = useState('');
  const [bandFilters, setBandFilters] = useState(() => new Set());
  const [sort, setSort] = useState({ key: 'score', direction: 'desc' });
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [hovered, setHovered] = useState(null);
  const [city, setCity] = useState(null);
  const [relative, setRelative] = useState(false);

  const navItems = useMemo(() => getNavItems(user.role), [user.role]);

  // The server classifies each cell with the municipality's configured
  // threshold, so the band always matches the engine.
  const bandOf = useCallback((cell) => cellBandFor(cell, mode, THRESHOLD), [mode]);

  // The cities that have cells, with the busiest first.
  const cityOptions = useMemo(() => {
    const counts = new Map();
    for (const cell of cells) {
      if (!cell.cityCode) continue;
      counts.set(cell.cityCode, (counts.get(cell.cityCode) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => ({
        value: code,
        label: `${CITY_NAMES[code] || code} (${count})`,
      }));
  }, [cells]);

  // The city with the most cells is the one the operator sees first.
  useEffect(() => {
    if (city !== null || !cityOptions.length) return;
    setCity(cityOptions[0].value);
  }, [cityOptions, city]);

  const cityCells = useMemo(() => {
    if (city === null) return [];
    if (city === 'all') return cells;
    return cells.filter((cell) => cell.cityCode === city);
  }, [cells, city]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query && bandFilters.size === 0) return cityCells;

    return cityCells.filter((cell) => {
      if (bandFilters.size && !bandFilters.has(bandOf(cell))) return false;
      if (!query) return true;
      return cell.h3Index.toLowerCase().includes(query) || getCellLabel(cell).toLowerCase().includes(query);
    });
  }, [cityCells, search, bandFilters, bandOf]);

  const rows = useMemo(() => sortCells(filtered, mode), [filtered, mode]);
  const counts = useMemo(() => countByBand(cityCells, mode, THRESHOLD), [cityCells, mode]);
  const isFiltered = search.trim().length > 0 || bandFilters.size > 0;

  // The relative view only means something when every cell is in the same
  // band, so it is offered only then.
  const relativeAvailable = allInOneBand(cityCells, mode, THRESHOLD);
  useEffect(() => {
    if (!relativeAvailable && relative) setRelative(false);
  }, [relativeAvailable, relative]);

  const toggleBand = useCallback((band) => {
    setBandFilters((previous) => {
      const next = new Set(previous);
      if (next.has(band)) next.delete(band);
      else next.add(band);
      return next;
    });
  }, []);

  const selectCell = useCallback(async (cell) => {
    if (!cell) return;
    setSelected(cell);
    setAction(null);
    setError('');
    setNotice('');
    setActionLoading(true);

    try {
      const data = await apiRequest(`/v1/incidents/${cell.h3Index}/action`);
      setAction(data);
    } catch (requestError) {
      if (requestError.status === 404) {
        setNotice('No incident is attached to this cell yet. It can still be dispatched.');
      } else {
        setError(requestError.message);
      }
    } finally {
      setActionLoading(false);
    }
  }, []);

  const backToList = useCallback(() => {
    setSelected(null);
    setAction(null);
    setError('');
    setNotice('');
  }, []);

  // Escape returns from the detail view to the list.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape' || !selected) return;
      if (document.querySelector('[role="dialog"]')) return;
      backToList();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected, backToList]);

  const lock = useCallback(async () => {
    if (!selected) return;
    try {
      const lockData = await apiRequest(`/v1/incidents/${selected.h3Index}/lock`, { method: 'POST' });
      setAction((current) => ({ ...current, lock: lockData.lock }));
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [selected]);

  const decide = useCallback(
    async (decision) => {
      if (!selected) return;
      try {
        await apiRequest(`/v1/incidents/${selected.h3Index}/decision`, {
          method: 'POST',
          body: { decision, crewId: decision === 'approve' ? null : undefined },
        });
        setNotice(
          decision === 'approve'
            ? 'Alert approved. The field crew has been notified.'
            : 'Alert overridden and recorded in the audit trail.'
        );
        backToList();
      } catch (requestError) {
        setError(requestError.message);
      }
    },
    [selected, backToList]
  );

  const handleSignOut = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      /* the local session is cleared either way */
    }
    clearSession();
    navigate('/');
  }, [navigate]);

  return (
    <AppShell
      title="Operator console"
      cityCode={user.cityCode}
      user={user}
      navItems={navItems}
      onSignOut={handleSignOut}
      viewport
    >
      <div className={styles.console}>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h2 className={styles.title}>Operator console</h2>
            <p className={styles.description}>
              The cells the city is watching, the risk in each one, and the source of every
              reading behind them.
            </p>
          </div>
        </header>

        <div className={styles.toolbar}>
          <TelemetryStatus
            connection={connection}
            lastUpdated={lastUpdated}
            serverUpdated={serverUpdated}
            cadence={cadence}
          />

          <LensFilter mode={mode} onChange={setMode} />

          <label className={styles.cityField}>
            <MapPin size={13} aria-hidden="true" />
            <span className={styles.cityLabel}>City</span>
            <Select
              value={city ?? 'all'}
              onChange={(event) => setCity(event.target.value)}
              aria-label="City"
            >
              <option value="all">All cities</option>
              {cityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>

          {relativeAvailable ? (
            <label className={styles.relativeField}>
              <input
                type="checkbox"
                checked={relative}
                onChange={(event) => setRelative(event.target.checked)}
              />
              <span>Relative</span>
            </label>
          ) : null}

          <SearchInput
            className={styles.search}
            value={search}
            onChange={setSearch}
            placeholder="Search cells"
            aria-label="Search cells by name or identifier"
          />
        </div>

        {relative && relativeAvailable ? (
          <p className={styles.relativeNote}>
            Colours show where each cell sits among these cells, not how severe it is. Every
            cell here is in the same band.
          </p>
        ) : null}

        <div className={styles.body}>
          <MapCanvas
            className={styles.map}
            cells={cityCells}
            mode={mode}
            threshold={THRESHOLD}
            relative={relative && relativeAvailable}
            fitKey={city}
            selectedId={selected ? selected.h3Index : null}
            highlightId={hovered ? hovered.h3Index : null}
            onSelect={selectCell}
            onHover={setHovered}
          />

          <aside className={styles.panel} aria-label="Cell details">
            <SummaryStrip
              counts={counts}
              total={cityCells.length}
              activeFilters={bandFilters}
              onToggle={toggleBand}
            />

            {selected ? (
              <CellDetail
                cell={selected}
                mode={mode}
                threshold={THRESHOLD}
                action={action}
                loading={actionLoading}
                error={error}
                notice={notice}
                onBack={backToList}
                onLock={lock}
                onDecide={decide}
              />
            ) : (
              <CellList
                cells={rows}
                mode={mode}
                threshold={THRESHOLD}
                sort={sort}
                onSortChange={setSort}
                selectedId={selected ? selected.h3Index : null}
                highlightId={hovered ? hovered.h3Index : null}
                onSelect={selectCell}
                onHover={setHovered}
                filtered={isFiltered}
                total={cityCells.length}
              />
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
