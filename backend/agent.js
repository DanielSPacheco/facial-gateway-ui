/**
 * Facial Agent - Job Processor & Heartbeat (Enterprise)
 *
 * Workflow:
 * 1) Heartbeat Loop: Pings all devices, updates DB status (Online/Offline/Latency)
 * 2) Job Loop: Polls for 'pending' jobs
 *    - Validates facial_id for critical actions
 *    - Executes RPC on Gateway
 *    - Captures Snapshot (Mock/Real)
 *    - Logs Access Event
 */

const path = require("path");
const net = require("net");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });

// Env Shim for Next.js variables
if (!process.env.SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}
if (!process.env.SITE_ID && process.env.NEXT_PUBLIC_SITE_ID) {
  process.env.SITE_ID = process.env.NEXT_PUBLIC_SITE_ID;
}
if (!process.env.AGENT_ID) {
  process.env.AGENT_ID = "local-agent";
}

const { createClient } = require("@supabase/supabase-js");

// ========================
// ENV
// ========================
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const SITE_ID = process.env.SITE_ID || process.env.NEXT_PUBLIC_SITE_ID;
const AGENT_ID = process.env.AGENT_ID;

const GATEWAY_BASE_URL = process.env.GATEWAY_BASE_URL || "http://127.0.0.1:3000";
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 1500);
const HEARTBEAT_INTERVAL_MS = 10000; // 10s

// Jobs
const JOB_STATUS_PENDING = "pending";
const JOB_STATUS_PROCESSING = "processing";
const JOB_STATUS_DONE = "done";
const JOB_STATUS_FAILED = "failed";

const DEFAULT_HTTP_TIMEOUT_MS = 30000;
const FACE_HTTP_TIMEOUT_MS = 60000;

// ========================
// UTILS
// ========================
function requireEnv(name) {
  if (!process.env[name]) throw new Error(`Missing env var: ${name}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString();
}

// TCP Ping
function tcpPing(host, port, timeout = 2000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(timeout);

    socket.on("connect", () => {
      const latency = Date.now() - start;
      socket.destroy();
      resolve({ online: true, latency });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ online: false, latency: 0 });
    });

    socket.on("error", (err) => {
      socket.destroy();
      resolve({ online: false, latency: 0 });
    });

    socket.connect(port, host);
  });
}

// ========================
// SUPABASE CLIENT
// ========================
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ========================
// HEARTBEAT LOOP
// ========================
async function heartbeatLoop() {
  console.log("💓 Heartbeat Loop Started...");
  while (true) {
    try {
      const { data: facials, error } = await supabase
        .from("facials")
        .select("id, ip, port, name")
        .eq("site_id", SITE_ID);

      if (error) {
        console.error("❌ Heartbeat DB Error:", error.message);
      } else if (facials) {
        for (const dev of facials) {
          if (!dev.ip) continue;
          const port = dev.port || 80;
          const { online, latency } = await tcpPing(dev.ip, port);

          await supabase
            .from("facials")
            .update({
              status: online ? "online" : "offline",
              last_seen_at: nowIso(),
              latency_ms: online ? latency : null
            })
            .eq("id", dev.id);
        }
      }
    } catch (e) {
      console.error("❌ Heartbeat Crash:", e.message);
    }
    await sleep(HEARTBEAT_INTERVAL_MS);
  }
}

// ========================
// JOB PROCESSOR Helpers
// ========================
async function findPendingJob() {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("site_id", SITE_ID)
    .eq("status", JOB_STATUS_PENDING)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
}

async function lockJob(jobId) {
  const { data, error } = await supabase
    .from("jobs")
    .update({
      status: JOB_STATUS_PROCESSING,
      agent_id: AGENT_ID,
      locked_at: nowIso(),
      locked_by: AGENT_ID,
      updated_at: nowIso(),
    })
    .eq("id", jobId)
    .eq("status", JOB_STATUS_PENDING)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function completeJob(jobId, result) {
  await supabase
    .from("jobs")
    .update({
      status: JOB_STATUS_DONE,
      result,
      error_message: null,
      executed_at: nowIso(),
      locked_at: null,
      locked_by: null,
      updated_at: nowIso(),
    })
    .eq("id", jobId);
}

async function failOrRetryJob(job, message, result = null) {
  const attempts = Number(job.attempts || 0);
  const maxAttempts = Number(job.max_attempts || 3);
  const status = attempts + 1 < maxAttempts ? JOB_STATUS_PENDING : JOB_STATUS_FAILED;

  await supabase.from("jobs").update({
    status,
    attempts: attempts + 1,
    error_message: message,
    result,
    executed_at: status === JOB_STATUS_FAILED ? nowIso() : undefined,
    locked_at: null,
    updated_at: nowIso()
  }).eq("id", job.id);

  return { retried: status === JOB_STATUS_PENDING, attempts: attempts + 1, maxAttempts };
}

async function httpJson(url, body, timeoutMs = DEFAULT_HTTP_TIMEOUT_MS) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    });
    const text = await resp.text();
    clearTimeout(t);

    let parsed;
    try { parsed = JSON.parse(text); }
    catch { parsed = { ok: false, error: "NON_JSON_RESPONSE", raw: text }; }

    if (typeof parsed.ok === "undefined") parsed.ok = resp.ok;
    if (!parsed.ok) parsed.http_status = resp.status;
    return parsed;
  } catch (err) {
    clearTimeout(t);
    return { ok: false, error: err.name === "AbortError" ? "TIMEOUT" : (err.message || "FETCH_ERROR") };
  }
}

// ========================
// SNAPSHOT LOGIC
// ========================
async function captureAndUploadSnapshot(deviceConfig, jobId) {
  console.log(`[SNAPSHOT] Capturing from ${deviceConfig.ip}...`);

  try {
    // Use port 4000 as tested by user
    const snapshotUrl = `http://127.0.0.1:4000/facial/${deviceConfig.id}/snapshot?channel=${deviceConfig.channel || 1}`;
    console.log(`[SNAPSHOT] Fetching ${snapshotUrl}`);

    const resp = await fetch(snapshotUrl);
    if (!resp.ok) {
      throw new Error(`Fetch failed: ${resp.status}`);
    }

    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase
    const filename = `${deviceConfig.id}/${jobId}_${Date.now()}.jpg`;
    const bucket = "access-snapshots";

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filename, buffer, {
        contentType: "image/jpeg",
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filename);

    console.log(`[SNAPSHOT] Uploaded: ${publicUrl}`);
    return publicUrl;
  } catch (err) {
    console.error(`[SNAPSHOT] Error: ${err.message}`);
    return null;
  }
}

