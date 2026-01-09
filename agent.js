/**
 * Facial Agent - Job Processor
 *
 * Workflow:
 * 1) Poll for 1 'pending' job for the current SITE
 * 2) Lock the job by updating status to 'processing'
 * 3) Execute the job by calling the local gateway (mapped by job.type)
 * 4) Update job status to 'done' or 'failed'
 *    - On failure, if attempts remain: retry later (status -> 'pending', attempts++)
 *
 * Supported Actions:
 * - open_door
 * - create_user / user_create
 * - update_user / user_update
 * - delete_user / user_delete
 * - add_card / card_add
 * - delete_card / card_delete
 * - face_upload_base64 / upload_face_base64
 */

const path = require("path");
// function nowIso() { ... } // (This is moving the shim, so I need to be careful with replace)
// Actually, I will just move the shim block to line 23
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

// Status Enums (Must match DB constraints)
const JOB_STATUS_PENDING = process.env.JOB_STATUS_PENDING || "pending";
const JOB_STATUS_PROCESSING = process.env.JOB_STATUS_PROCESSING || "processing";
const JOB_STATUS_DONE = process.env.JOB_STATUS_DONE || "done";
const JOB_STATUS_FAILED = process.env.JOB_STATUS_FAILED || "failed";

// Timeouts
const DEFAULT_HTTP_TIMEOUT_MS = Number(process.env.DEFAULT_HTTP_TIMEOUT_MS || 30000);
const FACE_HTTP_TIMEOUT_MS = Number(process.env.FACE_HTTP_TIMEOUT_MS || 60000);

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
  console.warn("AGENT_ID not found, using default 'local-agent'");
  process.env.AGENT_ID = "local-agent";
}

