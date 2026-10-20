import { memo, useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import * as h3 from 'h3-js';
import 'leaflet/dist/leaflet.css';

const cellBand = (value, threshold) => (value >= threshold ? 'critical' : value >= 4 ? 'warning' : 'normal');

const cellScore = (cell, mode) =>
  mode === 'composite' ? cell.compositeRisk : Number(cell.scores?.[mode]) || 0;

const lensLabels = {
  composite: 'Composite (Rc)',
  mobility: 'Mobility (Sm)',
  climate: 'Climate (Sc)',
  vulnerability: 'Vulnerability (Sv)',
};

const BAND_COLORS = {
  critical: '#FF5C5C',
  warning: '#FFB020',
  normal: '#2DD4A7',
};

const rgba = (hex, alpha) => {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
};

const pointInPolygon = (point, points) => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;
    const intersects = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
};

/* Luminous coordinate grid rendered as map-aligned canvas tiles */
const CoordinateGrid = L.GridLayer.extend({
  createTile(coords) {
    const size = this.getTileSize();
    const tile = L.DomUtil.create('canvas', 'leaflet-grid-canvas');
    tile.width = size.x;
    tile.height = size.y;

    const ctx = tile.getContext('2d');
    const northWest = this._map.unproject(L.point(coords.x * size.x, coords.y * size.y), coords.z);
    const southEast = this._map.unproject(L.point((coords.x + 1) * size.x, (coords.y + 1) * size.y), coords.z);

    ctx.strokeStyle = 'rgba(34, 211, 238, 0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, size.x - 1, size.y - 1);

    ctx.strokeStyle = 'rgba(34, 211, 238, 0.1)';
    ctx.beginPath();
    ctx.moveTo(size.x / 2, 0);
    ctx.lineTo(size.x / 2, size.y);
    ctx.moveTo(0, size.y / 2);
    ctx.lineTo(size.x, size.y / 2);
    ctx.stroke();

    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(103, 232, 249, 0.75)';
    ctx.fillText(`${northWest.lat.toFixed(3)}°N`, 6, 14);
    ctx.fillText(`${northWest.lng.toFixed(3)}°E`, 6, size.y - 8);
    ctx.fillStyle = 'rgba(103, 232, 249, 0.4)';
    ctx.fillText(`${southEast.lat.toFixed(3)}°N`, size.x - 78, size.y - 8);

    return tile;
  },
});

/**
 * Single canvas overlay that paints every H3 cell in one pass.
 * Replaces one SVG path + one DOM marker per cell, so panning and zooming
 * never trigger per-cell DOM reconciliation.
 */
