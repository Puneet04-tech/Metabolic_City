import { forwardRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../cn';
import styles from './SearchInput.module.css';

/** A search field with a clear control. */
const SearchInput = forwardRef(function SearchInput({ value, onChange, placeholder = 'Search', className, ...rest }, ref) {
  const [focused, setFocused] = useState(false);

  return (
    <span className={cn(styles.wrap, className)} data-focused={focused ? 'true' : undefined}>
      <Search className={styles.icon} size={14} aria-hidden="true" />
      <input
        ref={ref}
        type="search"
        className={styles.input}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        {...rest}
      />
      {value ? (
        <button type="button" className={styles.clear} onClick={() => onChange('')} aria-label="Clear search">
          <X size={13} aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
});

export default SearchInput;
