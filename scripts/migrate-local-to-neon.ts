import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const sourceDatabaseUrl =
  process.env.SOURCE_DATABASE_URL ?? "postgresql://postgres@localhost:5432/postgres?sslmode=disable";
const targetDatabaseUrl = process.env.DATABASE_URL;
const shouldForce = process.argv.includes("--force");

if (!targetDatabaseUrl) {
  console.error("Missing DATABASE_URL for the target database.");
  process.exit(1);
}

if (sourceDatabaseUrl === targetDatabaseUrl) {
  console.error("SOURCE_DATABASE_URL and DATABASE_URL point to the same database.");
  process.exit(1);
}

const source = new Client({ connectionString: sourceDatabaseUrl });
const target = new Client({ connectionString: targetDatabaseUrl });

const insertionPlan = [
  {
    table: "User",
    columns: ["id", "email", "name", "passwordHash", "isGodMode", "createdAt", "updatedAt"],
  },
  {
    table: "Workspace",
    columns: ["id", "name", "slug", "createdAt", "updatedAt"],
  },
  {
    table: "WorkspaceMember",
    columns: ["id", "userId", "workspaceId", "role", "createdAt", "updatedAt"],
  },
  {
    table: "Session",
    columns: ["id", "tokenHash", "userId", "expiresAt", "createdAt", "updatedAt"],
  },
  {
    table: "Task",
    columns: [
      "id",
      "workspaceId",
      "createdById",
      "assigneeId",
      "title",
      "details",
      "dueDate",
      "remindAt",
      "status",
      "importance",
      "sortOrder",
      "isRecurring",
      "recurrenceRule",
      "plannedForDate",
      "archivedAt",
      "blockedReason",
      "completedAt",
      "createdAt",
      "updatedAt",
    ],
  },
  {
    table: "TaskLink",
    columns: ["id", "taskId", "label", "url", "sortOrder", "createdAt", "updatedAt"],
  },
  {
    table: "TaskOccurrence",
    columns: [
      "id",
      "workspaceId",
      "taskId",
      "scheduledFor",
      "dueDate",
      "status",
      "completedAt",
      "skippedAt",
      "createdAt",
      "updatedAt",
    ],
  },
  {
    table: "CapturedItem",
    columns: [
      "id",
      "workspaceId",
      "sourceType",
      "status",
      "externalId",
      "title",
      "body",
      "sourceLabel",
      "sourceUrl",
      "sender",
      "suggestedDueDate",
      "receivedAt",
      "acceptedAt",
      "discardedAt",
      "taskId",
      "createdAt",
      "updatedAt",
    ],
  },
  {
    table: "TaskComment",
    columns: ["id", "workspaceId", "taskId", "authorId", "body", "createdAt", "updatedAt"],
  },
  {
    table: "TaskActivity",
    columns: ["id", "workspaceId", "taskId", "actorUserId", "type", "message", "createdAt"],
  },
  {
    table: "Notification",
    columns: [
      "id",
      "workspaceId",
      "userId",
      "actorUserId",
      "taskId",
      "type",
      "title",
      "body",
      "dedupeKey",
      "readAt",
      "createdAt",
      "updatedAt",
    ],
  },
  {
    table: "WorkspaceInvite",
    columns: [
      "id",
      "workspaceId",
      "email",
      "role",
      "token",
      "invitedById",
      "expiresAt",
      "acceptedAt",
      "revokedAt",
      "createdAt",
      "updatedAt",
    ],
  },
] as const;

const cleanupOrder = insertionPlan.map((entry) => entry.table).reverse();

function q(identifier: string) {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

async function queryCount(client: pg.Client, table: string) {
  const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${q(table)}`);
  return result.rows[0]?.count ?? 0;
}

async function ensureTargetSchema() {
  const result = await target.query(`SELECT to_regclass('public."User"') AS "userTable"`);

  if (!result.rows[0]?.userTable) {
    console.error('Target database is missing schema. Run "npx prisma migrate deploy" first.');
    process.exit(1);
  }
}

async function ensureSafeTarget() {
  const counts = await Promise.all(
    insertionPlan.map(async ({ table }) => ({
      table,
      count: await queryCount(target, table),
    })),
  );

  const populated = counts.filter((entry) => entry.count > 0);

  if (populated.length > 0 && !shouldForce) {
    console.error("Target database already contains data:");
    for (const entry of populated) {
      console.error(`- ${entry.table}: ${entry.count}`);
    }
    console.error('Re-run with "--force" if you want to replace the target data.');
    process.exit(1);
  }
}

async function truncateTarget() {
  await target.query(`TRUNCATE ${cleanupOrder.map((table) => q(table)).join(", ")} RESTART IDENTITY CASCADE`);
}

async function readRows(client: pg.Client, table: string, columns: readonly string[]) {
  const result = await client.query(
    `SELECT ${columns.map((column) => q(column)).join(", ")} FROM ${q(table)} ORDER BY 1`,
  );
  return result.rows;
}

async function insertRows(table: string, columns: readonly string[], rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    return;
  }

  const chunkSize = 250;

  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    const values: unknown[] = [];
    const placeholders = chunk.map((row, rowIndex) => {
      const rowPlaceholders = columns.map((_column, columnIndex) => {
        values.push(row[columns[columnIndex]]);
        return `$${rowIndex * columns.length + columnIndex + 1}`;
      });

      return `(${rowPlaceholders.join(", ")})`;
    });

    await target.query(
      `INSERT INTO ${q(table)} (${columns.map((column) => q(column)).join(", ")}) VALUES ${placeholders.join(", ")}`,
      values,
    );
  }
}

async function syncDeferredForeignKeys() {
  const userDefaults = await source.query(
    `SELECT "id", "defaultWorkspaceId" FROM "User" WHERE "defaultWorkspaceId" IS NOT NULL`,
  );

  for (const row of userDefaults.rows) {
    await target.query(`UPDATE "User" SET "defaultWorkspaceId" = $2 WHERE "id" = $1`, [
      row.id,
      row.defaultWorkspaceId,
    ]);
  }

  const workspaceOwners = await source.query(
    `SELECT "id", "ownerId" FROM "Workspace" WHERE "ownerId" IS NOT NULL`,
  );

  for (const row of workspaceOwners.rows) {
    await target.query(`UPDATE "Workspace" SET "ownerId" = $2 WHERE "id" = $1`, [row.id, row.ownerId]);
  }
}

async function main() {
  await source.connect();
  await target.connect();

  await ensureTargetSchema();
  await ensureSafeTarget();

  const sourceTaskCount = await queryCount(source, "Task");
  const sourceUserCount = await queryCount(source, "User");

  console.log(`Source database: ${sourceUserCount} users, ${sourceTaskCount} tasks`);
  console.log(`Target database: ${targetDatabaseUrl}`);

  await target.query("BEGIN");

  try {
    await truncateTarget();

    for (const step of insertionPlan) {
      const rows = await readRows(source, step.table, step.columns);
      await insertRows(step.table, step.columns, rows);
      console.log(`Copied ${rows.length} rows into ${step.table}`);
    }

    await syncDeferredForeignKeys();
    await target.query("COMMIT");
    console.log("Database migration to Neon completed.");
  } catch (error) {
    await target.query("ROLLBACK");
    throw error;
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
