import "dotenv/config";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("Missing DATABASE_URL in environment.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.error("Usage: npx tsx scripts/reset-password.ts <email> <new-password>");
    process.exit(1);
  }

  if (newPassword.length < 8) {
    console.error("Password must be at least 8 characters long.");
    process.exit(1);
  }

  const passwordHash = hashPassword(newPassword);

  await prisma.user.update({
    where: { email },
    data: { passwordHash },
  });

  console.log(`✅ Password updated for ${email}`);
}

main()
  .catch((error) => {
    console.error("❌ Failed to update password", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
