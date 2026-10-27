const fs = require("node:fs");
const path = require("node:path");

/** Task.parentId for subtasks. */
module.exports = {
  async up(queryInterface) {
    const sql = fs.readFileSync(path.join(__dirname, "..", "sql", "20261027120000-task-parent.sql"), "utf8");
    await queryInterface.sequelize.query(sql);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_parentId_fkey";
      DROP INDEX IF EXISTS "Task_parentId_idx";
      ALTER TABLE "Task" DROP COLUMN IF EXISTS "parentId";
    `);
  },
};
