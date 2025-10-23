// Drizzle Kit configuration for Postgres.
// For initial bring-up, prefer `drizzle-kit introspect` to generate a baseline.
// Migrations should be run only in local/dev unless explicitly owning a change.

// Keep this a plain object to avoid typecheck dependency on drizzle-kit types.
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
};
