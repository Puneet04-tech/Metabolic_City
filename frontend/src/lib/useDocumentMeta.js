import { useEffect } from 'react';
import { absoluteUrl } from './site.js';

const setMeta = (selector, attribute, value) => {
  if (!value) return;
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, selector.includes('property') ? 'property' : 'name');
    document.head.appendChild(element);
  }
  element.setAttribute('content', value);
};

const setCanonical = (url) => {
  if (!url) return;
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
};

/**
 * Sets the document title, the Open Graph tags and the canonical URL for a
 * route, and keeps authenticated pages out of search results. Public pages
 * remove the robots directive again.
 */
export function useDocumentMeta(title, { noindex = false, description, canonical, image } = {}) {
  useEffect(() => {
    if (title) document.title = title;

    const existing = document.querySelector('meta[name="robots"]');

    if (noindex) {
      const meta = existing ?? document.createElement('meta');
      if (!existing) {
        meta.setAttribute('name', 'robots');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', 'noindex, nofollow');
    } else if (existing) {
      existing.remove();
    }

    if (!noindex) {
      setMeta('meta[property="og:title"]', 'property', title);
      setMeta('meta[property="og:description"]', 'property', description);
      setMeta('meta[property="og:url"]', 'property', canonical ? absoluteUrl(canonical) : undefined);
      setMeta('meta[property="og:image"]', 'property', image ? absoluteUrl(image) : undefined);
      setMeta('meta[name="twitter:title"]', 'name', title);
      setMeta('meta[name="twitter:description"]', 'name', description);
      setCanonical(canonical ? absoluteUrl(canonical) : undefined);
    } else {
      // A noindex page must not also carry a canonical link: pointing it at
      // another page would ask the search engine to drop that page instead.
      document.head.querySelector('link[rel="canonical"]')?.remove();
    }
  }, [title, noindex, description, canonical, image]);
}

export default useDocumentMeta;
