const DigestFetch = require("digest-fetch");
const { resolveTarget } = require("../utils/target.util");

function safePath(p) {
    if (!p || typeof p !== "string") return null;
    // Allow any absolute path, but prevent traversal
    if (!p.startsWith("/")) return null;
    if (p.includes("..")) return null;
    return p;
}

async function fetchEventPhoto(cfg, { deviceId, path, target }) {
    try {
        const safe = safePath(path);
        if (!safe) {
            return { ok: false, error: "VALIDATION_ERROR", message: "path inválido" };
        }

        // ✅ resolve IP/credenciais (prioriza target se vier, senão cfg padrão)
        const t = resolveTarget
            ? resolveTarget(cfg, { deviceId, target })
            : {
                ip: (target && target.ip) || cfg.FACIAL_IP,
                user: (target && target.user) || cfg.FACIAL_USER,
                pass: (target && target.pass) || cfg.FACIAL_PASS,
            };

        const url = `http://${t.ip}${safe}`;

        const client = new DigestFetch(t.user, t.pass, { algorithm: "MD5" });
        const resp = await client.fetch(url, {
            method: "GET",
            headers: { Connection: "close" },
        });

        if (!resp.ok) {
            const txt = await resp.text().catch(() => "");
            return {
                ok: false,
                error: "DEVICE_FETCH_ERROR",
                httpCode: resp.status,
                message: txt || "Falha ao baixar foto do device",
                url,
            };
        }

        const buf = Buffer.from(await resp.arrayBuffer());
        return { ok: true, jpeg: buf, url };
    } catch (e) {
        return { ok: false, error: "INTERNAL_ERROR", message: e?.message || String(e) };
    }
}

module.exports = { fetchEventPhoto };
