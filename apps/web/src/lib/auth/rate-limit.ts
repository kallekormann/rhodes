import { RateLimiterMemory } from "rate-limiter-flexible";

const registerLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60 * 60,
});

const loginLimiter = new RateLimiterMemory({
  points: 10,
  duration: 15 * 60,
});

const resetLimiter = new RateLimiterMemory({
  points: 3,
  duration: 60 * 60,
});

export async function checkRegisterLimit(ip: string) {
  try {
    await registerLimiter.consume(ip);
    return { allowed: true as const };
  } catch {
    return {
      allowed: false as const,
      message: "Too many sign-up attempts. Try again in an hour.",
    };
  }
}

export async function checkLoginLimit(email: string) {
  const key = email.toLowerCase();
  try {
    await loginLimiter.consume(key);
    return { allowed: true as const };
  } catch {
    return {
      allowed: false as const,
      message: "Too many login attempts. Try again in 15 minutes.",
    };
  }
}

export async function checkResetLimit(email: string) {
  const key = email.toLowerCase();
  try {
    await resetLimiter.consume(key);
    return { allowed: true as const };
  } catch {
    return {
      allowed: false as const,
      message: "Too many reset requests. Try again in an hour.",
    };
  }
}
