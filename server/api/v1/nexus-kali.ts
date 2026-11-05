import { Router } from "express";
import { ensureAuthenticated, ensureRole } from "../../auth/middleware";
import { nexusKaliBridge } from "../../services/nexus-kali-bridge";
import { createLogger } from "../../lib/logger";

const log = createLogger("nexus-kali-api");
const router = Router();
router.use(ensureAuthenticated);

// GET /status — container status
router.get("/status", async (_req, res) => {
  try {
    const status = await nexusKaliBridge.getStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /exec — execute command in nexus-kali
router.post("/exec", ensureRole("admin", "operator"), async (req, res) => {
  const { command, workDir, timeout } = req.body;
  if (!Array.isArray(command) || command.length === 0) {
    return res.status(400).json({ error: "command must be a non-empty string array" });
  }

  const user = req.user as any;
  log.info(`[exec] user=${user?.username} cmd=${command.join(" ").slice(0, 120)}`);

  try {
    const result = await nexusKaliBridge.exec(command, workDir, timeout);
    res.json({
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      duration: result.duration,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /results — list scan result files
router.get("/results", async (_req, res) => {
  try {
    const files = await nexusKaliBridge.listResults();
    res.json({ files });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /results/:filename — read a result file
router.get("/results/:filename", async (req, res) => {
  try {
    const content = await nexusKaliBridge.readResult(req.params.filename);
    const isJson = req.params.filename.endsWith(".json");
    if (isJson) {
      try {
        res.json(JSON.parse(content));
        return;
      } catch { /* fall through to text */ }
    }
    res.type("text/plain").send(content);
  } catch (err: any) {
    if (err.code === "ENOENT") return res.status(404).json({ error: "File not found" });
    res.status(500).json({ error: err.message });
  }
});

// GET /logs — container logs
router.get("/logs", async (req, res) => {
  const lines = parseInt(req.query.lines as string, 10) || 100;
  const since = (req.query.since as string) || undefined;
  try {
    const logs = await nexusKaliBridge.getLogs(Math.min(lines, 5000), since);
    res.type("text/plain").send(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /engagements — list engagement directories
router.get("/engagements", async (_req, res) => {
  try {
    const dirs = await nexusKaliBridge.listEngagements();
    res.json({ engagements: dirs.filter((d) => d.isDirectory) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /engagements/:name — list files in engagement
router.get("/engagements/:name", async (req, res) => {
  try {
    const files = await nexusKaliBridge.listEngagementFiles(req.params.name);
    res.json({ files });
  } catch (err: any) {
    if (err.message.includes("traversal")) return res.status(403).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /engagements/:name/:file — read engagement file
router.get("/engagements/:name/:file", async (req, res) => {
  try {
    const content = await nexusKaliBridge.readEngagementFile(req.params.name, req.params.file);
    const isJson = req.params.file.endsWith(".json");
    if (isJson) {
      try { res.json(JSON.parse(content)); return; } catch { /* text fallback */ }
    }
    res.type("text/plain").send(content);
  } catch (err: any) {
    if (err.code === "ENOENT") return res.status(404).json({ error: "File not found" });
    if (err.message.includes("traversal")) return res.status(403).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /shared — list shared files
router.get("/shared", async (_req, res) => {
  try {
    const files = await nexusKaliBridge.listShared();
    res.json({ files });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /shared/:path(*) — read shared file
router.get("/shared/:path(*)", async (req, res) => {
  try {
    const content = await nexusKaliBridge.readSharedFile(req.params.path);
    const isJson = req.params.path.endsWith(".json");
    if (isJson) {
      try { res.json(JSON.parse(content)); return; } catch { /* text fallback */ }
    }
    res.type("text/plain").send(content);
  } catch (err: any) {
    if (err.code === "ENOENT") return res.status(404).json({ error: "File not found" });
    if (err.message.includes("traversal")) return res.status(403).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

export default router;