// ========================
// GATEWAY LOGIC
// ========================
// ========================
// REPLACEMENT: LOCAL RPC IMPLEMENTATION
// ========================
const crypto = require("crypto");

function md5Upper(s) {
  return crypto.createHash("md5").update(s).digest("hex").toUpperCase();
}

function calculateHash(user, pass, realm, random) {
  const passHash = md5Upper(`${user}:${realm}:${pass}`);
  return md5Upper(`${user}:${random}:${passHash}`);
}

async function rpc2Login({ ip, user, pass, timeoutMs = 15000 }) {
  const url = `http://${ip}/RPC2_Login`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Step 1: Challenge
    const step1Payload = {
      method: "global.login",
      params: { userName: user, password: "", clientType: "Web3.0" },
      id: 1
    };

    const resp1 = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(step1Payload),
      signal: controller.signal
    });

    // Note: Intelbras sometimes returns 401 on first step? No, RPC2 usually returns 200 with result.
    // But fetch doesn't throw on 401.
    const data1 = await resp1.json();

    const params = data1?.params;
    const session1 = data1?.session;

    if (!params?.realm || !params?.random || !session1) {
      console.warn("[RPC] Login Step 1 failed or unexpected response:", JSON.stringify(data1));
      // If fallback to Basic Auth or already logged in? Unlikely for RPC2_Login.
      // Some firmwares might not support RPC2_Login.
      throw new Error("RPC2_Login challenge failed");
    }

    // Step 2: Hashed Login
    const step2Payload = {
      method: "global.login",
      params: {
        userName: user,
        password: calculateHash(user, pass, params.realm, params.random),
        clientType: "Web3.0",
        authorityType: params.encryption || "Default"
      },
      session: session1,
      id: 2
    };

    const resp2 = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(step2Payload),
      signal: controller.signal
    });

    const data2 = await resp2.json();
    clearTimeout(t);

    if (data2?.session) {
      return data2.session;
    }

    throw new Error("RPC2_Login step 2 failed: " + JSON.stringify(data2));

  } catch (err) {
    clearTimeout(t);
    throw err;
  }
}

async function rpc2Call({ ip, session, method, params, id = 1000, timeoutMs = 15000 }) {
  const url = `http://${ip}/RPC2`;
  const payload = { method, params, session, id };

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const data = await resp.json();
    clearTimeout(t);
    return data;
  } catch (err) {
    clearTimeout(t);
    throw err;
  }
}

