const fs = require("node:fs");
const path = require("node:path");

/** Tables, enums, indexes and foreign keys for Company > Team > Project > Task. */
module.exports = {
  async up(queryInterface) {
    const sql = fs.readFileSync(path.join(__dirname, "..", "sql", "20260909101830-init.sql"), "utf8");
    await queryInterface.sequelize.query(sql);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS "Activity", "Comment", "Task", "ProjectMember", "Project", "TeamMember", "Team", "CompanyMember", "User", "Company" CASCADE;
      DROP TYPE IF EXISTS "CompanyRole", "ProjectStatus", "TaskStatus", "TaskPriority";
    `);
  },
};
