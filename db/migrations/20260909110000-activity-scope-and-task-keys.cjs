const fs = require("node:fs");
const path = require("node:path");

/** Activity.projectId / teamId scope columns, Project.key + taskCounter, Task.number. */
module.exports = {
  async up(queryInterface) {
    const sql = fs.readFileSync(path.join(__dirname, "..", "sql", "20260909110000-activity-scope-and-task-keys.sql"), "utf8");
    await queryInterface.sequelize.query(sql);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Activity" DROP CONSTRAINT IF EXISTS "Activity_projectId_fkey", DROP CONSTRAINT IF EXISTS "Activity_teamId_fkey";
      DROP INDEX IF EXISTS "Activity_companyId_projectId_createdAt_idx", "Project_companyId_key_key", "Task_projectId_number_key";
      ALTER TABLE "Activity" DROP COLUMN IF EXISTS "projectId", DROP COLUMN IF EXISTS "teamId";
      ALTER TABLE "Project" DROP COLUMN IF EXISTS "key", DROP COLUMN IF EXISTS "taskCounter";
      ALTER TABLE "Task" DROP COLUMN IF EXISTS "number";
    `);
  },
};