// Map Job Type to RPC Method & Params
function mapJobToRpc(job) {
  const p = job.payload || {};

  switch (job.type) {
    case "create_user":
      // AccessUser.insertMulti
      // Payload has: userID, userName, password, authority, cardNo (optional)
      const userObj = {
        UserID: String(p.userID),
        UserName: String(p.userName),
        Password: String(p.password || "123456"),
        Authority: Number(p.authority || 2),
        UserType: 0, // Normal
        UserStatus: 0,
        Doors: [0], // All doors
        TimeSections: [255], // All time
        ValidFrom: "1970-01-01 00:00:00",
        ValidTo: "2037-12-31 23:59:59"
      };
      if (p.cardNo) userObj.CardNo = String(p.cardNo);

      return {
        method: "AccessUser.insertMulti",
        params: { UserList: [userObj] }
      };

    case "update_user":
      // AccessUser.updateMulti logic: fetch first? 
      // For simplicity, we just send updateMulti with what we have. 
      // Intelbras usually merges or overwrites provided fields.
      const updateObj = {
        UserID: String(p.userID),
        UserName: String(p.userName)
      };
      // Only add password if provided and not empty
      if (p.password) updateObj.Password = String(p.password);

      return {
        method: "AccessUser.updateMulti",
        params: { UserList: [updateObj] }
      };

    case "delete_user":
      return {
        method: "AccessUser.removeMulti",
        params: { UserIDList: [String(p.userID)] }
      };

    case "add_card":
      return {
        method: "AccessCard.insertMulti",
        params: { CardList: [{ UserID: String(p.userID), CardNo: String(p.cardNo) }] }
      };

    case "delete_card":
      return {
        method: "AccessCard.removeMulti",
        params: { CardNoList: [String(p.cardNo)] }
      };

    // upload_face_base64 is handled separately due to complexity? 
    // No, we can do it here too!
    case "upload_face_base64":
      // Need to strip header?
      let b64 = p.photoData || "";
      b64 = b64.replace(/^data:image\/\w+;base64,/, "");
      return {
        method: "AccessFace.insertMulti",
        params: { FaceList: [{ UserID: String(p.userID), PhotoData: [b64] }] }
      };

    default:
      return null;
  }
}

async function executeDirectRpc(job, device) {
  const rpc = mapJobToRpc(job);
  if (!rpc) throw new Error("Unsupported RPC Job Type: " + job.type);

  console.log(`[RPC] Login to ${device.ip}...`);
  // Use DB credentials or fallback
  let user = device.username;
  let pass = device.password;

  if (!user || !pass) {
    const { data: secrets } = await supabase
      .from("facial_secrets")
      .select("username, password")
      .eq("facial_id", device.id)
      .maybeSingle();
    user = secrets?.username || "admin";
    pass = secrets?.password || "g274050nf."; // Fallback
  }

  const session = await rpc2Login({ ip: device.ip, user, pass, timeoutMs: 10000 });
  console.log(`[RPC] Session: ${session.substring(0, 8)}...`);

  console.log(`[RPC] Call ${rpc.method} on ${device.ip}`);
  const result = await rpc2Call({
    ip: device.ip,
    session,
    method: rpc.method,
    params: rpc.params,
    timeoutMs: FACE_HTTP_TIMEOUT_MS
  });

  if (result.result === true) {
    return { ok: true, data: result };
  } else {
    // Check for specific errors
    // Intelbras/Dahua Error Codes mapping
    const errCode = result?.error?.code;
    const errDetails = result?.error?.details || "";

    let readableError = "RPC_RETURN_FALSE";

    if (errCode === 286064926 || errCode === 0x110C465E) {
      readableError = "FACE_NOT_DETECTED_OR_QUALITY_LOW";
    } else if (errCode === 268632336 || errCode === 0x10031110) {
      readableError = "OPERATION_FAILED_GENERIC";
    } else if (result?.error) {
      readableError = typeof result.error === 'object' ? JSON.stringify(result.error) : String(result.error);
    }

    console.error(`[RPC] Failed: ${JSON.stringify(result)}`);
    return {
      ok: false,
      error: readableError,
      raw: result
    };
  }
}

