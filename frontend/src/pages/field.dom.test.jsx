import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/Toast/Toast';

const tasks = [
  {
    _id: 'incident-1',
    h3Index: '883d914f17bffff',
    status: 'ACKNOWLEDGED',
    priority: 'CRITICAL',
    incidentType: 'FLOODING',
    riskScore: 7.8,
    dispatchText: 'Water is backing up on the main road.',
    detectedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    action: {
      actionNarrative: 'Attend the junction and clear the drain.',
      priority: 'CRITICAL',
      recommendedResources: ['Crew 2', 'Jet vac'],
      dispatchText: 'Water is backing up on the main road.',
    },
  },
  {
    _id: 'incident-2',
    h3Index: '883d914f05ffff',
    status: 'APPROVED',
    priority: 'LOW',
    incidentType: 'POTHOLE',
    riskScore: 1.2,
    dispatchText: 'Pothole reported by a resident.',
    detectedAt: new Date().toISOString(),
  },
];

const apiRequest = vi.fn();

vi.mock('../api.js', () => ({
  apiRequest: (...args) => apiRequest(...args),
  clearSession: vi.fn(),
  getStoredUser: () => ({ name: 'Asha Rao', role: 'field_crew', cityCode: 'CITY-IND-BPL8' }),
  getNavItems: () => [],
}));

vi.mock('../lib/fieldOutbox.js', () => ({
  enqueueFieldUpdate: vi.fn(),
  flushFieldOutbox: vi.fn(),
  getPendingFieldUpdates: vi.fn(async () => 0),
}));

const { default: FieldTasks } = await import('./FieldTasks.jsx');
const { default: FieldTaskDetail } = await import('./FieldTaskDetail.jsx');
const { default: StatusStepper } = await import('../components/field/StatusStepper');
const { default: TaskCard } = await import('../components/field/TaskCard');
const { default: CitizenReport } = await import('./CitizenReport.jsx');
const { actionLabelFor, nextStatusFor, prioritySeverity, TASK_STEPS } = await import('../lib/taskStatus');

const renderAt = (ui, path = '/') =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </ToastProvider>
  );

describe('task status mapping', () => {
  it('maps the server statuses to the crew labels', () => {
    expect(actionLabelFor('APPROVED')).toBe('Accept task');
    expect(actionLabelFor('DISPATCHED')).toBe('Accept task');
    expect(actionLabelFor('ACKNOWLEDGED')).toBe("I'm on site");
    expect(actionLabelFor('ARRIVED')).toBe('Resolve task');
    expect(actionLabelFor('RESOLVED')).toBeNull();
  });

  it('sends the server status values, never the labels', () => {
    expect(nextStatusFor('APPROVED')).toBe('ACKNOWLEDGED');
    expect(nextStatusFor('DISPATCHED')).toBe('ACKNOWLEDGED');
    expect(nextStatusFor('ACKNOWLEDGED')).toBe('ARRIVED');
    expect(nextStatusFor('ARRIVED')).toBe('RESOLVED');
    expect(nextStatusFor('RESOLVED')).toBeNull();
  });

  it('maps the incident priority onto the severity scale', () => {
    expect(prioritySeverity('CRITICAL')).toBe('critical');
    expect(prioritySeverity('HIGH')).toBe('caution');
    expect(prioritySeverity('MODERATE')).toBe('normal');
    expect(prioritySeverity(undefined)).toBe('normal');
  });

  it('has four steps', () => {
    expect(TASK_STEPS.map((step) => step.label)).toEqual(['Assigned', 'Accepted', 'On site', 'Resolved']);
  });
});

describe('StatusStepper', () => {
  it('marks the current step', () => {
    const { container } = render(<StatusStepper status="ARRIVED" />);
    const active = container.querySelector('[data-state="active"]');
    expect(active.textContent).toContain('On site');
    expect(container.querySelectorAll('[data-state="done"]')).toHaveLength(2);
  });
});

describe('TaskCard', () => {
  it('shows the severity, the cell, the instruction and the age', () => {
    render(<TaskCard task={tasks[0]} onOpen={() => {}} />);
    expect(screen.getByText('Critical')).toBeTruthy();
    expect(screen.getByText('Cell 883d914f17bffff')).toBeTruthy();
    expect(screen.getByText('Water is backing up on the main road.')).toBeTruthy();
    expect(screen.getByText(/Reported/)).toBeTruthy();
  });
});

describe('FieldTasks', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockResolvedValue({ count: tasks.length, incidents: tasks });
  });

  it('lists the tasks', async () => {
    renderAt(<FieldTasks />, '/field');

    await waitFor(() => expect(screen.getByText('Cell 883d914f17bffff')).toBeTruthy());
    expect(screen.getByText('Cell 883d914f05ffff')).toBeTruthy();
    expect(apiRequest).toHaveBeenCalledWith('/v1/field/tasks');
  });

  it('shows an empty state when there are no tasks', async () => {
    apiRequest.mockResolvedValue({ count: 0, incidents: [] });
    renderAt(<FieldTasks />, '/field');
    await waitFor(() => expect(screen.getByText('No open tasks')).toBeTruthy());
  });

  it('shows an error state with a retry', async () => {
    apiRequest.mockRejectedValue(Object.assign(new Error('The service is unavailable.'), { status: 503 }));
    renderAt(<FieldTasks />, '/field');
    await waitFor(() => expect(screen.getByText('Tasks could not be loaded')).toBeTruthy());
  });
});

describe('FieldTaskDetail', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockResolvedValue({ incident: tasks[0] });
  });

  it('shows the directive, the stepper and the next action', async () => {
    renderAt(<FieldTaskDetail />, '/field/tasks/incident-1');

    await waitFor(() => expect(screen.getByText('Attend the junction and clear the drain.')).toBeTruthy());
    expect(screen.getByText("I'm on site")).toBeTruthy();
    expect(screen.getByText('Before you resolve')).toBeTruthy();
  });
});

describe('CitizenReport', () => {
  it('asks for the category, the urgency and the description', () => {
    const data = encodeURIComponent(JSON.stringify({ locationId: 'LOC-001', cityCode: 'CITY-IND-BPL8' }));
    renderAt(<CitizenReport />, `/citizen-report?data=${data}`);

    expect(screen.getByText('What kind of problem is it?')).toBeTruthy();
    expect(screen.getByText('How urgent is it?')).toBeTruthy();
    expect(screen.getByText('Describe the problem')).toBeTruthy();
    expect(screen.getByText('LOC-001')).toBeTruthy();
  });

  it('explains a missing location code', () => {
    renderAt(<CitizenReport />, '/citizen-report');
    expect(screen.getByText('This link is missing its location code. Please scan a valid code.')).toBeTruthy();
  });
});
