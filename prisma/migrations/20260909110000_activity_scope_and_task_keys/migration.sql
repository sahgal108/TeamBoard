-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "teamId" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "key" TEXT NOT NULL,
ADD COLUMN     "taskCounter" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "number" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Activity_companyId_projectId_createdAt_idx" ON "Activity"("companyId", "projectId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Project_companyId_key_key" ON "Project"("companyId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Task_projectId_number_key" ON "Task"("projectId", "number");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

