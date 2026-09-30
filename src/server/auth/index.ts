import "server-only";
import { betterAuth } from "better-auth";
import { getDatabasePool } from "@/server/db/pool";
import { authOptions } from "./options";

let instance: ReturnType<typeof betterAuth> | undefined;
export function getAuth() {
  if (!instance) {
    instance = betterAuth(authOptions(
      getDatabasePool(), process.env.BETTER_AUTH_SECRET ?? "", process.env.BETTER_AUTH_URL ?? "",
    ));
  }
  return instance;
}
