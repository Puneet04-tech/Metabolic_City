import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import MapCanvas from './MapCanvas';
import layerStyles from './HexLayer.module.css';

const cell = (id, risk) => ({
  h3Index: id,
  compositeRisk: risk,
  scores: { mobility: 1, climate: 1, vulnerability: 1 },
  lastUpdated: new Date().toISOString(),
});

describe('MapCanvas', () => {
  it('places the cell canvas over the map panes', async () => {
    const { container } = render(
      <MemoryRouter>
        <MapCanvas cells={[cell('883d914f17bffff', 6)]} />
      </MemoryRouter>
    );

    await waitFor(() => {
      const canvas = container.querySelector('canvas');
      expect(canvas).toBeTruthy();
      // The canvas is created imperatively by Leaflet, so it needs the
      // positioning class from the module to be visible over the tiles.
      expect(canvas.className).toContain(layerStyles.canvas);
    });
  });

  it('renders the legend and the fit control', () => {
    const { container, getByLabelText } = render(
      <MemoryRouter>
        <MapCanvas cells={[]} />
      </MemoryRouter>
    );

    expect(container.querySelector('.leaflet-container')).toBeTruthy();
    expect(getByLabelText('Fit the map to the cells on screen')).toBeTruthy();
  });

  it('names the lens the legend is showing', () => {
    const { getByText } = render(
      <MemoryRouter>
        <MapCanvas cells={[]} mode="vulnerability" threshold={7} />
      </MemoryRouter>
    );

    expect(getByText('Sv — Vulnerability')).toBeTruthy();
    expect(getByText('Critical ≥ 7')).toBeTruthy();
    expect(getByText('Caution 5–7')).toBeTruthy();
  });

  it('shows the relative ramp when the relative view is on', () => {
    const { getByText } = render(
      <MemoryRouter>
        <MapCanvas cells={[]} mode="composite" threshold={7} relative />
      </MemoryRouter>
    );

    expect(getByText('Relative — position within the band')).toBeTruthy();
  });
});
