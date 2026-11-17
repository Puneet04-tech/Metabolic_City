import { Activity, ArrowUpRight, Hexagon, Route, ShieldCheck } from 'lucide-react';
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
    title: 'Operator',
    body: 'Watches the live cell list and the map, and approves or overrides each alert before a crew is sent.',
    note: 'Risk · alerts · dispatch',
  },
  {
    title: 'Field crew',
    body: 'Works from a phone: takes the task, travels to the cell, records what was found and closes it with a note and a photo.',
    note: 'Accept · arrive · resolve',
  },
  {
    title: 'Administrator',
    body: 'Manages weights, thresholds and user access, and reviews the audit trail of every decision that was made.',
    note: 'Weights · access · audit',
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
    title: 'Critical at 7, caution at 5',
    body: 'A cell at or above the critical threshold is critical, 5 or above is caution, and below that it is normal. The threshold is set per municipality.',
  },
  {
    title: 'A 60-minute window, 30-minute half-life',
    body: 'Readings are scored over a sliding hour and each one decays with a half-life of 30 minutes, so a score reflects how recent the evidence is.',
  },
];

const PROCESS = [
  ['01', 'Read', 'Weather, road speed, terrain and field reports'],
  ['02', 'Score', 'One evidence record and one risk score per cell'],
  ['03', 'Act', 'A human decision, a crew and an audit trail'],
];

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
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowRule} aria-hidden="true" />
            Urban risk operations / field instrument
          </p>
          <h1 className={styles.heroTitle}>Know which cells need attention before the call comes in.</h1>
          <p className={styles.heroSubhead}>
            Metabolic City divides the city into H3 hexagons and scores each one from mobility, climate and
            vulnerability data. Operators see what changed and why, then dispatch the crew that can act on it.
          </p>
          <div className={styles.heroActions}>
            <Button variant="primary" href="/signup">
              Create an account
              <ArrowUpRight size={15} aria-hidden="true" />
            </Button>
            <Button variant="secondary" href="#how-it-works">
              See how it works
            </Button>
          </div>
          <dl className={styles.heroFacts}>
            <div>
              <dt>Unit</dt>
              <dd>H3 hexagon</dd>
            </div>
            <div>
              <dt>Score</dt>
              <dd>Deterministic</dd>
            </div>
            <div>
              <dt>Decision</dt>
              <dd>Human</dd>
            </div>
          </dl>
        </div>

        <figure className={styles.heroPlate}>
          <div className={styles.plateFrame}>
            <img
              src="/images/atlas-hero.svg"
              alt="An operational map plate showing H3 risk cells, contour lines and a response route across a city."
            />
            <span className={styles.plateCornerTop} aria-hidden="true">MC / ATLAS 08</span>
            <span className={styles.plateCornerBottom} aria-hidden="true">EVIDENCE FIRST</span>
          </div>
          <figcaption className={styles.plateCaption}>
            <span>Risk cells, not a city-wide average.</span>
            <span>Bhopal · Indore · Sehore</span>
          </figcaption>
        </figure>
      </section>

      <section className={styles.process} aria-label="How the platform works">
        {PROCESS.map(([index, title, body]) => (
          <div key={index} className={styles.processStep}>
            <span className={styles.processIndex}>{index}</span>
            <span className={styles.processTitle}>{title}</span>
            <span className={styles.processBody}>{body}</span>
          </div>
        ))}
      </section>

      <section className={styles.section} id="capabilities">
        <div className={styles.sectionHeading}>
          <p className={styles.sectionKicker}>01 / Capabilities</p>
          <h2 className={styles.sectionTitle}>A working loop, not a wall of charts.</h2>
          <p className={styles.sectionIntro}>
            Three things happen in order: readings are collected per cell, cells are scored, and a response is
            dispatched against the ones that need it.
          </p>
        </div>
        <div className={styles.featureList}>
          {CAPABILITIES.map((item, index) => (
            <article key={item.title} className={styles.feature}>
              <span className={styles.featureIndex}>{String(index + 1).padStart(2, '0')}</span>
              <span className={styles.featureIcon}>
                <item.icon size={20} strokeWidth={1.6} aria-hidden="true" />
              </span>
              <div className={styles.featureText}>
                <h3 className={styles.featureTitle}>{item.title}</h3>
                <p className={styles.featureBody}>{item.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} id="roles">
        <div className={styles.sectionHeading}>
          <p className={styles.sectionKicker}>02 / Roles</p>
          <h2 className={styles.sectionTitle}>Who uses it</h2>
          <p className={styles.sectionIntro}>Three roles share one record of what the city is doing right now.</p>
        </div>
        <div className={styles.roleGrid}>
          {ROLES.map((role, index) => (
            <article key={role.title} className={styles.roleCard}>
              <div className={styles.roleTop}>
                <span className={styles.roleIndex}>0{index + 1}</span>
                <span className={styles.roleNote}>{role.note}</span>
              </div>
              <h3 className={styles.roleTitle}>{role.title}</h3>
              <p className={styles.roleBody}>{role.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} id="how-it-works">
        <div className={styles.sectionHeading}>
          <p className={styles.sectionKicker}>03 / Platform</p>
          <h2 className={styles.sectionTitle}>How the scoring works</h2>
          <p className={styles.sectionIntro}>
            The same numbers run in the console, in the field app and in the analytics, so a risk score means one
            thing everywhere.
          </p>
        </div>

        <div className={styles.platformGrid}>
          <aside className={styles.formulaPanel}>
            <span className={styles.formulaLabel}>Composite risk</span>
            <p className={styles.formula}>Rc = Wm·Sm + Wc·Sc + Wv·Sv</p>
            <dl className={styles.formulaFacts}>
              <div>
                <dt>Wm / Wc / Wv</dt>
                <dd>Municipal weights</dd>
              </div>
              <div>
                <dt>Sm / Sc / Sv</dt>
                <dd>Mobility · climate · vulnerability</dd>
              </div>
              <div>
                <dt>Window</dt>
                <dd>60 minutes · 30-minute half-life</dd>
              </div>
            </dl>
            <p className={styles.formulaNote}>
              A score without its evidence is not an operational answer. Every cell keeps the sources, age and
              confidence behind the number.
            </p>
          </aside>

          <div className={styles.scoringList}>
            {SCORING.map((item) => (
              <article key={item.title} className={styles.scoringRow}>
                <ShieldCheck className={styles.scoringIcon} size={18} strokeWidth={1.6} aria-hidden="true" />
                <div>
                  <h3 className={styles.scoringTitle}>{item.title}</h3>
                  <p className={styles.scoringBody}>{item.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.closing}>
        <div>
          <p className={styles.closingKicker}>Ready when the city is</p>
          <h2 className={styles.closingTitle}>Set up your municipality&rsquo;s risk picture.</h2>
        </div>
        <div className={styles.closingSide}>
          <p className={styles.closingBody}>
            Create an account with your city code and you can open the console and see the cells that are already
            reporting.
          </p>
          <div className={styles.closingActions}>
            <Button variant="primary" href="/signup">
              Create an account
              <ArrowUpRight size={15} aria-hidden="true" />
            </Button>
            <Button variant="secondary" href="#roles">
              See the roles
            </Button>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