// Replaces callGateway
async function processJobAction(job) {
  const action = job.type;
  const payload = job.payload || {};
  let baseUrl = GATEWAY_BASE_URL;

  console.log(`[DEBUG] Processing Job ${job.id}: Type=${action}, FacialID=${job.facial_id}, PayloadDeviceID=${payload.device_id}, PayloadFacialID=${payload.facial_id}`);

  // 1. ISOLATION CHECK
  if (action === "open_door" && !payload.facial_id && !job.facial_id) {
    if (!job.facial_id) {
      throw new Error("SECURITY_BLOCK: open_door requires facial_id. Broadcasts are forbidden.");
    }
  }

  // 2. Resolve Device
  const facialId = job.facial_id || payload.facial_id || payload.device_id;
  let deviceConfig = null;

  if (facialId) {
    const { data } = await supabase.from("facials").select("*").eq("id", facialId).single();
    deviceConfig = data;
  }

  if (action === "open_door" && !deviceConfig) {
    throw new Error(`SECURITY_BLOCK: Facial not found for ID: ${facialId}`);
  }

  // 3. Execute
  // DIRECT RPC HANDLERS
  if (["create_user", "update_user", "delete_user", "add_card", "delete_card", "upload_face_base64"].includes(action)) {
    if (!deviceConfig || !deviceConfig.ip) throw new Error("Device IP missing for RPC");
    try {
      return await executeDirectRpc(job, deviceConfig);
    } catch (e) {
      console.error(`[RPC ERROR]`, e); // Log full error object
      throw e;
    }
  }

  // GATEWAY HANDLERS (Fallback or Specific)
  switch (action) {
    case "open_door":
      // ... Keep existing Open Door Logic with snapshot ...
      let snapshotUrl = null;
      try {
        snapshotUrl = await captureAndUploadSnapshot(deviceConfig, job.id);
      } catch (e) {
        console.warn("[SNAPSHOT] Failed:", e.message);
      }

      // Use CGI for Open Door (Local Curl or Gateway?)
      // We can use Gateway if it works, or port CGI curl logic.
      // Gateway code for open door is simple curl.
      // Let's use Gateway to avoid reimplementing CGI curl right now (since user focused on 'create user'), 
      // AND gateway open_door might be working fine (it's using CGI, not RPC).
      // Wait, user provided Door.service.js which uses `cfg.FACIAL_IP` unless `target` is passed.
      // agent.js sends `target`.
      // Ensure Gateway accepts target. User provided code showed Door.service.js DOES accept target.

      // Fetch secrets for Open Door (CGI requires them)
      let doorUser = deviceConfig.username;
      let doorPass = deviceConfig.password;

      if (!doorUser || !doorPass) {
        const { data: secrets } = await supabase
          .from("facial_secrets")
          .select("username, password")
          .eq("facial_id", facialId)
          .maybeSingle();
        doorUser = secrets?.username || "admin";
        doorPass = secrets?.password || "admin";
      }

      const payloadWithTarget = {
        ...payload,
        target: {
          ip: deviceConfig.ip,
          channel: deviceConfig.channel || 1,
          user: doorUser,
          pass: doorPass
        }
      };

      // We rely on Gateway for Open Door for now to minimize change radius
      const res = await httpJson(`${baseUrl}/facial/door/open`, payloadWithTarget);

      if (res.ok) {
        if (snapshotUrl) res.snapshot_url = snapshotUrl;

        supabase.from("access_events").insert({
          site_id: SITE_ID,
          facial_id: facialId,
          event_type: "open_door_remote",
          source: "agent",
          occurred_at: nowIso(),
          meta: { job_id: job.id, success: true, snapshot_url: snapshotUrl }
        }).select().single().then(async ({ data: event, error }) => {
          if (!error && snapshotUrl) {
            await supabase.from("event_media").insert({
              event_id: event.id,
              storage_path: snapshotUrl,
              public_url: snapshotUrl
            });
          }
        });
      }
      return res;

    default:
      return { ok: false, error: `UNKNOWN_ACTION:${action}` };
  }
}

// ========================
// SNAPSHOT PROXY SERVER (Digest/CGI)
// ========================
const http = require("http");
const { spawn } = require("child_process");
const PROXY_PORT = process.env.PROXY_PORT || 4001;

// Helper: Run curl for Digest Auth
function runCurlDigestBuffer({ url, user, pass, timeoutMs = 5000 }) {
  return new Promise((resolve) => {
    const args = [
      "-sS",
      "--digest",
      "-u",
      `${user}:${pass}`,
      "--max-time",
      String(Math.ceil(timeoutMs / 1000)),
      url,
    ];

    const child = spawn("curl", args);
    const chunks = [];
    let stderr = "";

    child.stdout.on("data", (d) => chunks.push(d));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        code,
        buffer: Buffer.concat(chunks),
        stderr,
      });
    });

    child.on("error", (err) => {
      resolve({ ok: false, code: -1, buffer: null, stderr: err.message });
    });
  });
}

