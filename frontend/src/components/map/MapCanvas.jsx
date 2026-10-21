import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair } from 'lucide-react';
import HexLayer from './HexLayer';
import { getMapTheme } from '../../lib/mapTheme.js';
import { LENS_CODES, LENS_NAMES, lensScale } from '../../lib/cells/index.js';
import { cn } from '../ui/cn';
import Button from '../ui/Button/Button';
import styles from './MapCanvas.module.css';

/** The zoom a cell stays readable at, and the furthest out the map goes. */
const MIN_READABLE_ZOOM = 12.5;
const MAX_FIT_ZOOM = 13.5;

/**
 * The shared map surface: one Leaflet instance, one canvas hex layer, a
 * legend overlay and zoom + fit controls. The tile style comes from the map
 * theme, so every map in the product looks the same.
 */
export default function MapCanvas({
  cells = [],
  mode = 'composite',
  threshold = 7,
  relative = false,
  fitKey = null,
  selectedId = null,
  highlightId = null,
  onSelect,
  onHover,
  className,
}) {
  const [node, setNode] = useState(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const theme = getMapTheme();

  const onSelectRef = useRef(onSelect);
  const onHoverRef = useRef(onHover);
  onSelectRef.current = onSelect;
  onHoverRef.current = onHover;

  // Create the map once.
  useEffect(() => {
    if (!node || mapRef.current) return undefined;

    let map;
    try {
      const theme = getMapTheme();
      map = L.map(node, {
        keyboard: true,
        zoomControl: true,
        attributionControl: true,
        zoomSnap: 0.5,
        zoomDelta: 0.5,
        minZoom: 9,
        preferCanvas: true,
      }).setView([23.2599, 77.4126], 12.5);

      const tiles = L.tileLayer(theme.tile.url, {
        attribution: theme.tile.attribution,
        maxZoom: 19,
        updateWhenIdle: true,
        keepBuffer: 2,
      });
      tiles.addTo(map);
      // The filter is set once the layer is on the map: before that there is
      // no container to put it on, and the map stays light.
      tiles.getContainer()?.style.setProperty('filter', theme.tile.filter);

      layerRef.current = new HexLayer().addTo(map);

      let hoverFrame = null;
      let hovered = null;

      const renderHover = () => {
        hoverFrame = null;
        const hit = hovered ? layerRef.current?.hitTest(hovered.point) : null;
        layerRef.current?.setHover(hit ? hit.index : -1);
        onHoverRef.current?.(hit ? hit.shape.cell : null);
      };

      const onMouseMove = (event) => {
        if (hoverFrame) return;
        hoverFrame = requestAnimationFrame(() => {
          hovered = { point: event.containerPoint };
          renderHover();
        });
      };

      const onMouseOut = () => {
        hovered = null;
        renderHover();
      };

      const onClick = (event) => {
        const hit = layerRef.current?.hitTest(event.containerPoint);
        if (hit) onSelectRef.current?.(hit.shape.cell);
      };

      map.on('mousemove', onMouseMove);
      map.on('mouseout', onMouseOut);
      map.on('click', onClick);

      mapRef.current = map;

      const invalidate = () => map.invalidateSize({ animate: false });
      const raf = requestAnimationFrame(invalidate);
      const t1 = setTimeout(invalidate, 250);
      window.addEventListener('resize', invalidate);

      return () => {
        clearTimeout(t1);
        cancelAnimationFrame(raf);
        if (hoverFrame) cancelAnimationFrame(hoverFrame);
        window.removeEventListener('resize', invalidate);
        map.off('mousemove', onMouseMove);
        map.off('mouseout', onMouseOut);
        map.off('click', onClick);
        try {
          map.remove();
        } catch {
          /* the container may already be gone */
        }
        mapRef.current = null;
        layerRef.current = null;
      };
    } catch (error) {
      console.error('Map init error:', error);
      setFailed(true);
      return undefined;
    }
  }, [node]);

  // Keep the canvas in step with the container.
  useEffect(() => {
    if (!node || !mapRef.current) return undefined;
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => mapRef.current?.invalidateSize({ animate: false }));
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  // Push cells and the active lens into the layer.
  useEffect(() => {
    if (!layerRef.current) return;
    layerRef.current.setCells(cells, mode, threshold, { relative });
  }, [cells, mode, threshold, relative]);

  // Highlight and selection.
  useEffect(() => {
    if (!layerRef.current) return;
    const list = cells || [];
    const selectedAt = selectedId ? list.findIndex((cell) => cell.h3Index === selectedId) : -1;
    layerRef.current.setSelected(selectedAt);
  }, [selectedId, cells]);

  useEffect(() => {
    if (!layerRef.current) return;
    const list = cells || [];
    const highlightAt = highlightId ? list.findIndex((cell) => cell.h3Index === highlightId) : -1;
    layerRef.current.setHover(highlightAt);
  }, [highlightId, cells]);

  /**
   * Fit the map to the cells that are being shown.
   *
   * The zoom is kept inside the range where a cell is still readable, so
   * the operator never ends up looking at a map of invisible hexagons.
   */
  const fitToCells = useCallback(() => {
    const bounds = layerRef.current?.bounds();
    if (bounds && bounds.isValid()) {
      mapRef.current?.fitBounds(bounds.pad(0.1), {
        maxZoom: MAX_FIT_ZOOM,
        animate: true,
      });
      const zoom = mapRef.current.getZoom();
      if (zoom < MIN_READABLE_ZOOM) {
        mapRef.current.setZoom(MIN_READABLE_ZOOM, { animate: false });
      }
    }
  }, []);

  /**
   * Frame the cells whenever the set being shown changes, so the map always
   * opens on the city the operator is looking at rather than on the last
   * place the pointer was.
   */
  const framedKeyRef = useRef(null);
  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return;
    if (!cells?.length) return;
    const key = `${fitKey ?? 'all'}:${cells.length}`;
    if (framedKeyRef.current === key) return;
    framedKeyRef.current = key;

    const bounds = layerRef.current.bounds();
    if (bounds && bounds.isValid()) {
      mapRef.current.fitBounds(bounds.pad(0.1), { maxZoom: MAX_FIT_ZOOM, animate: false });
      if (mapRef.current.getZoom() < MIN_READABLE_ZOOM) {
        mapRef.current.setZoom(MIN_READABLE_ZOOM, { animate: false });
      }
    }
  }, [cells, fitKey]);

  const flyToCell = useCallback(
    (h3Index) => {
      if (!mapRef.current || !layerRef.current) return;
      const list = cells || [];
      const index = list.findIndex((cell) => cell.h3Index === h3Index);
      if (index < 0) return;
      const center = layerRef.current.centerOf(index);
      if (!center) return;

      const point = mapRef.current.latLngToContainerPoint(center);
      const size = mapRef.current.getSize();
      const offScreen = point.x < 48 || point.y < 48 || point.x > size.x - 48 || point.y > size.y - 48;
      if (offScreen) {
        mapRef.current.flyTo(center, Math.max(mapRef.current.getZoom(), 13), { duration: 0.5 });
      }
    },
    [cells]
  );

  useEffect(() => {
    if (selectedId) flyToCell(selectedId);
  }, [selectedId, flyToCell]);

  // The legend always says which lens it is showing.
  const scale = useMemo(() => lensScale(mode, threshold), [mode, threshold]);
  const code = LENS_CODES[mode] ?? 'Rc';
  const name = LENS_NAMES[mode] ?? 'Risk';

  if (failed) {
    return (
      <div className={styles.error} role="alert">
        The map could not be loaded on this device.
      </div>
    );
  }

  return (
    <div className={cn(styles.wrapper, className)}>
      <div className={styles.canvas} ref={setNode} role="application" aria-label="Map of risk cells" />

      {relative ? (
        <ul className={styles.legend} aria-label="Relative scale">
          <li className={styles.legendTitle}>Relative — position within the band</li>
          {theme.relative.map((colour, index) => (
            <li key={colour} className={styles.legendItem}>
              <span className={styles.legendSwatch} style={{ background: colour }} />
              {index === 0 ? 'lowest' : index === theme.relative.length - 1 ? 'highest' : ''}
            </li>
          ))}
        </ul>
      ) : (
        <ul className={styles.legend} aria-label={`${name} scale`}>
          <li className={styles.legendTitle}>
            {code} — {name}
          </li>
          {scale.map((band) => (
            <li key={band.band} className={styles.legendItem}>
              <span className={cn(styles.legendSwatch, styles[`swatch${band.band[0].toUpperCase()}${band.band.slice(1)}`])} />
              {band.label} {band.text}
            </li>
          ))}
        </ul>
      )}

      <Button
        variant="secondary"
        size="sm"
        className={styles.fitButton}
        onClick={fitToCells}
        aria-label="Fit the map to the cells on screen"
      >
        <Crosshair size={14} aria-hidden="true" />
        Fit to cells
      </Button>
    </div>
  );
}
