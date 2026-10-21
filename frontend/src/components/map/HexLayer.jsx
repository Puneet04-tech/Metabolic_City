import L from 'leaflet';
import * as h3 from 'h3-js';
import { getMapTheme } from '../../lib/mapTheme.js';
import { cellBandFor } from '../../lib/cells/index.js';
import styles from './HexLayer.module.css';

/**
 * HexLayer — every H3 cell drawn on one canvas.
 *
 * One canvas replaces one SVG path and one DOM marker per cell, so panning
 * and zooming never trigger per-cell DOM work. Colours come from the shared
 * map theme; the fill opacity is constant so the map reads as a flat layer
 * rather than a heat map.
 */
const HexLayer = L.Layer.extend({
  onAdd(map) {
    this._map = map;
    this._shapes = [];
    this._hoverIndex = -1;
    this._selectedIndex = -1;
    this._frame = null;

    this._canvas = L.DomUtil.create('canvas', styles.canvas);
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

  /** Rebuilds the cell set for the active lens. */
  setCells(cells, mode, threshold) {
    const theme = getMapTheme();
    const shapes = [];

    for (const cell of cells || []) {
      let boundary;
      try {
        boundary = h3.cellToBoundary(cell.h3Index);
      } catch {
        continue;
      }
      const value = mode === 'composite' ? cell.compositeRisk : Number(cell.scores?.[mode]) || 0;
      const band = cellBandFor(cell, mode, threshold);
      shapes.push({ cell, latlngs: boundary, value, band, points: null, color: theme.severity[band] });
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

  setSelected(index) {
    if (this._selectedIndex === index) return;
    this._selectedIndex = index;
    this._schedule();
  },

  /** The cell under a container point, or null. */
  hitTest(point) {
    for (let i = this._shapes.length - 1; i >= 0; i -= 1) {
      const shape = this._shapes[i];
      if (shape.points && pointInPolygon(point, shape.points)) return { shape, index: i };
    }
    return null;
  },

  /** The centre of a cell, for fly-to. */
  centerOf(index) {
    const shape = this._shapes[index];
    if (!shape) return null;
    const count = shape.latlngs.length;
    const lat = shape.latlngs.reduce((acc, point) => acc + point[0], 0) / count;
    const lng = shape.latlngs.reduce((acc, point) => acc + point[1], 0) / count;
    return [lat, lng];
  },

  /** The bounds of every cell, for fit-to-cells. */
  bounds() {
    const points = [];
    for (const shape of this._shapes) points.push(...shape.latlngs);
    if (!points.length) return null;
    return L.latLngBounds(points);
  },

  _resize() {
    if (!this._ctx) return;
    const size = this._map.getSize();
    if (this._width === size.x && this._height === size.y) return;
    this._width = size.x;
    this._height = size.y;

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
    if (!this._ctx) return;
    const theme = getMapTheme();
    const ctx = this._ctx;
    const size = this._map.getSize();

    ctx.clearRect(0, 0, size.x, size.y);

    for (let i = 0; i < this._shapes.length; i += 1) {
      const shape = this._shapes[i];
      const points = shape.latlngs.map((latlng) => this._map.latLngToContainerPoint(latlng));
      shape.points = points;

      const selected = i === this._selectedIndex;
      const hovered = i === this._hoverIndex;

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let j = 1; j < points.length; j += 1) ctx.lineTo(points[j].x, points[j].y);
      ctx.closePath();

      ctx.fillStyle = hexToRgba(shape.color, selected || hovered ? 0.45 : 0.35);
      ctx.fill();

      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeStyle = selected ? theme.accent : shape.color;
      ctx.stroke();
    }
  },
});

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

const hexToRgba = (hex, alpha) => {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
};

export default HexLayer;
