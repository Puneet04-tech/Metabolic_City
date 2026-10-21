import mongoose from 'mongoose';
import { ApiUsage } from '../models/ApiUsage.js';

/**
 * The daily request budget.
 *
 * The free tiers of the data providers are counted per day, so the system
 * has to know how much of the day it has already used before it spends any
 * more. The counter is kept in the database so that a restart does not hand
 * the day a fresh allowance, and so that a second instance sees the same
 * number.
 *
 * The day rolls over at midnight UTC, which is when the providers reset.
 */
const dayKey = (now = new Date()) => now.toISOString().slice(0, 10);

const isUsable = () => {
  // Without a database there is nothing to count against, so the budget is
  // treated as unlimited rather than as zero.
  return mongoose.connection.readyState === 1;
};

/**
 * How much of today's allowance is left.
 */
export async function remainingBudget(provider, limit) {
  if (!isUsable()) return limit;
  const record = await ApiUsage.findOne({ provider, day: dayKey() }).lean();
  const used = record?.used || 0;
  return Math.max(0, limit - used);
}

/**
 * Takes `amount` requests out of today's allowance.
 *
 * Returns whether the request may go out, and how much is left afterwards.
 * The update is guarded by the limit in the database itself, so two callers
 * cannot both spend the last request.
 */
export async function consumeBudget(provider, amount, limit) {
  if (!isUsable()) return { allowed: true, used: 0, limit, remaining: limit };
  if (amount <= 0) return { allowed: true, used: 0, limit, remaining: limit };

  const day = dayKey();

  // Spend against the existing record, but only if it stays inside the limit.
  const updated = await ApiUsage.findOneAndUpdate(
    {
      provider,
      day,
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
    const created = await ApiUsage.create({ provider, day, used: amount, limit });
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
        day,
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

  const record = await ApiUsage.findOne({ provider, day }).lean();
  return {
    allowed: false,
    used: record?.used || 0,
    limit,
    remaining: 0,
  };
}

/**
 * How the day's allowance is being used, for the pipeline log.
 */
export async function budgetReport(provider, limit) {
  if (!isUsable()) return { provider, used: 0, limit, remaining: limit };
  const record = await ApiUsage.findOne({ provider, day: dayKey() }).lean();
  const used = record?.used || 0;
  return { provider, used, limit, remaining: Math.max(0, limit - used) };
}

/**
 * How many polls are still to come today.
 *
 * The allowance is spent evenly across the day, so the system works out how
 * many readings it can still afford rather than spending everything in the
 * first few hours and having nothing for the evening.
 */
export function pollsLeftToday(pollMinutes, now = new Date()) {
  const minutesLeftInDay = 24 * 60 - (now.getUTCHours() * 60 + now.getUTCMinutes());
  return Math.max(1, Math.floor(minutesLeftInDay / Math.max(1, pollMinutes)));
}

/**
 * How many readings per city fit in what is left of the allowance.
 *
 * This is the arithmetic, kept separate from the database so it can be
 * checked. The allowance is spread across the polls that are still to come
 * today, so it never runs out before midnight and never needs to be
 * refused by the provider.
 */
export function affordableProbes({
  remaining,
  limit,
  pollMinutes,
  cityCount,
  maximum,
  now = new Date(),
}) {
  const polls = pollsLeftToday(pollMinutes, now);
  const cities = Math.max(1, cityCount);
  const ceiling = Math.max(0, maximum);

  // One request per city per poll is spent on the incident feed.
  const forIncidents = polls * cities;
  const forReadings = Math.max(0, remaining - forIncidents);
  const perCity = Math.floor(forReadings / (polls * cities));

  return {
    probes: Math.max(0, Math.min(ceiling, perCity)),
    pollsLeft: polls,
    cities,
    ceiling,
    dailyCost: polls * cities * (ceiling + 1),
    limit,
  };
}

/**
 * How many readings per city still fit in the allowance.
 */
export async function affordablePerCity(provider, limit, pollMinutes, cityCount, maximum) {
  const left = await remainingBudget(provider, limit);
  return affordableProbes({
    remaining: left,
    limit,
    pollMinutes,
    cityCount,
    maximum,
  });
}
