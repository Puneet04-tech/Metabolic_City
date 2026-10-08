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
  
  useEffect(() => {
    if (!node) return undefined;
    // Center map on Bhopal-Indore-Sehore region (Madhya Pradesh)
    const map = L.map(node, {
      keyboard: true, // Enable keyboard navigation
    }).setView([23.06, 76.78], 9);
    
    // Use OpenStreetMap standard tiles (no API key required)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    const layers = cells.map((cell, index) => {
      const value = cellScore(cell, mode);
      const band = cellBand(value, threshold);
      const color = band === 'critical' ? '#c8392b' : band === 'warning' ? '#c58a00' : '#287c61';

      // H3-js returns [lon, lat] order, Leaflet expects [lat, lon]
      // Need to reverse the coordinate order
      const boundary = h3.cellToBoundary(cell.h3Index, true).map(coord => [coord[1], coord[0]]);
      const polygon = L.polygon(boundary, { 
        color, 
        fillColor: color, 
        fillOpacity: 0.42, 
        weight: 2,
        className: 'h3-cell-polygon',
        'aria-label': `H3 cell ${cell.h3Index}, risk score ${value.toFixed(2)}, risk level ${band}`,
        tabIndex: 0, // Make focusable
      }).addTo(map);
      
      polygon.bindTooltip(`${cell.h3Index} - ${lensLabels[mode]}: ${value.toFixed(2)}`);
      
      // Keyboard navigation support
      polygon.on('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(cell);
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          const nextIndex = (index + 1) % cells.length;
          onSelect(cells[nextIndex]);
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const prevIndex = (index - 1 + cells.length) % cells.length;
          onSelect(cells[prevIndex]);
        }
      });
      
      polygon.on('click', () => onSelect(cell));
      return polygon;
    });
    
    // Always center on Madhya Pradesh (Bhopal-Indore-Sehore region)
    // Don't auto-fit to cells to prevent showing wrong location
    return () => { layers.forEach((layer) => layer.remove()); map.remove(); };
  }, [node, cells, mode, threshold, onSelect]);
  
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
  
  return (
    <div 
      className="map-canvas" 
      ref={setNode}
      role="application"
      aria-label="Interactive H3 risk cell map"
      aria-description="Map showing H3 spatial cells with risk scores. Use arrow keys to navigate between cells, Enter or Space to select a cell, Escape to deselect."
      tabIndex={0}
    />
  );
}

export default H3Map;