const CellsCanvas = L.Layer.extend({
  onAdd(map) {
    this._map = map;
    this._shapes = [];
    this._frame = null;

    this._canvas = L.DomUtil.create('canvas', 'h3-cells-canvas');
    this._canvas.setAttribute('aria-hidden', 'true');
    map.getContainer().appendChild(this._canvas);
    this._ctx = this._canvas.getContext('2d');

    this._onViewportChange = this._schedule.bind(this);
    map.on('move zoom resize', this._onViewportChange, this);

    this._resize();
    this._draw();
  },

  onRemove(map) {
    if (this._frame) cancelAnimationFrame(this._frame);
    map.off('move zoom resize', this._onViewportChange, this);
    if (this._canvas && this._canvas.parentNode) this._canvas.parentNode.removeChild(this._canvas);
  },

  setCells(cells, mode, threshold) {
    const shapes = [];
    for (const cell of cells || []) {
      let boundary;
      try {
        boundary = h3.cellToBoundary(cell.h3Index);
      } catch (err) {
        continue;
      }
      const value = cellScore(cell, mode);
      const band = cellBand(value, threshold);
      shapes.push({ cell, latlngs: boundary, value, band, points: null });
    }
    this._shapes = shapes;
    this._hoverIndex = -1;
    this._selectedIndex = -1;
    this._schedule();
  },

  setHover(index) {
    if (this._hoverIndex === index) return;
    this._hoverIndex = index;
    this._schedule();
  },

  /** Cell that is currently selected in the list — drawn with a bright ring. */
  setSelected(index) {
    if (this._selectedIndex === index) return;
    this._selectedIndex = index;
    this._schedule();
  },

  /** Lat/lng of a cell so the map can fly to it. */
  centerOf(index) {
    const shape = this._shapes[index];
    if (!shape) return null;
    const count = shape.latlngs.length;
    const lat = shape.latlngs.reduce((acc, latlng) => acc + latlng[0], 0) / count;
    const lng = shape.latlngs.reduce((acc, latlng) => acc + latlng[1], 0) / count;
    return [lat, lng];
  },

  bounds() {
    const points = [];
    for (const shape of this._shapes) points.push(...shape.latlngs);
    return points.length ? L.latLngBounds(points) : null;
  },

  hitTest(point) {
    for (let i = this._shapes.length - 1; i >= 0; i -= 1) {
      const shape = this._shapes[i];
      if (shape.points && pointInPolygon(point, shape.points)) return { shape, index: i };
    }
    return null;
  },

  _resize() {
    const size = this._map.getSize();
    const dpr = window.devicePixelRatio || 1;
    this._canvas.style.width = `${size.x}px`;
    this._canvas.style.height = `${size.y}px`;
    this._canvas.width = Math.max(1, Math.round(size.x * dpr));
    this._canvas.height = Math.max(1, Math.round(size.y * dpr));
    this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  },

  _schedule() {
    if (this._frame) return;
    this._frame = requestAnimationFrame(() => {
      this._frame = null;
      this._draw();
    });
  },

  _draw() {
    const ctx = this._ctx;
    const size = this._map.getSize();
    ctx.clearRect(0, 0, size.x, size.y);

    for (let i = 0; i < this._shapes.length; i += 1) {
      const shape = this._shapes[i];
      const points = shape.latlngs.map((latlng) => this._map.latLngToContainerPoint(latlng));
      shape.points = points;

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let j = 1; j < points.length; j += 1) ctx.lineTo(points[j].x, points[j].y);
      ctx.closePath();

      const color = BAND_COLORS[shape.band];
      const hovered = i === this._hoverIndex;
      const selected = i === this._selectedIndex;
      // Fill intensity scales with risk so the map reads at a glance
      const intensity = Math.min(1, Math.max(0, Number(shape.value) || 0) / 10);
      ctx.fillStyle = rgba(color, hovered || selected ? 0.75 : 0.2 + intensity * 0.45);
      ctx.fill();
      ctx.lineWidth = selected ? 5 : hovered ? 6 : shape.band === 'critical' ? 4 : 3;
      ctx.strokeStyle = selected ? '#E6FAFF' : color;
      ctx.stroke();
    }
  },
});

/**
 * Canvas layer for the pulsing telemetry hot spots.
 * Kept separate from the cell layer so the pulse animation never forces a
 * full cell repaint.
 */
