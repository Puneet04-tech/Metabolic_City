/**
 * Site identity.
 *
 * The canonical origin is the deployed origin. The fallback is only used when
 * there is no document (tests, SSR), and mirrors the value in `index.html`.
 */

const FALLBACK_ORIGIN = 'https://metabolic-city.example';

export const siteOrigin = () => {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return FALLBACK_ORIGIN;
};

/** An absolute URL for a site-relative path. */
export const absoluteUrl = (path) => {
  if (!path) return siteOrigin();
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteOrigin()}${path.startsWith('/') ? path : `/${path}`}`;
};
