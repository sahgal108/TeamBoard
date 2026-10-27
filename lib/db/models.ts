import { createId } from "@paralleldrive/cuid2";
import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
} from "sequelize";
import { CompanyRole, ProjectStatus, TaskPriority, TaskStatus } from "./enums";
import { sequelize } from "./sequelize";

// Models map onto the existing tables: PascalCase table names, camelCase columns, string ids.
// The schema itself is owned by db/migrations; nothing here calls sync().

const id = { type: DataTypes.STRING, primaryKey: true, defaultValue: () => createId() } as const;
const fk = (allowNull = false) => ({ type: DataTypes.STRING, allowNull });
const enumOf = (values: Record<string, string>) => DataTypes.ENUM(...Object.values(values));

export class Company extends Model<InferAttributes<Company>, InferCreationAttributes<Company>> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare slug: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare email: string;
  declare passwordHash: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare companyMemberships?: NonAttribute<CompanyMember[]>;
}

/** A user's role inside one company. A user may belong to several companies. */
export class CompanyMember extends Model<InferAttributes<CompanyMember>, InferCreationAttributes<CompanyMember>> {
  declare id: CreationOptional<string>;
  declare companyId: string;
  declare userId: string;
  declare role: CompanyRole;
  declare createdAt: CreationOptional<Date>;
  declare company?: NonAttribute<Company>;
  declare user?: NonAttribute<User>;
}

export class Team extends Model<InferAttributes<Team>, InferCreationAttributes<Team>> {
  declare id: CreationOptional<string>;
  declare companyId: string;
  declare name: string;
  declare description: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare members?: NonAttribute<TeamMember[]>;
}

export class TeamMember extends Model<InferAttributes<TeamMember>, InferCreationAttributes<TeamMember>> {
  declare id: CreationOptional<string>;
  declare teamId: string;
  declare userId: string;
  declare createdAt: CreationOptional<Date>;
  declare user?: NonAttribute<User>;
}

export class Project extends Model<InferAttributes<Project>, InferCreationAttributes<Project>> {
  declare id: CreationOptional<string>;
  declare companyId: string;
  declare teamId: string;
  declare name: string;
  /** Short uppercase prefix for task keys, e.g. "PAY" → PAY-14. Unique within a company. */
  declare key: string;
  declare description: CreationOptional<string | null>;
  declare status: CreationOptional<ProjectStatus>;
  declare projectManagerId: CreationOptional<string | null>;
  /** Monotonic counter used to allocate Task.number atomically inside the create transaction. */
  declare taskCounter: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare team?: NonAttribute<Team>;
  declare projectManager?: NonAttribute<User | null>;
  declare members?: NonAttribute<ProjectMember[]>;
}

export class ProjectMember extends Model<InferAttributes<ProjectMember>, InferCreationAttributes<ProjectMember>> {
  declare id: CreationOptional<string>;
  declare projectId: string;
  declare userId: string;
  declare createdAt: CreationOptional<Date>;
  declare user?: NonAttribute<User>;
}

/** companyId is denormalized on purpose: every tenant-scoped query filters on { id, companyId }.
 *  The service layer copies it from the parent project; it is never accepted from client input. */
export class Task extends Model<InferAttributes<Task>, InferCreationAttributes<Task>> {
  declare id: CreationOptional<string>;
  declare companyId: string;
  declare projectId: string;
  /** Per-project sequence; displayed as `${project.key}-${number}`. */
  declare number: number;
  declare title: string;
  declare description: CreationOptional<string | null>;
  declare status: CreationOptional<TaskStatus>;
  declare priority: CreationOptional<TaskPriority>;
  declare assigneeId: CreationOptional<string | null>;
  declare createdById: string;
  declare dueDate: CreationOptional<Date | null>;
  /** Set on subtasks only. Always a top-level task in the same project. */
  declare parentId: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare project?: NonAttribute<Project>;
  declare assignee?: NonAttribute<User | null>;
  declare createdBy?: NonAttribute<User>;
  declare comments?: NonAttribute<Comment[]>;
  declare parent?: NonAttribute<Task | null>;
  declare subtasks?: NonAttribute<Task[]>;
}

export class Comment extends Model<InferAttributes<Comment>, InferCreationAttributes<Comment>> {
  declare id: CreationOptional<string>;
  declare companyId: string;
  declare taskId: string;
  declare userId: string;
  declare content: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare user?: NonAttribute<User>;
}

/** Append-only audit log, written in the same transaction as the change it describes.
 *  projectId / teamId are denormalized scope so role-limited users see only what they may. */
export class Activity extends Model<InferAttributes<Activity>, InferCreationAttributes<Activity>> {
  declare id: CreationOptional<string>;
  declare companyId: string;
  declare userId: string;
  declare entityType: string;
  declare entityId: string;
  declare action: string;
  declare metadata: CreationOptional<Record<string, unknown> | null>;
  declare projectId: CreationOptional<string | null>;
  declare teamId: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare user?: NonAttribute<User>;
  declare project?: NonAttribute<Project | null>;
}

