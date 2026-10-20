import { Activity, Hexagon, Route, ShieldCheck } from 'lucide-react';
import MarketingShell from '../components/shell/MarketingShell/MarketingShell';
import Button from '../components/ui/Button/Button';
import Notice from '../components/ui/Notice/Notice';
import useAuthNotice from '../lib/useAuthNotice.js';
import styles from './Landing.module.css';

const CAPABILITIES = [
  {
    icon: Hexagon,
    title: 'Risk per cell',
    body: 'Transit delay and speed, rainfall and visibility, and municipal survey responses are scored for each H3 cell. The operator gets the cells that changed, not a city-wide average.',
  },
  {
    icon: Activity,
    title: 'Live readings',
    body: 'Telemetry streams in as it is recorded. The map, the cell list and the risk bands move together, so the first person to look sees the current state.',
  },
  {
    icon: Route,
    title: 'A guided response',
    body: 'Selecting a cell shows its response directive, the recommended resources and the priority. A lock keeps two operators from acting on the same cell, and the decision is written to the audit trail.',
  },
];

const ROLES = [
  {
    title: 'Municipality',
    body: 'Runs the platform for the city and decides what counts as risky by setting the weights and the thresholds.',
  },
  {
    title: 'Operator',
    body: 'Watches the live cell list and the map, and approves or overrides each alert before a crew is sent.',
  },
  {
    title: 'Field crew',
    body: 'Works from a phone: takes the task, travels to the cell, records what was found and closes it with a note and a photo.',
  },
  {
    title: 'Administrator',
    body: 'Manages weights, thresholds and user access, and reviews the audit trail of every decision that was made.',
  },
];

const SCORING = [
  {
    title: 'The city is indexed into H3 hexagons',
    body: 'Every reading is placed in a cell. A cell is the unit of risk, of dispatch and of everything reported afterwards.',
  },
  {
    title: 'Rc = Wm·Sm + Wc·Sc + Wv·Sv',
    body: 'Composite risk is the weighted sum of the mobility, climate and vulnerability scores. The weights are set per municipality.',
  },
  {
    title: 'Critical at 7, caution at 4',
    body: 'A cell at 7 or above is critical, 4 or above is caution, and below that it is normal. The thresholds are configurable.',
  },
  {
    title: 'A 60-minute window, 30-minute half-life',
    body: 'Readings are scored over a sliding hour and each one decays with a half-life of 30 minutes, so a score reflects how recent the evidence is.',
  },
];

/** A static, honest schematic of the operator console. */
function ConsolePreview() {
  return (
    <figure className={styles.preview}>
      <div className={styles.previewFrame} role="img" aria-label="Schematic of the operator console: a map of risk cells on the left, a ranked list of cells in the middle and the cell detail on the right.">
        <div className={styles.previewBar}>
          <span className={styles.previewDot} />
          <span className={styles.previewBarText}>Operator console</span>
        </div>
        <div className={styles.previewBody}>
          <div className={styles.previewMap}>
            <svg viewBox="0 0 120 90" className={styles.previewSvg} aria-hidden="true">
              <polygon points="30,20 44,28 44,44 30,52 16,44 16,28" className={styles.hexCaution} />
              <polygon points="60,30 74,38 74,54 60,62 46,54 46,38" className={styles.hexCritical} />
              <polygon points="88,20 102,28 102,44 88,52 74,44 74,28" className={styles.hexNormal} />
              <polygon points="44,60 58,68 58,84 44,92 30,84 30,68" className={styles.hexNormal} />
            </svg>
          </div>
          <div className={styles.previewList}>
            <span className={styles.previewRow} data-tone="critical">
              <span className={styles.previewId} />
              <span className={styles.previewScore}>7.4</span>
            </span>
            <span className={styles.previewRow} data-tone="caution">
              <span className={styles.previewId} />
              <span className={styles.previewScore}>4.2</span>
            </span>
            <span className={styles.previewRow} data-tone="normal">
              <span className={styles.previewId} />
              <span className={styles.previewScore}>1.1</span>
            </span>
          </div>
        </div>
      </div>
      <figcaption className={styles.previewCaption}>Preview — the operator console</figcaption>
    </figure>
  );
}

export default function Landing() {
  const notice = useAuthNotice();

  return (
    <MarketingShell
      nav={[
        { href: '#capabilities', label: 'Features' },
        { href: '#roles', label: 'Roles' },
        { href: '#how-it-works', label: 'Platform' },
      ]}
      footerLinks={[
        { href: '/citizen-report', label: 'Report an issue' },
        { href: '/login', label: 'Sign in' },
      ]}
    >
      {notice ? (
        <div className={styles.notice}>
          <Notice tone={notice.tone} title={notice.title}>
            {notice.message}
          </Notice>
        </div>
      ) : null}

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Urban risk operations</p>
          <h1 className={styles.heroTitle}>Know which cells need attention before the call comes in.</h1>
          <p className={styles.heroSubhead}>
            Metabolic City divides the city into H3 hexagons and scores each one from mobility, climate and
            vulnerability data. Operators see what changed and why, then dispatch the crew that can act on it.
          </p>
          <div className={styles.heroActions}>
            <Button variant="primary" href="/signup">
              Create an account
            </Button>
            <Button variant="secondary" href="#how-it-works">
              See how it works
            </Button>
          </div>
        </div>

        <ConsolePreview />
      </section>

      <section className={styles.section} id="capabilities">
        <div className={styles.sectionHeading}>
          <h2 className={styles.sectionTitle}>What the platform does</h2>
          <p className={styles.sectionIntro}>
            Three things happen in order: readings are collected per cell, cells are scored, and a response is
            dispatched against the ones that need it.
          </p>
        </div>
        <div className={styles.capabilityGrid}>
          {CAPABILITIES.map((item) => (
            <article key={item.title} className={styles.capability}>
              <item.icon className={styles.capabilityIcon} size={20} aria-hidden="true" />
              <h3 className={styles.capabilityTitle}>{item.title}</h3>
              <p className={styles.capabilityBody}>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} id="roles">
        <div className={styles.sectionHeading}>
          <h2 className={styles.sectionTitle}>Who uses it</h2>
          <p className={styles.sectionIntro}>Four roles share one record of what the city is doing right now.</p>
        </div>
        <div className={styles.roleGrid}>
          {ROLES.map((role) => (
            <article key={role.title} className={styles.roleCard}>
              <h3 className={styles.roleTitle}>{role.title}</h3>
              <p className={styles.roleBody}>{role.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} id="how-it-works">
        <div className={styles.sectionHeading}>
          <h2 className={styles.sectionTitle}>How the scoring works</h2>
          <p className={styles.sectionIntro}>
            The same numbers run in the console, in the field app and in the analytics, so a risk score means one
            thing everywhere.
          </p>
        </div>
        <div className={styles.scoringGrid}>
          {SCORING.map((item) => (
            <article key={item.title} className={styles.scoringCard}>
              <ShieldCheck className={styles.scoringIcon} size={18} aria-hidden="true" />
              <h3 className={styles.scoringTitle}>{item.title}</h3>
              <p className={styles.scoringBody}>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.closing}>
        <h2 className={styles.closingTitle}>Set up your municipality&rsquo;s risk picture.</h2>
        <p className={styles.closingBody}>
          Create an account with your city code and you can open the console and see the cells that are already
          reporting.
        </p>
        <div className={styles.closingActions}>
          <Button variant="primary" href="/signup">
            Create an account
          </Button>
          <Button variant="secondary" href="#roles">
            See the roles
          </Button>
        </div>
      </section>
    </MarketingShell>
  );
}
