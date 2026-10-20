import { useEffect } from 'react';

/**
 * Sets the document title and keeps authenticated pages out of search
 * results. Public pages remove the robots directive again.
 */
export function useDocumentMeta(title, { noindex = false } = {}) {
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
  }, [title, noindex]);
}

export default useDocumentMeta;
