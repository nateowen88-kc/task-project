-- CreateEnum
CREATE TYPE "TaskImportance" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- DropIndex
DROP INDEX "Task_archivedAt_status_idx";

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "importance" "TaskImportance" NOT NULL DEFAULT 'MEDIUM';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isGodMode" BOOLEAN NOT NULL DEFAULT false;