const timestamps = { createdAt: DataTypes.DATE, updatedAt: DataTypes.DATE };
const createdOnly = { createdAt: DataTypes.DATE };

Company.init(
  { id, name: { type: DataTypes.STRING, allowNull: false }, slug: { type: DataTypes.STRING, allowNull: false, unique: true }, ...timestamps },
  { sequelize, tableName: "Company" },
);

User.init(
  {
    id,
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
    ...timestamps,
  },
  { sequelize, tableName: "User" },
);

CompanyMember.init(
  { id, companyId: fk(), userId: fk(), role: { type: enumOf(CompanyRole), allowNull: false }, ...createdOnly },
  { sequelize, tableName: "CompanyMember", updatedAt: false },
);

Team.init(
  { id, companyId: fk(), name: { type: DataTypes.STRING, allowNull: false }, description: { type: DataTypes.STRING, allowNull: true }, ...timestamps },
  { sequelize, tableName: "Team" },
);

TeamMember.init({ id, teamId: fk(), userId: fk(), ...createdOnly }, { sequelize, tableName: "TeamMember", updatedAt: false });

Project.init(
  {
    id,
    companyId: fk(),
    teamId: fk(),
    name: { type: DataTypes.STRING, allowNull: false },
    key: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.STRING, allowNull: true },
    status: { type: enumOf(ProjectStatus), allowNull: false, defaultValue: ProjectStatus.PLANNED },
    projectManagerId: fk(true),
    taskCounter: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    ...timestamps,
  },
  { sequelize, tableName: "Project" },
);

ProjectMember.init({ id, projectId: fk(), userId: fk(), ...createdOnly }, { sequelize, tableName: "ProjectMember", updatedAt: false });

Task.init(
  {
    id,
    companyId: fk(),
    projectId: fk(),
    number: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: { type: enumOf(TaskStatus), allowNull: false, defaultValue: TaskStatus.TODO },
    priority: { type: enumOf(TaskPriority), allowNull: false, defaultValue: TaskPriority.MEDIUM },
    assigneeId: fk(true),
    createdById: fk(),
    dueDate: { type: DataTypes.DATE, allowNull: true },
    parentId: fk(true),
    ...timestamps,
  },
  { sequelize, tableName: "Task" },
);

Comment.init(
  { id, companyId: fk(), taskId: fk(), userId: fk(), content: { type: DataTypes.TEXT, allowNull: false }, ...timestamps },
  { sequelize, tableName: "Comment" },
);

Activity.init(
  {
    id,
    companyId: fk(),
    userId: fk(),
    entityType: { type: DataTypes.STRING, allowNull: false },
    entityId: { type: DataTypes.STRING, allowNull: false },
    action: { type: DataTypes.STRING, allowNull: false },
    metadata: { type: DataTypes.JSONB, allowNull: true },
    projectId: fk(true),
    teamId: fk(true),
    ...createdOnly,
  },
  { sequelize, tableName: "Activity", updatedAt: false },
);

// ---------- Associations (aliases mirror the old relation names) ----------
CompanyMember.belongsTo(Company, { as: "company", foreignKey: "companyId" });
CompanyMember.belongsTo(User, { as: "user", foreignKey: "userId" });
User.hasMany(CompanyMember, { as: "companyMemberships", foreignKey: "userId" });

Team.hasMany(TeamMember, { as: "members", foreignKey: "teamId" });
Team.hasMany(Project, { as: "projects", foreignKey: "teamId" });
TeamMember.belongsTo(User, { as: "user", foreignKey: "userId" });
TeamMember.belongsTo(Team, { as: "team", foreignKey: "teamId" });

Project.belongsTo(Team, { as: "team", foreignKey: "teamId" });
Project.belongsTo(User, { as: "projectManager", foreignKey: "projectManagerId" });
Project.hasMany(ProjectMember, { as: "members", foreignKey: "projectId" });
Project.hasMany(Task, { as: "tasks", foreignKey: "projectId" });
ProjectMember.belongsTo(User, { as: "user", foreignKey: "userId" });

Task.belongsTo(Project, { as: "project", foreignKey: "projectId" });
Task.belongsTo(User, { as: "assignee", foreignKey: "assigneeId" });
Task.belongsTo(User, { as: "createdBy", foreignKey: "createdById" });
Task.hasMany(Comment, { as: "comments", foreignKey: "taskId" });
Task.belongsTo(Task, { as: "parent", foreignKey: "parentId" });
Task.hasMany(Task, { as: "subtasks", foreignKey: "parentId" });
Comment.belongsTo(User, { as: "user", foreignKey: "userId" });

Activity.belongsTo(User, { as: "user", foreignKey: "userId" });
Activity.belongsTo(Project, { as: "project", foreignKey: "projectId" });

export { sequelize };
