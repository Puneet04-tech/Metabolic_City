import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/shell/AppShell/AppShell';
import MapCanvas from '../components/map/MapCanvas';
import CellDetail from '../components/Operator/CellDetail';
import CellList from '../components/Operator/CellList';
import LensFilter from '../components/Operator/LensFilter';
import SummaryStrip from '../components/Operator/SummaryStrip';
import TelemetryStatus from '../components/Operator/TelemetryStatus';
import SearchInput from '../components/ui/SearchInput/SearchInput';
import { apiRequest, clearSession, getStoredUser } from '../api.js';
import { cellBandFor, countByBand, getCellLabel, sortCells } from '../lib/cells/index.js';
import { getNavItems } from '../lib/routes.js';
import useLiveCells from '../lib/useLiveCells.js';
import styles from './OperatorConsole.module.css';

const THRESHOLD = 7;

export default function OperatorConsole() {
  const { cells, connection, lastUpdated } = useLiveCells();
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

  const navItems = useMemo(() => getNavItems(user.role), [user.role]);

  // The server classifies each cell with the municipality's configured
  // threshold, so the band always matches the engine.
  const bandOf = useCallback((cell) => cellBandFor(cell, mode, THRESHOLD), [mode]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query && bandFilters.size === 0) return cells;

    return cells.filter((cell) => {
      if (bandFilters.size && !bandFilters.has(bandOf(cell))) return false;
      if (!query) return true;
      return cell.h3Index.toLowerCase().includes(query) || getCellLabel(cell).toLowerCase().includes(query);
    });
  }, [cells, search, bandFilters, bandOf]);

  const rows = useMemo(() => sortCells(filtered, mode), [filtered, mode]);
  const counts = useMemo(() => countByBand(cells, mode, THRESHOLD), [cells, mode]);
  const isFiltered = search.trim().length > 0 || bandFilters.size > 0;

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
        <div className={styles.toolbar}>
          <TelemetryStatus connection={connection} lastUpdated={lastUpdated} />

          <LensFilter mode={mode} onChange={setMode} />

          <SearchInput
            className={styles.search}
            value={search}
            onChange={setSearch}
            placeholder="Search cells"
            aria-label="Search cells by name or identifier"
          />
        </div>

        <div className={styles.body}>
          <MapCanvas
            className={styles.map}
            cells={cells}
            mode={mode}
            threshold={THRESHOLD}
            selectedId={selected ? selected.h3Index : null}
            highlightId={hovered ? hovered.h3Index : null}
            onSelect={selectCell}
            onHover={setHovered}
          />

          <aside className={styles.panel} aria-label="Cell details">
            <SummaryStrip
              counts={counts}
              total={cells.length}
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
                total={cells.length}
              />
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
