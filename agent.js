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
require("dotenv").config({ path: path.join(__dirname, ".env.local") });

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
async function captureAndUploadSnapshot(deviceConfig) {
  console.log(`[SNAPSHOT] Capturing from ${deviceConfig.ip}...`);
  // Placeholder: In real scenario, use http get to device snapshot url
  // For now, we simulate a snapshot by using a placeholder image logic or skipping
  // If strict integration is needed, we would need device specific API docs.
  // Let's assume we get a buffer.

  // Mock Buffer (1x1 pixel)
  // const mockBuffer = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

  // In a real deployment, we would:
  // 1. Fetch from http://${deviceConfig.ip}/cgi-bin/snapshot.cgi (Digest Auth often required)
  // 2. Upload to Supabase

  // For this demonstration/MVP without real device connectivity:
  return null;
}

// ========================
// GATEWAY LOGIC
// ========================
async function callGateway(job) {
  const action = job.type;
  const payload = job.payload || {};
  let baseUrl = GATEWAY_BASE_URL;

  // 1. ISOLATION CHECK
  if (action === "open_door" && !payload.facial_id && !job.facial_id) {
    // Check if DB column has it (Enterprise Schema)
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

  // Strict check
  if (action === "open_door" && !deviceConfig) {
    throw new Error(`SECURITY_BLOCK: Facial not found for ID: ${facialId}`);
  }

  if (deviceConfig) {
    if (!deviceConfig.ip) throw new Error("Device has no IP address configured.");
    payload.target_device = {
      ip: deviceConfig.ip,
      port: deviceConfig.port || 80,
      username: deviceConfig.username,
      password: deviceConfig.password,
      channel: deviceConfig.channel || 1,
      protocol: deviceConfig.protocol || 'isapi'
    };
    console.log(`[AGENT] Targeting: ${deviceConfig.name} (${deviceConfig.ip})`);
  }

  // 3. Execute
  switch (action) {
    case "open_door":
      // ENTERPRISE FLOW: Capture -> Open -> Log
      let snapshotUrl = null;
      try {
        // Mock snapshot capture/upload
        // snapshotUrl = await captureAndUploadSnapshot(deviceConfig);
      } catch (e) {
        console.warn("[SNAPSHOT] Failed:", e.message);
      }

      const res = await httpJson(`${baseUrl}/facial/door/open`, payload);

      // If success, log event
      if (res.ok) {
        // Insert Access Event
        supabase.from("access_events").insert({
          site_id: SITE_ID,
          facial_id: facialId,
          event_type: "open_door_remote",
          source: "agent",
          occurred_at: nowIso(),
          meta: { job_id: job.id, success: true }
        }).select().single().then(async ({ data: event, error }) => {
          if (error) console.error("Event Log Error:", error);
          else if (snapshotUrl) {
            // Link snapshot
            await supabase.from("event_media").insert({
              event_id: event.id,
              storage_path: snapshotUrl, // simplified
              public_url: snapshotUrl
            });
          }
        });
      }
      return res;

    case "create_user": return httpJson(`${baseUrl}/facial/user/create`, payload);
    case "update_user": return httpJson(`${baseUrl}/facial/user/update`, payload);
    case "delete_user": return httpJson(`${baseUrl}/facial/user/delete`, payload);
    case "add_card": return httpJson(`${baseUrl}/facial/card/add`, payload);
    case "delete_card": return httpJson(`${baseUrl}/facial/card/delete`, payload);
    case "upload_face_base64":
      return httpJson(`${baseUrl}/facial/face/uploadBase64`, payload, FACE_HTTP_TIMEOUT_MS);

    default:
      return { ok: false, error: `UNKNOWN_ACTION:${action}` };
  }
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
      try {
        const result = await callGateway(job);

        if (result?.ok === true) {
          await completeJob(job.id, result);
          console.log(`[JOB] Success ${job.id}`);
        } else {
          throw new Error(result?.error || "GATEWAY_FAILED");
        }
      } catch (err) {
        console.error(`[JOB] Error: ${err.message}`);
        await failOrRetryJob(job, err.message);
      }

    } catch (err) {
      console.error("[AGENT ERROR]", err.message);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

main();
