import SegmentedControl from '../ui/SegmentedControl/SegmentedControl';

const LENSES = [
  { value: 'composite', label: 'Composite', hint: 'Rc' },
  { value: 'mobility', label: 'Mobility', hint: 'Sm' },
  { value: 'climate', label: 'Climate', hint: 'Sc' },
  { value: 'vulnerability', label: 'Vulnerability', hint: 'Sv' },
];

/** The lens switcher. Each option shows the score code it drives. */
export default function LensFilter({ mode, onChange }) {
  return <SegmentedControl options={LENSES} value={mode} onChange={onChange} ariaLabel="Risk lens" />;
}
