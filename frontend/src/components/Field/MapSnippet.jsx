import { cn } from '../ui/cn';
import styles from './MapSnippet.module.css';

const TILE_SIZE = 256;
const ZOOM = 13;

/** The slippy-map tile that contains a coordinate, plus the pixel offset. */
const tileFor = (latitude, longitude, zoom) => {
  const scale = 2 ** zoom;
  const worldX = ((longitude + 180) / 360) * TILE_SIZE * scale;
  const sin = Math.sin((latitude * Math.PI) / 180);
  const worldY = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * TILE_SIZE * scale;
  const x = Math.floor(worldX / TILE_SIZE);
  const y = Math.floor(worldY / TILE_SIZE);
  return {
    url: `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
    offsetX: worldX - x * TILE_SIZE,
    offsetY: worldY - y * TILE_SIZE,
  };
};

/**
 * A static map snippet for a cell. It uses one map tile rather than a live
 * map, so it stays light on a phone.
 */
export default function MapSnippet({ latitude, longitude, label, className }) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return (
      <div className={cn(styles.placeholder, className)}>
        <p className={styles.placeholderText}>No coordinates for this cell.</p>
      </div>
    );
  }

  const tile = tileFor(latitude, longitude, ZOOM);

  return (
    <div className={cn(styles.snippet, className)}>
      <img
        className={styles.tile}
        src={tile.url}
        width={TILE_SIZE}
        height={TILE_SIZE}
        alt={label ? `Map around ${label}` : 'Map around the task location'}
        loading="lazy"
      />
      <span className={styles.marker} style={{ left: `${tile.offsetX}px`, top: `${tile.offsetY}px` }} aria-hidden="true" />
    </div>
  );
}
