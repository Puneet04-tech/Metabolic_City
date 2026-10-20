import { useState } from 'react';
import {
  Badge,
  Button,
  CopyableId,
  DataTable,
  Dialog,
  DialogContent,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Notice,
  SeverityBadge,
  Skeleton,
  StatBlock,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useToast,
} from '../ui/index.js';
import { Inbox, SearchX } from 'lucide-react';
import styles from './Gallery.module.css';

const SAMPLE_ROWS = [
  { id: 'a', zone: 'Cell 883d…f57', risk: 7.4, trend: 'Rising', status: 'critical' },
  { id: 'b', zone: 'Cell 883d…5f1', risk: 4.1, trend: 'Stable', status: 'caution' },
  { id: 'c', zone: 'Cell 883d…2b0', risk: 0.6, trend: 'Falling', status: 'normal' },
];

function Section({ title, description, children }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {description ? <p className={styles.sectionDescription}>{description}</p> : null}
      <div className={styles.row}>{children}</div>
    </section>
  );
}

export default function Gallery() {
  const { push } = useToast();
  const [sort, setSort] = useState({ key: 'risk', direction: 'desc' });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Component gallery</h1>
        <p className={styles.subtitle}>Development only. Every shared component with its variants.</p>
      </header>

      <Section title="Button" description="variants: primary, secondary, ghost, destructive · sizes: sm, md">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="primary" size="sm">
          Small primary
        </Button>
        <Button variant="secondary" size="sm">
          Small secondary
        </Button>
        <Button variant="primary" loading>
          Loading
        </Button>
        <Button variant="primary" disabled>
          Disabled
        </Button>
        <Button variant="secondary" href="/operator">
          As link
        </Button>
      </Section>

      <Section title="FormField + Input" description="label, hint, error and required states">
        <div className={styles.formSample}>
          <FormField label="City code" hint="For example CITY-IND-BPL8" required>
            {(props) => <Input {...props} placeholder="CITY-IND-BPL8" />}
          </FormField>
          <FormField label="Threshold" error="Caution must be lower than critical">
            {(props) => <Input {...props} defaultValue="4" />}
          </FormField>
          <FormField label="Disabled">
            {(props) => <Input {...props} disabled value="read only" onChange={() => {}} />}
          </FormField>
        </div>
      </Section>

      <Section title="Badge / SeverityBadge" description="severity is never colour-only">
        <Badge>Neutral</Badge>
        <Badge tone="accent">Accent</Badge>
        <SeverityBadge severity="critical" />
        <SeverityBadge severity="caution" />
        <SeverityBadge severity="normal" />
        <SeverityBadge severity="info" />
      </Section>

      <Section title="Notice" description="info, success, warning, error — dismissible">
        <Notice tone="info" title="Info">
          A neutral message.
        </Notice>
        <Notice tone="success" title="Saved">
          Changes were saved.
        </Notice>
        <Notice tone="warning" title="Stale data">
          This view was last updated 4 minutes ago.
        </Notice>
        <Notice tone="error" title="Failed" dismissible onDismiss={() => push('Dismissed')}>
          The request could not be completed.
        </Notice>
      </Section>

      <Section title="StatBlock" description="label, value, unit, delta and period">
        <StatBlock label="Active cells" value={74} unit="cells" period="Last 24 hours" />
        <StatBlock label="Critical cells" value={0} delta={-2} deltaLabel="vs yesterday" period="Last 24 hours" />
        <StatBlock label="Mean risk" value={0.65} unit="Rc" period="Last 24 hours" />
      </Section>

      <Section title="DataTable" description="sticky header, sortable column, row selection, pagination">
        <DataTable
          caption="Sample cell rows"
          columns={[
            { key: 'zone', header: 'Cell', sortable: true },
            { key: 'risk', header: 'Rc', sortable: true, align: 'right' },
            { key: 'trend', header: 'Trend' },
            {
              key: 'status',
              header: 'Severity',
              render: (row) => <SeverityBadge severity={row.status} />,
            },
          ]}
          rows={SAMPLE_ROWS}
          sort={sort}
          onSortChange={setSort}
          getRowId={(row) => row.id}
          pageSize={2}
        />
      </Section>

      <Section title="Empty / error / skeleton" description="the shared feedback patterns">
        <EmptyState icon={Inbox} title="No cells yet" description="Telemetry will appear here once the first cell reports." />
        <ErrorState title="Could not load cells" description="The API did not respond." errorId="ERR-1A2B3C" onRetry={() => push('Retried')} />
        <div className={styles.skeletonSample}>
          <Skeleton height={16} width="100%" />
          <Skeleton height={16} width="80%" />
          <Skeleton height={16} width="60%" />
        </div>
      </Section>

      <Section title="Overlays" description="Radix dialog, dropdown and tooltip">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Open dialog</Button>
          </DialogTrigger>
          <DialogContent
            title="Confirm dispatch"
            description="This creates a field task for the selected cell."
            footer={
              <>
                <Button variant="ghost">Cancel</Button>
                <Button variant="primary">Confirm</Button>
              </>
            }
          >
            <p>Dialog body content.</p>
          </DialogContent>
        </Dialog>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary">Open menu</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Approve</DropdownMenuItem>
            <DropdownMenuItem>Override</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="secondary">Hover for tooltip</Button>
          </TooltipTrigger>
          <TooltipContent>Tooltip content</TooltipContent>
        </Tooltip>

        <CopyableId id="883d914f17bffff" label="cell" />
      </Section>

      <Section title="Tabs" description="underline tabs">
        <Tabs defaultValue="weights">
          <TabsList>
            <TabsTrigger value="weights">Weights</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList>
          <TabsContent value="weights">Weights panel</TabsContent>
          <TabsContent value="users">Users panel</TabsContent>
          <TabsContent value="audit">Audit panel</TabsContent>
        </Tabs>
      </Section>

      <Section title="SystemPage" description="the shared system-page pattern">
        <ErrorState title="System page" description="SystemPage renders an icon, a title, one sentence and an action." />
      </Section>
    </div>
  );
}
