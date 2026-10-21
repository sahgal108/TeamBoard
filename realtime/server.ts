// Standalone Socket.IO server. Runs as its own process (not inside Next.js) because
// long-lived sockets cannot live on serverless hosting. Bridges Redis pub/sub events
// published by route handlers to browsers that have joined a project room.
//
// Security model:
//   1. connect  → the handshake carries a short-lived JWT from /api/realtime/token; verified
//                 with the same secret as the session cookie. No token, no socket.
//   2. join     → the project is loaded tenant-scoped and the caller's facts are gathered
//                 exactly like the API does; can("project:read") decides room membership.
//   3. relay    → Redis channel project:{id} → Socket.IO room project:{id}.
import "dotenv/config";
import { createServer } from "node:http";
import Redis from "ioredis";
import { Server } from "socket.io";
import { verifySession } from "@/lib/auth/jwt";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

const port = Number(process.env.REALTIME_PORT ?? 4000);
const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, clients: io.engine.clientsCount, redis: sub.status }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, { cors: { origin: allowedOrigin, credentials: true } });

const sub = new Redis(redisUrl, { lazyConnect: true, retryStrategy: attempt => Math.min(attempt * 200, 5000) });
sub.on("error", err => console.warn("[realtime] redis:", err.message));

type SocketData = { userId: string; companyId: string };

io.use(async (socket, next) => {
  const token = typeof socket.handshake.auth?.token === "string" ? socket.handshake.auth.token : undefined;
  const claims = await verifySession(token);
  if (!claims?.activeCompanyId) return next(new Error("unauthorized"));
  (socket.data as SocketData).userId = claims.sub;
  (socket.data as SocketData).companyId = claims.activeCompanyId;
  next();
});

async function canReadProject(userId: string, companyId: string, projectId: string): Promise<boolean> {
  const [membership, project] = await Promise.all([
    prisma.companyMember.findUnique({ where: { companyId_userId: { companyId, userId } }, select: { role: true } }),
    prisma.project.findFirst({ where: { id: projectId, companyId }, select: { id: true, teamId: true, projectManagerId: true } }),
  ]);
  if (!membership || !project) return false;
  const [teamMember, projectMember] = await Promise.all([
    prisma.teamMember.findUnique({ where: { teamId_userId: { teamId: project.teamId, userId } }, select: { id: true } }),
    prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: project.id, userId } }, select: { id: true } }),
  ]);
  return can({ membership: { role: membership.role } }, "project:read", {
    isProjectManager: project.projectManagerId === userId,
    isTeamMember: teamMember !== null,
    isProjectMember: projectMember !== null,
  });
}

io.on("connection", socket => {
  const { userId, companyId } = socket.data as SocketData;

  socket.on("join", async (projectId: unknown) => {
    if (typeof projectId !== "string" || projectId.length === 0 || projectId.length > 64) return;
    try {
      if (await canReadProject(userId, companyId, projectId)) {
        await socket.join(`project:${projectId}`);
        socket.emit("joined", projectId);
      } else {
        socket.emit("join:denied", projectId);
      }
    } catch (err) {
      console.warn("[realtime] join failed", err instanceof Error ? err.message : err);
      socket.emit("join:denied", projectId);
    }
  });

  socket.on("leave", (projectId: unknown) => {
    if (typeof projectId === "string") void socket.leave(`project:${projectId}`);
  });
});

async function main() {
  await sub.connect();
  await sub.psubscribe("project:*");
  sub.on("pmessage", (_pattern, channel, message) => {
    try {
      io.to(channel).emit("event", JSON.parse(message));
    } catch {
      console.warn("[realtime] dropped non-JSON message on", channel);
    }
  });
  httpServer.listen(port, () => {
    console.log(`[realtime] listening on :${port}, relaying ${redisUrl} project:* → rooms (origin ${allowedOrigin})`);
  });
}

main().catch(err => {
  console.error("[realtime] failed to start:", err);
  process.exit(1);
});
