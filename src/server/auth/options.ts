import type { Pool } from "pg";
import type { BetterAuthOptions } from "better-auth";

export function authOptions(database: Pool, secret: string, baseURL: string): BetterAuthOptions {
  if (secret.length < 32) throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");
  const url = new URL(baseURL);
  if (url.protocol !== "https:" && !["127.0.0.1", "localhost"].includes(url.hostname)) {
    throw new Error("Authentication requires HTTPS outside local development.");
  }
  return {
    appName: "퀴즈퀴즈",
    database,
    secret,
    baseURL: url.origin,
    trustedOrigins: [url.origin],
    emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128 },
    user: { modelName: "auth_user" },
    account: { modelName: "auth_account" },
    verification: { modelName: "auth_verification" },
    session: { modelName: "auth_session", expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    advanced: {
      cookiePrefix: "quizquiz",
      useSecureCookies: url.protocol === "https:",
      disableOriginCheck: false,
      disableCSRFCheck: false,
    },
    rateLimit: {
      enabled: true, storage: "database", modelName: "auth_rate_limit", window: 60, max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
      },
    },
    databaseHooks: {
      user: { create: { before: async (user) => {
        const name = user.name.trim();
        if (name.length < 2 || name.length > 24) return false;
        return { data: { ...user, name } };
      } } },
    },
  };
}
