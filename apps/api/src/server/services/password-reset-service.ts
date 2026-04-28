import crypto from "node:crypto";
import { PasswordResetTokenType, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "../lib/db.js";

type ResetClient = Prisma.TransactionClient | PrismaClient;

const tokenLifetimeMinutes = 60;

export function hashResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createPasswordResetToken(
  userId: string,
  type: PasswordResetTokenType,
  tx: ResetClient = prisma,
) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + tokenLifetimeMinutes * 60 * 1000);

  await tx.passwordResetToken.create({
    data: {
      userId,
      type,
      tokenHash,
      expiresAt,
    },
  });

  return {
    token: rawToken,
    expiresAt,
  };
}

export async function consumePasswordResetToken(token: string, tx: ResetClient = prisma) {
  const tokenHash = hashResetToken(token);
  const record = await tx.passwordResetToken.findUnique({
    where: { tokenHash },
    include: {
      user: true,
    },
  });

  if (!record || record.usedAt || record.expiresAt <= new Date()) {
    return null;
  }

  await tx.passwordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  return record;
}
