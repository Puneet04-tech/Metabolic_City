import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair } from 'lucide-react';
import HexLayer from './HexLayer';
import { getMapTheme } from '../../lib/mapTheme.js';
import { cn } from '../ui/cn';
import styles from './MapCanvas.module.css';

const LEGEND_ITEMS = [
  { key: 'critical', label: 'Critical' },
  { key: 'caution', label: 'Caution' },
  { key: 'normal', label: 'Normal' },
];

/**
 * The shared map surface: one Leaflet instance, one canvas hex layer, a
 * legend overlay and zoom + fit controls. The tile style comes from the map
 * theme, so every map in the product looks the same.
 */
export default function MapCanvas({
  cells = [],
  mode = 'composite',
  threshold = 7,
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
        preferCanvas: true,
      }).setView([23.2599, 77.4126], 11);

      const tiles = L.tileLayer(theme.tile.url, {
        attribution: theme.tile.attribution,
        maxZoom: 19,
        updateWhenIdle: true,
        keepBuffer: 2,
      });
      tiles.getContainer()?.style.setProperty('filter', theme.tile.filter);
      tiles.addTo(map);

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
    layerRef.current.setCells(cells, mode, threshold);
  }, [cells, mode, threshold]);

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

  // Fit the view to the cells, but only when a cell is chosen from the list.
  const fitToCells = useCallback(() => {
    const bounds = layerRef.current?.bounds();
    if (bounds && bounds.isValid()) {
      mapRef.current?.fitBounds(bounds.pad(0.15), { maxZoom: 14, animate: true });
    }
  }, []);

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

      <ul className={styles.legend} aria-label="Risk bands">
        {LEGEND_ITEMS.map((item) => (
          <li key={item.key} className={styles.legendItem}>
            <span className={cn(styles.legendSwatch, styles[`swatch${item.key[0].toUpperCase()}${item.key.slice(1)}`])} />
            {item.label}
          </li>
        ))}
      </ul>

      <button type="button" className={styles.fitButton} onClick={fitToCells} aria-label="Fit the map to the active cells">
        <Crosshair size={14} aria-hidden="true" />
        Fit to cells
      </button>
    </div>
  );
}
