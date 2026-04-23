import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as dotenv from "dotenv";
dotenv.config();

async function runMigration() {
  const databaseUrl = process.env['DATABASE_URL'];
  
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL is missing");
    process.exit(1);
  }
  console.log("⏳ Running migrations with URL:", databaseUrl.replace(/:[^:@]+@/, ':***@'));
  
  const sql = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sql);
  try {
    await migrate(db, { migrationsFolder: "./drizzle/migrations" });
    console.log("✅ Migrations completed successfully");
  } catch (error: any) {
    console.error("❌ Migration failed:", JSON.stringify(error, null, 2));
    console.error("Error message:", error?.message);
    console.error("Error stack:", error?.stack);
    process.exit(1);
  } finally {
    await sql.end();
  }
}
runMigration();
