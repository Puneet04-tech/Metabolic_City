import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip/Tooltip';
import { cn } from '../cn';
import styles from './CopyableId.module.css';

/**
 * A short, copyable identifier.
 * The full value lives in the tooltip; the button copies it to the clipboard.
 */
export default function CopyableId({ id, head = 4, tail = 3, label, className, onCopied, ...rest }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!id) return null;

  const short = id.length <= head + tail + 1 ? id : `${id.slice(0, head)}…${id.slice(-tail)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      onCopied?.(id);
    } catch {
      setCopied(false);
    }
  };

  return (
    <span className={cn(styles.wrapper, className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className={styles.button} onClick={handleCopy} aria-label={`Copy ${label ?? 'identifier'} ${id}`} {...rest}>
            <span className={styles.value}>{short}</span>
            {copied ? <Check size={12} aria-hidden="true" className={styles.icon} /> : <Copy size={12} aria-hidden="true" className={styles.icon} />}
          </button>
        </TooltipTrigger>
        <TooltipContent>{id}</TooltipContent>
      </Tooltip>
      <span className={styles.live} aria-live="polite">
        {copied ? 'Copied' : ''}
      </span>
    </span>
  );
}