// ========================
// SUPABASE CLIENT
// ========================
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ========================
// DB: FIND PENDING
// ========================
async function findPendingJob() {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("site_id", SITE_ID)
    .eq("status", JOB_STATUS_PENDING)
    // optional: scheduling support
    .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso()}`)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
}

// ========================
// DB: LOCK (atomic-ish)
// ========================
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
    .eq("status", JOB_STATUS_PENDING) // lock only if pending
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data || null; // null = race condition / locked by other
}

// ========================
// DB: COMPLETE
// ========================
async function completeJob(jobId, result) {
  const { error } = await supabase
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

  if (error) throw error;
}

// ========================
// DB: FAIL (com retry)
// ========================
async function failOrRetryJob(job, message, result = null) {
  const attempts = Number(job.attempts || 0);
  const maxAttempts = Number(job.max_attempts || 3);

  // If attempts remain: retry (reset to pending)
  if (attempts + 1 < maxAttempts) {
    const { error } = await supabase
      .from("jobs")
      .update({
        status: JOB_STATUS_PENDING,
        attempts: attempts + 1,
        error_message: message,
        result,
        locked_at: null,
        locked_by: null,
        updated_at: nowIso(),
      })
      .eq("id", job.id);

    if (error) throw error;
    return { retried: true, attempts: attempts + 1, maxAttempts };
  }

  // Else: mark as final failure
  const { error } = await supabase
    .from("jobs")
    .update({
      status: JOB_STATUS_FAILED,
      attempts: attempts + 1,
      error_message: message,
      result,
      executed_at: nowIso(),
      locked_at: null,
      locked_by: null,
      updated_at: nowIso(),
    })
    .eq("id", job.id);

  if (error) throw error;
  return { retried: false, attempts: attempts + 1, maxAttempts };
}

// ========================
// HTTP: JSON POST (with timeout + robust parsing)
// ========================
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

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { ok: false, error: "NON_JSON_RESPONSE", raw: text };
    }

    // If gateway doesn't return "ok", infer from HTTP status
    if (typeof parsed.ok === "undefined") parsed.ok = resp.ok;

    // If not ok, inject status for debug
    if (!parsed.ok) {
      parsed.http_status = resp.status;
    }

    return parsed;
  } catch (err) {
    return {
      ok: false,
      error: err?.name === "AbortError" ? "TIMEOUT" : (err?.message || "FETCH_ERROR"),
    };
  } finally {
    clearTimeout(t);
  }
}

// ========================
// GATEWAY CALL (job.type -> endpoint)
// ========================
// ========================
// DB: FETCH DEVICE CONFIG
// ========================
async function getDeviceConfig(deviceId, siteId) {
  // If deviceId provided, fetch specific
  if (deviceId) {
    const { data } = await supabase
      .from("facials")
      .select("*")
      .eq("id", deviceId)
      .single();
    return data;
  }
  // Fallback: Fetch the first active device for the site
  // useful for legacy jobs or single-device setups
  const { data } = await supabase
    .from("facials")
    .select("*")
    .eq("site_id", siteId)
    .limit(1);

  return data?.[0];
}

// ========================
// GATEWAY CALL (job.type -> endpoint)
// ========================
async function callGateway(job) {
  const action = job.type;
  const payload = job.payload || {};

  // Resolve Target Device
  // Job payload might contain `device_id` or we infer it
  const deviceConfig = await getDeviceConfig(payload.device_id, process.env.SITE_ID);

  // Default connection params (Environment or Database)
  let baseUrl = process.env.GATEWAY_BASE_URL || "http://127.0.0.1:3000";
  let authHeader = {};

  // Override if DB config exists
  if (deviceConfig) {
    // If we are targeting a specific DB device, we MUST have its IP.
    if (!deviceConfig.ip && !deviceConfig.url) {
      throw new Error(`Device '${deviceConfig.name}' (ID: ${deviceConfig.id}) has no IP or URL configured.`);
    }

    // modification: Pass `target_device` overrides in the payload to the gateway.
    payload.target_device = {
      ip: deviceConfig.ip, // STRICT: No fallback to env here
      port: deviceConfig.port || 80,
      username: deviceConfig.username, // Might be null if using secrets table but agent usually needs it passed or handled by gateway
      password: deviceConfig.password,
      channel: deviceConfig.channel || 1,
      protocol: deviceConfig.protocol || 'isapi'
    };

    // Log for debug (careful with passwords)
    console.log(`[AGENT] Routing to device: ${deviceConfig.name} (${payload.target_device.ip})`);
  } else {
    // Legacy/Fallback Mode
    console.log("[AGENT] No specific device found, using ENV defaults via Gateway");
  }

  switch (action) {
    // Operations
    case "open_door":
      return httpJson(`${baseUrl}/facial/door/open`, payload);

    // Users
    case "create_user":
    case "user_create":
      return httpJson(`${baseUrl}/facial/user/create`, payload);

    case "update_user":
    case "user_update":
      return httpJson(`${baseUrl}/facial/user/update`, payload);

    case "delete_user":
    case "user_delete":
      return httpJson(`${baseUrl}/facial/user/delete`, payload);

    // Cards
    case "add_card":
    case "card_add":
      return httpJson(`${baseUrl}/facial/card/add`, payload);

    case "delete_card":
    case "card_delete":
      return httpJson(`${baseUrl}/facial/card/delete`, payload);

    // Face
    case "face_upload_base64":
    case "upload_face_base64":
      return httpJson(
        `${baseUrl}/facial/face/uploadBase64`,
        payload,
        FACE_HTTP_TIMEOUT_MS
      );

    default:
      return { ok: false, error: `UNKNOWN_ACTION:${action}` };
  }
}

// ========================
// MAIN LOOP
// ========================
async function main() {
  requireEnv("SUPABASE_URL");
  requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  requireEnv("SITE_ID");
  requireEnv("AGENT_ID");

  console.log("====================================");
  console.log("🤖 FACIAL AGENT STARTED");
  console.log("SITE_ID :", SITE_ID);
  console.log("AGENT_ID:", AGENT_ID);
  console.log("GATEWAY :", GATEWAY_BASE_URL);
  console.log("POLL   :", POLL_INTERVAL_MS, "ms");
  console.log("TIMEOUT:", {
    defaultMs: DEFAULT_HTTP_TIMEOUT_MS,
    faceMs: FACE_HTTP_TIMEOUT_MS,
  });
  console.log("STATUS :", {
    pending: JOB_STATUS_PENDING,
    processing: JOB_STATUS_PROCESSING,
    done: JOB_STATUS_DONE,
    failed: JOB_STATUS_FAILED,
  });
  console.log("====================================");

  while (true) {
    try {
      const pending = await findPendingJob();

      if (!pending) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      const job = await lockJob(pending.id);
      if (!job) {
        // outro agente pegou, ou corrida
        await sleep(250);
        continue;
      }

      console.log(
        `[JOB] locked ${job.id} (${job.type}) attempts=${job.attempts || 0}/${job.max_attempts || 3}`
      );

      const result = await callGateway(job);

      if (result?.ok === true) {
        await completeJob(job.id, result);
        console.log(`[JOB] done   ${job.id}`);

        // UPDATE DEVICE STATUS (Alive)
        if (job.payload?.device_id) {
          await supabase
            .from("facials")
            .update({ last_seen_at: nowIso() })
            .eq("id", job.payload.device_id);
        }
      } else {
        const reason = result?.error || "GATEWAY_ERROR";
        const info = await failOrRetryJob(job, reason, result);
        if (info.retried) {
          console.warn(
            `[JOB] retry  ${job.id} -> pending (${info.attempts}/${info.maxAttempts}) reason=${reason}`
          );
        } else {
          console.error(
            `[JOB] failed ${job.id} (final) (${info.attempts}/${info.maxAttempts}) reason=${reason}`
          );
        }
      }
    } catch (err) {
      console.error("[AGENT ERROR]", err?.message || err);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

main();
