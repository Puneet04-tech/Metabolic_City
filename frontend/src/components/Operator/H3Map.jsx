import { useEffect, useRef, useState } from 'react';
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

function H3Map({ cells, mode, threshold, onSelect }) {
  const [node, setNode] = useState(null);
  const [selectedCellIndex, setSelectedCellIndex] = useState(0);
  const mapRef = useRef(null);
  const layerGroupRef = useRef(null);
  const [initError, setInitError] = useState(null);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!node || mapRef.current) return;

    let map;
    try {
      map = L.map(node, {
        keyboard: true,
        zoomControl: true,
        doubleClickZoom: false,
        attributionControl: true,
        zoomSnap: 0.5,
        zoomDelta: 0.5,
        doubleClickZoom: true,
      }).setView([23.06, 76.78], 9);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

      layerGroupRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;

      L.control.scale({ position: 'bottomright', metric: true, imperial: false }).addTo(map);
    } catch (err) {
      console.error('Map init error:', err);
      setInitError(err.message);
      return;
    }

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
      window.removeEventListener('resize', invalidate);
      try { map.remove(); } catch {}
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, [node]);

  // Update polygon layers when cells/mode/threshold change
  useEffect(() => {
    console.log('H3Map cells update:', cells?.length);
    if (!mapRef.current || !layerGroupRef.current) return;

    if (!cells || cells.length === 0) {
      // If we have existing layers, don't clear them immediately on empty updates
      if (layerGroupRef.current.getLayers().length === 0) return;
      return; 
    }

    layerGroupRef.current.clearLayers();
    console.log('Rendering', cells.length, 'polygons');

    const layers = [];
    cells.forEach((cell, index) => {
      const value = cellScore(cell, mode);
      const band = cellBand(value, threshold);
      const color = band === 'critical' ? '#c8392b' : band === 'warning' ? '#c58a00' : '#287c61';

      let boundary;
      try {
        boundary = h3.cellToBoundary(cell.h3Index, true).map((coord) => [coord[1], coord[0]]);
      } catch (err) {
        console.error('Boundary error for', cell.h3Index, err);
        return;
      }

      const polygon = L.polygon(boundary, {
        color: color,
        fillColor: color,
        fillOpacity: band === 'critical' ? 0.65 : 0.55,
        weight: band === 'critical' ? 4 : 3,
        opacity: 1,
      }).addTo(layerGroupRef.current);

      polygon.bindTooltip(`${cell.h3Index} - ${lensLabels[mode]}: ${value.toFixed(2)}`, {
        direction: 'center',
        permanent: false,
        className: 'h3-tooltip',
      });

      polygon.on('click', () => {
        setSelectedCellIndex(index);
        onSelect(cell);
      });
      polygon.on('mouseover', (e) => {
        e.target.setStyle({ weight: 6, fillOpacity: 0.85 });
      });
      polygon.on('mouseout', (e) => {
        e.target.setStyle({ weight: band === 'critical' ? 4 : 3, fillOpacity: band === 'critical' ? 0.65 : 0.55 });
      });

      layers.push(polygon);
    });

    // Fit bounds if we have cells
    if (layers.length > 0) {
      const group = L.featureGroup(layers);
      const bounds = group.getBounds();
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds.pad(0.15), { maxZoom: 12 });
      }
    }
  }, [cells, mode, threshold, onSelect]);

  // Keyboard shortcut for map navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onSelect(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelect]);

  if (initError) {
    return (
      <div className="map-error">
        <p>Map failed to initialize: {initError}</p>
      </div>
    );
  }

  return (
    <div
      className="map-canvas"
      ref={setNode}
      role="application"
      aria-label="Interactive H3 risk cell map"
      aria-description="Map showing H3 spatial cells with risk scores. Use arrow keys to navigate between cells, Enter or Space to select a cell, Escape to deselect."
      tabIndex={0}
    >
      {(!cells || cells.length === 0) && (
        <div className="map-empty-overlay">
          <h4>No active cells</h4>
          <p>Telemetry data is being loaded. Check the SSE connection.</p>
        </div>
      )}
    </div>
  );
}

export default H3Map;