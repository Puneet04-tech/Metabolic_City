import mongoose from 'mongoose';
import { ApiUsage } from '../models/ApiUsage.js';

/**
 * The monthly request budget.
 *
 * The free tier of the data providers is counted per month, so the system
 * has to know how much of the month it has already used before it spends any
 * more. The counter is kept in the database so that a restart does not hand
 * the month a fresh allowance, and so that a second instance sees the same
 * number.
 *
 * The month rolls over at midnight UTC on the first, when the providers
 * reset.
 */
const monthKey = (now = new Date()) => now.toISOString().slice(0, 7);

const isUsable = () => {
  // Without a database there is nothing to count against, so the budget is
  // treated as unlimited rather than as zero.
  return mongoose.connection.readyState === 1;
};

/**
 * How much of this month's allowance is left.
 */
export async function remainingBudget(provider, limit) {
  if (!isUsable()) return limit;
  const record = await ApiUsage.findOne({ provider, month: monthKey() }).lean();
  const used = record?.used || 0;
  return Math.max(0, limit - used);
}

/**
 * Takes `amount` requests out of this month's allowance.
 *
 * Returns whether the request may go out, and how much is left afterwards.
 * The update is guarded by the limit in the database itself, so two callers
 * cannot both spend the last request.
 */
export async function consumeBudget(provider, amount, limit) {
  if (!isUsable()) return { allowed: true, used: 0, limit, remaining: limit };
  if (amount <= 0) return { allowed: true, used: 0, limit, remaining: limit };

  const month = monthKey();

  // Spend against the existing record, but only if it stays inside the limit.
  const updated = await ApiUsage.findOneAndUpdate(
    {
      provider,
      month,
      $expr: { $lte: [{ $add: ['$used', amount] }, '$limit'] },
    },
    { $inc: { used: amount } },
    { returnDocument: 'after' }
  );
  if (updated) {
    return {
      allowed: true,
      used: updated.used,
      limit: updated.limit,
      remaining: Math.max(0, updated.limit - updated.used),
    };
  }

  // There is no record yet, so start one.
  try {
    const created = await ApiUsage.create({ provider, month, used: amount, limit });
    return {
      allowed: true,
      used: created.used,
      limit: created.limit,
      remaining: Math.max(0, created.limit - created.used),
    };
  } catch {
    // Another caller created the record first, so try to spend against it.
    const raced = await ApiUsage.findOneAndUpdate(
      {
        provider,
        month,
        $expr: { $lte: [{ $add: ['$used', amount] }, '$limit'] },
      },
      { $inc: { used: amount } },
      { returnDocument: 'after' }
    );
    if (raced) {
      return {
        allowed: true,
        used: raced.used,
        limit: raced.limit,
        remaining: Math.max(0, raced.limit - raced.used),
      };
    }
  }

  const record = await ApiUsage.findOne({ provider, month }).lean();
  return {
    allowed: false,
    used: record?.used || 0,
    limit,
    remaining: 0,
  };
}

/**
 * How the month's allowance is being used, for the pipeline log.
 */
export async function budgetReport(provider, limit) {
  if (!isUsable()) return { provider, used: 0, limit, remaining: limit };
  const record = await ApiUsage.findOne({ provider, month: monthKey() }).lean();
  const used = record?.used || 0;
  return { provider, used, limit, remaining: Math.max(0, limit - used) };
}

/**
 * How many polls are still to come this month.
 *
 * The allowance is spent evenly across the month, so the system works out
 * how many readings it can still afford rather than spending everything in
 * the first few days and having nothing for the rest of the month.
 */
export function pollsLeftThisMonth(pollMinutes, now = new Date()) {
  const daysInMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const minutesLeft = (daysInMonth - now.getUTCDate()) * 24 * 60 + (24 * 60 - (now.getUTCHours() * 60 + now.getUTCMinutes()));
  return Math.max(1, Math.floor(minutesLeft / Math.max(1, pollMinutes)));
}

/**
 * How many readings per city still fit in the month's allowance.
 *
 * The flow readings and the incident feed have separate allowances, and the
 * incident feed is the scarcer of the two, so it is what sets the pace of
 * the poll. This is the arithmetic, kept separate from the database so it
 * can be checked.
 */
export function affordableProbes({
  flowRemaining,
  incidentRemaining,
  flowLimit,
  incidentLimit,
  pollMinutes,
  cityCount,
  maximum,
  now = new Date(),
}) {
  const polls = pollsLeftThisMonth(pollMinutes, now);
  const cities = Math.max(1, cityCount);
  const ceiling = Math.max(0, maximum);

  // The incident feed is what the pace is set by: one call per city per poll.
  const pollsAllowed = Math.floor(incidentRemaining / cities);
  const affordablePolls = Math.min(polls, pollsAllowed);

  // With no polls left there is no reading to take either.
  if (affordablePolls <= 0) {
    return {
      probes: 0,
      pollsLeft: polls,
      affordablePolls: 0,
      cities,
      ceiling,
      flowLimit,
      incidentLimit,
      monthlyFlowCost: 0,
      monthlyIncidentCost: 0,
    };
  }

  // With that many polls, how many roads per city fit under the flow limit?
  const flowAllowance = Math.max(0, flowRemaining);
  const perCity = Math.floor(flowAllowance / (affordablePolls * cities));

  return {
    probes: Math.max(0, Math.min(ceiling, perCity)),
    pollsLeft: polls,
    affordablePolls,
    cities,
    ceiling,
    flowLimit,
    incidentLimit,
    monthlyFlowCost: affordablePolls * cities * (ceiling + 1),
    monthlyIncidentCost: affordablePolls * cities,
  };
}

/**
 * How many readings per city still fit in the month's allowance.
 */
export async function affordablePerCity(options) {
  const flowRemaining = await remainingBudget(options.flowProvider, options.flowLimit);
  const incidentRemaining = await remainingBudget(
    options.incidentProvider,
    options.incidentLimit
  );
  return affordableProbes({ ...options, flowRemaining, incidentRemaining });
}