const HotSpotsCanvas = L.Layer.extend({
  onAdd(map) {
    this._map = map;
    this._items = [];
    this._raf = null;
    this._last = 0;

    this._canvas = L.DomUtil.create('canvas', 'h3-hotspots-canvas');
    this._canvas.setAttribute('aria-hidden', 'true');
    map.getContainer().appendChild(this._canvas);
    this._ctx = this._canvas.getContext('2d');

    this._tick = this._tick.bind(this);
    this._raf = requestAnimationFrame(this._tick);
  },

  onRemove(map) {
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._canvas && this._canvas.parentNode) this._canvas.parentNode.removeChild(this._canvas);
  },

  setCells(cells, mode, threshold) {
    const items = [];
    for (const cell of cells || []) {
      let centroid;
      try {
        centroid = h3.cellToLatLng(cell.h3Index);
      } catch (err) {
        continue;
      }
      const value = cellScore(cell, mode);
      const band = cellBand(value, threshold);
      items.push({ latlng: centroid, band });
    }
    this._items = items;
  },

  _resize() {
    const size = this._map.getSize();
    if (this._lastWidth === size.x && this._lastHeight === size.y) return;
    this._lastWidth = size.x;
    this._lastHeight = size.y;
    const dpr = window.devicePixelRatio || 1;
    this._canvas.style.width = `${size.x}px`;
    this._canvas.style.height = `${size.y}px`;
    this._canvas.width = Math.max(1, Math.round(size.x * dpr));
    this._canvas.height = Math.max(1, Math.round(size.y * dpr));
    this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  },

  _tick(time) {
    this._raf = requestAnimationFrame(this._tick);
    if (time - this._last < 32) return; // ~30fps is plenty for a sonar pulse
    this._last = time;
    if (document.hidden) return;

    this._resize();

    const ctx = this._ctx;
    const size = this._map.getSize();
    ctx.clearRect(0, 0, size.x, size.y);

    this._items.forEach((item, index) => {
      const point = this._map.latLngToContainerPoint(item.latlng);
      if (point.x < -40 || point.y < -40 || point.x > size.x + 40 || point.y > size.y + 40) return;

      const color = BAND_COLORS[item.band];
      const phase = ((time % 2800) / 2800 + index * 0.13) % 1;
      const scale = 0.3 + (1.6 - 0.3) * phase;
      const alpha = phase < 0.7 ? 0.95 * (1 - phase / 0.7) : 0;

      if (alpha > 0.01) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4 * scale, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(color, alpha * 0.85);
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  },
});

function H3Map({ cells, mode, threshold, onSelect, highlightIndex, focusIndex }) {
  const [node, setNode] = useState(null);
  const mapRef = useRef(null);
  const cellsLayerRef = useRef(null);
  const spotsLayerRef = useRef(null);
  const tooltipRef = useRef(null);
  const fittedSignatureRef = useRef('');
  const userInteractedRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  const modeRef = useRef(mode);
  const [initError, setInitError] = useState(null);

  onSelectRef.current = onSelect;
  modeRef.current = mode;

  // Initialize Leaflet map once
  useEffect(() => {
    if (!node || mapRef.current) return;

    let map;
    try {
      map = L.map(node, {
        keyboard: true,
        zoomControl: true,
        doubleClickZoom: true,
        attributionControl: true,
        zoomSnap: 0.5,
        zoomDelta: 0.5,
        preferCanvas: true,
      }).setView([23.06, 76.78], 9);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        // Load tiles only once the map settles instead of on every pan frame
        updateWhenIdle: true,
        keepBuffer: 2,
      }).addTo(map);

      cellsLayerRef.current = new CellsCanvas().addTo(map);
      spotsLayerRef.current = new HotSpotsCanvas().addTo(map);

      new CoordinateGrid({ opacity: 1, zIndex: 220, pane: 'overlayPane', updateWhenIdle: true, keepBuffer: 1 }).addTo(map);

      L.control.scale({ position: 'bottomright', metric: true, imperial: false }).addTo(map);

      // Custom canvas tooltip (replaces one Leaflet tooltip per cell)
      const tooltip = L.DomUtil.create('div', 'h3-tooltip');
      tooltip.style.position = 'absolute';
      tooltip.style.display = 'none';
      tooltip.style.pointerEvents = 'none';
      tooltip.style.zIndex = '700';
      map.getContainer().appendChild(tooltip);
      tooltipRef.current = tooltip;

      let hoverFrame = null;
      let hovered = null;

      const renderTooltip = () => {
        hoverFrame = null;
        if (!hovered) {
          tooltip.style.display = 'none';
          return;
        }
        const shape = hovered;
        const center = shape.latlngs.reduce(
          (acc, latlng) => [acc[0] + latlng[0], acc[1] + latlng[1]],
          [0, 0]
        );
        const point = map.latLngToContainerPoint([center[0] / shape.latlngs.length, center[1] / shape.latlngs.length]);
        tooltip.textContent = `${shape.cell.h3Index} - ${lensLabels[modeRef.current]}: ${shape.value.toFixed(2)}`;
        tooltip.style.display = 'block';
        tooltip.style.left = `${point.x}px`;
        tooltip.style.top = `${point.y}px`;
        tooltip.style.transform = 'translate(-50%, -140%)';
      };

      const onMouseMove = (event) => {
        if (hoverFrame) return;
        hoverFrame = requestAnimationFrame(() => {
          // Leaflet normalises its own events — they carry containerPoint,
          // not the DOM clientX/clientY that mouseEventToContainerPoint needs.
          const point = event.containerPoint;
          const hit = cellsLayerRef.current && point ? cellsLayerRef.current.hitTest(point) : null;
          hovered = hit ? hit.shape : null;
          if (cellsLayerRef.current) cellsLayerRef.current.setHover(hit ? hit.index : -1);
          renderTooltip();
        });
      };

      const onMouseOut = () => {
        hovered = null;
        if (cellsLayerRef.current) cellsLayerRef.current.setHover(-1);
        renderTooltip();
      };

      const markUserInteraction = () => {
        userInteractedRef.current = true;
      };

      const onClick = (event) => {
        const point = event.containerPoint;
        const hit = cellsLayerRef.current && point ? cellsLayerRef.current.hitTest(point) : null;
        if (hit) onSelectRef.current(hit.shape.cell);
      };

      map.on('mousemove', onMouseMove);
      map.on('mouseout', onMouseOut);
      map.on('click', onClick);
      map.on('dragstart', markUserInteraction);
      map.on('wheel', markUserInteraction);

      mapRef.current = map;

      // Force Leaflet to recalculate container size after mount
      const invalidate = () => map.invalidateSize();
      const raf = requestAnimationFrame(invalidate);
      const t1 = setTimeout(invalidate, 300);
      const t2 = setTimeout(invalidate, 800);
      window.addEventListener('resize', invalidate);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        cancelAnimationFrame(raf);
        if (hoverFrame) cancelAnimationFrame(hoverFrame);
        window.removeEventListener('resize', invalidate);
        map.off('mousemove', onMouseMove);
        map.off('mouseout', onMouseOut);
        map.off('click', onClick);
        map.off('dragstart', markUserInteraction);
        map.off('wheel', markUserInteraction);
        if (tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
        try { map.remove(); } catch {}
        mapRef.current = null;
        cellsLayerRef.current = null;
        spotsLayerRef.current = null;
        tooltipRef.current = null;
      };
    } catch (err) {
      console.error('Map init error:', err);
      setInitError(err.message);
      return undefined;
    }
  }, [node]);

  // Keep the Leaflet viewport in sync with the (resizable) map container
  useEffect(() => {
    if (!node || !mapRef.current) return undefined;
    const observer = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.invalidateSize({ animate: false });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  // Push cell data into the canvas layers
  useEffect(() => {
    if (!cellsLayerRef.current || !spotsLayerRef.current) return;

    cellsLayerRef.current.setCells(cells, mode, threshold);
    spotsLayerRef.current.setCells(cells, mode, threshold);

    // Fit the viewport only while the operator has not taken manual control,
    // so live telemetry updates never yank the map out from under them.
    const signature = (cells || []).map((cell) => cell.h3Index).join('|');
    if (signature && signature !== fittedSignatureRef.current && !userInteractedRef.current) {
      fittedSignatureRef.current = signature;
      const bounds = cellsLayerRef.current.bounds();
      if (bounds && bounds.isValid()) {
        mapRef.current.fitBounds(bounds.pad(0.15), { maxZoom: 12 });
      }
    }
  }, [cells, mode, threshold, node]);

  // Link the list selection / hover highlight to the map
  useEffect(() => {
    if (!cellsLayerRef.current) return;
    const list = cells || [];
    const hoverAt = highlightIndex ? list.findIndex((cell) => cell.h3Index === highlightIndex) : -1;
    const selectAt = focusIndex ? list.findIndex((cell) => cell.h3Index === focusIndex) : -1;
    cellsLayerRef.current.setHover(hoverAt);
    cellsLayerRef.current.setSelected(selectAt);
  }, [highlightIndex, focusIndex, cells]);

  // Fly the map to a cell picked from the list (only when it is off-screen)
  useEffect(() => {
    if (!focusIndex || !mapRef.current || !cellsLayerRef.current) return;
    const list = cells || [];
    const index = list.findIndex((cell) => cell.h3Index === focusIndex);
    if (index < 0) return;
    const center = cellsLayerRef.current.centerOf(index);
    if (!center) return;

    const point = mapRef.current.latLngToContainerPoint(center);
    const size = mapRef.current.getSize();
    const offScreen =
      point.x < 48 || point.y < 48 || point.x > size.x - 48 || point.y > size.y - 48;
    if (offScreen) {
      mapRef.current.flyTo(center, Math.max(mapRef.current.getZoom(), 12), { duration: 0.6 });
    }
  }, [focusIndex, cells]);

  // Keyboard shortcut for map navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onSelectRef.current(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (initError) {
    return (
      <div className="map-error">
        <p>Map failed to initialize: {initError}</p>
      </div>
    );
  }

  return (
    <div className="map-frame">
      <div
        className="map-canvas"
        ref={setNode}
        role="application"
        aria-label="Interactive H3 risk cell map"
        aria-description="Map showing H3 spatial cells with risk scores. Use arrow keys to navigate between cells, Enter or Space to select a cell, Escape to deselect."
        tabIndex={0}
      />
      {(!cells || cells.length === 0) && (
        <div className="map-empty-overlay">
          <h4>No active cells</h4>
          <p>Telemetry data is being loaded. Check the SSE connection.</p>
        </div>
      )}
    </div>
  );
}

export default memo(H3Map);
