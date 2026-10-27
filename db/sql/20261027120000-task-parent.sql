-- Subtasks: one level deep, same project as the parent (both enforced by the service).
-- Deleting a parent keeps its subtasks as ordinary tasks.
ALTER TABLE "Task" ADD COLUMN "parentId" TEXT;

ALTER TABLE "Task" ADD CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Task_parentId_idx" ON "Task"("parentId");
