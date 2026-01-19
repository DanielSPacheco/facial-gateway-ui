const { runCurlDigestBuffer } = require("../clients/cgi.client");
const { resolveTarget } = require("../utils/target.util");

async function getSnapshotJpeg(cfg, bodyOrPayload = {}) {
    let tcfg = resolveTarget(cfg, bodyOrPayload);

    // ✅ If IP is missing or default, and we have deviceId, try to resolve from DB
    if ((!tcfg.FACIAL_IP || tcfg.FACIAL_IP === cfg.FACIAL_IP) && bodyOrPayload.deviceId && cfg.resolveDevice) {
        try {
            const dev = await cfg.resolveDevice(bodyOrPayload.deviceId);
            if (dev && dev.ip) {
                tcfg = {
                    ...tcfg,
                    FACIAL_IP: dev.ip,
                    FACIAL_USER: dev.user || tcfg.FACIAL_USER,
                    FACIAL_PASS: dev.pass || tcfg.FACIAL_PASS,
                };
            }
        } catch (e) {
            console.error("Failed to resolve device:", e);
        }
    }

    if (!tcfg.FACIAL_IP || !tcfg.FACIAL_USER || !tcfg.FACIAL_PASS) {
        return {
            ok: false,
            error: "CONFIG_ERROR",
            message: "Missing FACIAL_IP / FACIAL_USER / FACIAL_PASS",
        };
    }

    const ch = bodyOrPayload.channel || tcfg.FACIAL_CHANNEL || 1;
    // Intelbras snapshot URL
    const url = `http://${tcfg.FACIAL_IP}/cgi-bin/snapshot.cgi?channel=${encodeURIComponent(ch)}`;

    const r = await runCurlDigestBuffer({
        url,
        user: tcfg.FACIAL_USER,
        pass: tcfg.FACIAL_PASS,
        timeoutMs: tcfg.TIMEOUT_MS || 15000,
    });

    if (!r.ok) {
        return {
            ok: false,
            error: "FETCH_ERROR",
            message: "curl digest failed",
            details: { code: r.code, stderr: r.stderr, url: r.url },
        };
    }

    if (!r.buffer || r.buffer.length < 2 || r.buffer[0] !== 0xff || r.buffer[1] !== 0xd8) {
        return {
            ok: false,
            error: "INVALID_IMAGE",
            message: "Response is not a JPEG",
            details: {
                url,
                sample: r.buffer ? r.buffer.slice(0, 80).toString("utf8") : null,
                stderr: r.stderr,
            },
        };
    }

    return { ok: true, jpeg: r.buffer };
}

module.exports = { getSnapshotJpeg };
