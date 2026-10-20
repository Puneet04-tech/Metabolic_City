import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Badge from './Badge/Badge';
import Button from './Button/Button';
import CopyableId from './CopyableId/CopyableId';
import EmptyState from './EmptyState/EmptyState';
import ErrorState from './ErrorState/ErrorState';
import Input from './Input/Input';
import Notice from './Notice/Notice';
import SeverityBadge from './SeverityBadge/SeverityBadge';
import StatBlock from './StatBlock/StatBlock';
import DataTable from './DataTable/DataTable';
import { TooltipProvider } from './Tooltip/Tooltip';
import NotFound from '../../pages/NotFound.jsx';
import Unauthorized from '../../pages/Unauthorized.jsx';

const render = (element) => renderToStaticMarkup(element);

describe('Button', () => {
  it('renders one button style per variant and size', () => {
    const html = render(
      <>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button size="sm">Small</Button>
      </>
    );

    expect(html).toContain('data-variant="primary"');
    expect(html).toContain('data-variant="secondary"');
    expect(html).toContain('data-variant="ghost"');
    expect(html).toContain('data-variant="destructive"');
    expect(html).toContain('data-size="sm"');
  });

  it('renders an anchor when a href is given', () => {
    const html = render(<Button href="/operator">Open</Button>);
    expect(html).toContain('<a');
    expect(html).toContain('href="/operator"');
  });

  it('disables the button while loading', () => {
    const html = render(<Button loading>Saving</Button>);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled');
  });
});

describe('SeverityBadge', () => {
  it('always pairs the colour with a word', () => {
    for (const severity of ['critical', 'caution', 'normal', 'info']) {
      const html = render(<SeverityBadge severity={severity} />);
      expect(html).toContain('data-severity');
      expect(html).toMatch(/Critical|Caution|Normal|Info/);
      expect(html).toContain('<svg');
    }
  });
});

describe('Notice', () => {
  it('uses role=alert for errors and role=status otherwise', () => {
    expect(render(<Notice tone="error">Failed</Notice>)).toContain('role="alert"');
    expect(render(<Notice tone="info">Heads up</Notice>)).toContain('role="status"');
  });
});

describe('Input', () => {
  it('marks invalid inputs for assistive technology', () => {
    const html = render(<Input invalid aria-label="Threshold" />);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('data-invalid="true"');
  });
});

describe('StatBlock', () => {
  it('shows the unit and the comparison period', () => {
    const html = render(<StatBlock label="Active cells" value={74} unit="cells" period="Last 24 hours" />);
    expect(html).toContain('Active cells');
    expect(html).toContain('cells');
    expect(html).toContain('Last 24 hours');
  });
});

describe('CopyableId', () => {
  it('shows a shortened id and keeps the full id as the accessible name', () => {
    const html = render(
      <TooltipProvider>
        <CopyableId id="883d914f17bffff" label="cell" />
      </TooltipProvider>
    );
    expect(html).toContain('883d');
    expect(html).toContain('883d914f17bffff');
  });
});

describe('DataTable', () => {
  const columns = [
    { key: 'zone', header: 'Cell' },
    { key: 'risk', header: 'Rc', align: 'right' },
  ];
  const rows = [
    { id: 'a', zone: 'Cell 883d…f57', risk: 7.4 },
    { id: 'b', zone: 'Cell 883d…5f1', risk: 0.6 },
  ];

  it('renders a caption, headers and rows', () => {
    const html = render(<DataTable columns={columns} rows={rows} caption="Cells" />);
    expect(html).toContain('Cells');
    expect(html).toContain('Cell 883d…f57');
    expect(html).toContain('<th');
  });

  it('shows the empty state when there are no rows', () => {
    const html = render(<DataTable columns={columns} rows={[]} empty={<p>Nothing</p>} />);
    expect(html).toContain('Nothing');
  });
});

describe('feedback patterns', () => {
  it('renders the shared empty and error states', () => {
    expect(render(<EmptyState title="No cells yet" description="Nothing has reported." />)).toContain('No cells yet');
    const error = render(<ErrorState errorId="ERR-1A2B3C" onRetry={() => {}} />);
    expect(error).toContain('ERR-1A2B3C');
    expect(error).toContain('role="alert"');
  });
});

describe('system pages', () => {
  it('renders 404 with a title and a home action', () => {
    const html = render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    expect(html).toContain('Page not found');
    expect(html).toContain('Go home');
  });

  it('renders 403 with a title and a home action', () => {
    const html = render(
      <MemoryRouter>
        <Unauthorized />
      </MemoryRouter>
    );
    expect(html).toContain('Access denied');
    expect(html).toContain('Go home');
  });
});

describe('Badge', () => {
  it('renders a neutral badge by default', () => {
    const html = render(<Badge>Operator</Badge>);
    expect(html).toContain('Operator');
    expect(html).toContain('data-tone="neutral"');
  });
});