async function startSnapshotProxy() {
  const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== "GET") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    const match = req.url.match(/^\/facial\/([^\/]+)\/snapshot/);
    if (!match) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found" }));
      return;
    }

    const deviceId = match[1];

    // Parse query params for channel
    const urlObj = new URL(req.url, `http://localhost:${PROXY_PORT}`);
    const channelQuery = urlObj.searchParams.get("channel") || "1";

    console.log(`[PROXY] Requesting snapshot for ${deviceId} (Channel: ${channelQuery})`);

    try {
      // 1. Get Device Info
      const { data: device, error: deviceError } = await supabase
        .from("facials")
        .select("ip, port, channel")
        .eq("id", deviceId)
        .single();

      if (deviceError || !device) {
        console.error("[PROXY] Device DB Error:", deviceError);
        throw new Error("Device not found");
      }

      if (!device.ip) {
        throw new Error("Device has no IP");
      }

      // 2. Get Secrets
      const { data: secrets } = await supabase
        .from("facial_secrets")
        .select("username, password")
        .eq("facial_id", deviceId)
        .maybeSingle();

      const username = secrets?.username || "admin";
      // Fallback to the known password from user env if not in DB
      const password = secrets?.password || "g274050nf.";

      // 3. Construct Device URL (Intelbras/Dahua CGI)
      const channel = channelQuery;
      // Intelbras snapshot URL: http://<ip>/cgi-bin/snapshot.cgi?channel=1
      const snapshotUrl = `http://${device.ip}:${device.port || 80}/cgi-bin/snapshot.cgi?channel=${channel}`;

      console.log(`[PROXY] Fetching via Curl (Digest): ${snapshotUrl}`);

      // 4. Fetch with Curl (Digest)
      const result = await runCurlDigestBuffer({
        url: snapshotUrl,
        user: username,
        pass: password,
        timeoutMs: 8000
      });

      if (!result.ok) {
        console.warn(`[PROXY] Curl Failed (code ${result.code}): ${result.stderr}`);
        throw new Error(`Curl failed: ${result.stderr}`);
      }

      // 5. Pipe Response
      // Check if it looks like a JPEG (starts with FF D8)
      if (result.buffer && result.buffer.length > 2 && result.buffer[0] === 0xFF && result.buffer[1] === 0xD8) {
        res.writeHead(200, {
          "Content-Type": "image/jpeg",
          "Content-Length": result.buffer.byteLength
        });
        res.end(result.buffer);
      } else {
        console.warn("[PROXY] Invalid JPEG data received");
        // Try to send what we got, might be text error
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end(result.buffer);
      }

    } catch (err) {
      console.error(`[PROXY] Error: ${err.message}`);
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  server.on("error", (err) => {
    console.error(`[PROXY ERROR] Failed to start server on port ${PROXY_PORT}:`, err);
  });

  console.log(`[PROXY] Attempting to listen on port ${PROXY_PORT}...`);
  server.listen(PROXY_PORT, () => {
    console.log(`📸 Snapshot Proxy listening on port ${PROXY_PORT} (Digest/CGI)`);
  });
}

// ========================
// MAIN
// ========================
async function main() {
  requireEnv("SUPABASE_URL");
  requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  requireEnv("SITE_ID");
  requireEnv("AGENT_ID");

  console.log("====================================");
  console.log("🤖 FACIAL AGENT ENTERPRISE v2.5");
  console.log("Status: Heartbeat & Isolation Active");
  console.log("System: Segware-Like Event Logging");
  console.log("====================================");

  startSnapshotProxy();
  heartbeatLoop();

  while (true) {
    try {
      const pending = await findPendingJob();
      if (!pending) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      const job = await lockJob(pending.id);
      if (!job) {
        await sleep(250);
        continue;
      }

      console.log(`[JOB] Locked ${job.id} (${job.type})`);
      let result = null;
      try {
        result = await processJobAction(job);

        if (result?.ok === true) {
          await completeJob(job.id, result);
          console.log(`[JOB] Success ${job.id}`);
        } else {
          // Pass the full result (including raw device error) to failOrRetryJob
          const msg = result?.error || "GATEWAY_FAILED";
          console.warn(`[JOB] Failed ${job.id}: ${msg}`);
          await failOrRetryJob(job, msg, result);
        }
      } catch (err) {
        console.error(`[JOB] Error: ${err.message}`, err.stack);
        // If we have a partial result (e.g. from a throw inside processJobAction?), use it
        await failOrRetryJob(job, err.message, result);
      }

    } catch (err) {
      console.error("[AGENT ERROR]", err.message);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

main();
