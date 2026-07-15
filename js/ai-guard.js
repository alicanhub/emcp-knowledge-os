(function (global) {
  "use strict";
  const WINDOW_MS = 60_000,
    MAX_REQUESTS = 10,
    MAX_PROMPT = 1000,
    timestamps = [];
  let blockedUntil = 0;

  function check(prompt, now = Date.now()) {
    const value = String(prompt || "").trim();
    if (!value) return { allowed: false, reason: "empty" };
    if (value.length > MAX_PROMPT)
      return { allowed: false, reason: "too_long", retryAfter: 0 };
    if (now < blockedUntil)
      return {
        allowed: false,
        reason: "cooldown",
        retryAfter: blockedUntil - now,
      };
    while (timestamps.length && timestamps[0] <= now - WINDOW_MS)
      timestamps.shift();
    if (timestamps.length >= MAX_REQUESTS) {
      blockedUntil = now + 30_000;
      global.EMCPOperations?.track("assistant_rate_limited");
      return { allowed: false, reason: "rate_limited", retryAfter: 30_000 };
    }
    timestamps.push(now);
    return { allowed: true, remaining: MAX_REQUESTS - timestamps.length };
  }

  global.EMCPAIGuard = {
    check,
    limits: {
      windowMs: WINDOW_MS,
      maxRequests: MAX_REQUESTS,
      maxPrompt: MAX_PROMPT,
    },
  };
})(window);
