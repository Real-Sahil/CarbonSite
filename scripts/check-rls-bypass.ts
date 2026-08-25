import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function checkRlsBypass() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  try {
    const { stdout } = await execAsync(
      `psql "${databaseUrl}" -c "SELECT rolbypassrls FROM pg_roles WHERE rolname = 'postgres';"`,
    );

    const match = stdout.match(/\s*t\s*/i);
    if (!match) {
      console.error(
        "ERROR: postgres role does not have RLS bypass enabled (rolbypassrls != true).",
        "This would break the application since Prisma client relies on RLS bypass.",
        "This should only change by explicit action, not silently.",
      );
      process.exit(1);
    }

    console.log("✓ postgres role has RLS bypass enabled (rolbypassrls=true)");
  } catch (err) {
    console.error("Failed to check RLS bypass:", err);
    process.exit(1);
  }
}

checkRlsBypass();
