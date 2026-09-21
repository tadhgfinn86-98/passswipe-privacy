'use strict';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

// key -> { challenge, expiresAt }
const challenges = new Map();
// key -> { count, lockedUntil }
const attempts = new Map();

const keyOf = (guildId, userId) => `${guildId}:${userId}`;

function putChallenge(guildId, userId, challenge) {
  challenges.set(keyOf(guildId, userId), { challenge, expiresAt: Date.now() + CHALLENGE_TTL_MS });
}

function getChallenge(guildId, userId) {
  const entry = challenges.get(keyOf(guildId, userId));
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    challenges.delete(keyOf(guildId, userId));
    return null;
  }
  return entry.challenge;
}

function clearChallenge(guildId, userId) {
  challenges.delete(keyOf(guildId, userId));
}

/** Remaining lockout in ms, or 0 when the member may try again. */
function lockoutRemaining(guildId, userId) {
  const entry = attempts.get(keyOf(guildId, userId));
  if (!entry || !entry.lockedUntil) return 0;
  const remaining = entry.lockedUntil - Date.now();
  if (remaining <= 0) {
    attempts.delete(keyOf(guildId, userId));
    return 0;
  }
  return remaining;
}

/**
 * Record a failed attempt. Returns { count, remaining, lockedUntil } where
 * `remaining` is how many tries are left before the cooldown kicks in.
 */
function recordFailure(guildId, userId, maxAttempts, cooldownMinutes) {
  const key = keyOf(guildId, userId);
  const entry = attempts.get(key) || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= maxAttempts) {
    entry.lockedUntil = Date.now() + cooldownMinutes * 60 * 1000;
    entry.count = 0;
  }
  attempts.set(key, entry);
  return {
    count: entry.count,
    remaining: entry.lockedUntil ? 0 : Math.max(0, maxAttempts - entry.count),
    lockedUntil: entry.lockedUntil,
  };
}

function reset(guildId, userId) {
  attempts.delete(keyOf(guildId, userId));
  challenges.delete(keyOf(guildId, userId));
}

// Challenges and lockouts are short-lived; drop expired entries so a busy
// server does not grow these maps forever.
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of challenges) if (entry.expiresAt <= now) challenges.delete(key);
  for (const [key, entry] of attempts) if (entry.lockedUntil && entry.lockedUntil <= now) attempts.delete(key);
}, SWEEP_INTERVAL_MS);
sweeper.unref();

module.exports = {
  CHALLENGE_TTL_MS,
  putChallenge,
  getChallenge,
  clearChallenge,
  lockoutRemaining,
  recordFailure,
  reset,
};
