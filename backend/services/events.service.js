// services/events.service.js
const { rpc2Login, rpc2CallForm } = require("../clients/rpc2.client");
const { runCurlDigestBuffer } = require("../clients/cgi.client");

// Converte ISO (2026-01-14T00:00:00-03:00) ou epoch para epoch seconds
function parseEpochSeconds(v) {
    if (v === undefined || v === null || v === "") return null;

    // epoch seconds
    if (/^\d+$/.test(String(v))) return Number(v);

    // ISO date
    const d = new Date(String(v));
    if (Number.isNaN(d.getTime())) return null;

    return Math.floor(d.getTime() / 1000);
}

function mustInt(n, def, min, max) {
    const x = Number(n);
    if (!Number.isFinite(x)) return def;
    const xi = Math.floor(x);
    if (min !== undefined && xi < min) return min;
    if (max !== undefined && xi > max) return max;
    return xi;
}

async function getEvents(cfg, { deviceId, from, to, limit = 50, offset = 0 }) {
    const fromEpoch = parseEpochSeconds(from);
    const toEpoch = parseEpochSeconds(to);

    if (!fromEpoch || !toEpoch || fromEpoch >= toEpoch) {
        return {
            ok: false,
            error: "VALIDATION_ERROR",
            message: "from/to inválidos (use ISO ou epoch seconds)",
            example: {
                good1: `/facial/events/<deviceId>?from=1768359600&to=1768446000&limit=50`,
                good2: `/facial/events/<deviceId>?from=2026-01-14T00:00:00-03:00&to=2026-01-15T00:00:00-03:00&limit=50`,
            },
        };
    }

    limit = mustInt(limit, 50, 1, 200);
    offset = mustInt(offset, 0, 0, 5000);

    // device resolver
    const device = await cfg.resolveDevice(deviceId);
    if (!device?.ip) {
        return { ok: false, error: "DEVICE_NOT_FOUND", deviceId };
    }

    const session = await rpc2Login({
        ip: device.ip,
        user: device.user,
        pass: device.pass,
        timeoutMs: cfg.timeouts?.rpc2 ?? 15000,
    });

    // 1) cria o record finder
    const create = await rpc2CallForm({
        ip: device.ip,
        session,
        method: "RecordFinder.factory.create",
        params: { name: "AccessControlCardRec" },
        id: 73,
        timeoutMs: cfg.timeouts?.rpc2 ?? 15000,
    });

    const object = create?.result;
    if (!object) {
        return { ok: false, error: "FACTORY_CREATE_FAILED", raw: create };
    }

    // 2) startFind
    const start = await rpc2CallForm({
        ip: device.ip,
        session,
        method: "RecordFinder.startFind",
        params: {
            condition: {
                CreateTime: ["<>", fromEpoch, toEpoch],
                Orders: [{ Field: "CreateTime", Type: "Descent" }],
            },
        },
        id: 74,
        object,
        timeoutMs: cfg.timeouts?.rpc2 ?? 15000,
    });

    if (!start?.result) {
        try {
            await rpc2CallForm({ ip: device.ip, session, method: "RecordFinder.stopFind", params: null, id: 78, object });
        } catch { }
        return { ok: false, error: "START_FIND_FAILED", raw: start };
    }

    // 3) doFind COM PAGINAÇÃO
    const doFind = await rpc2CallForm({
        ip: device.ip,
        session,
        method: "RecordFinder.doFind",
        params: {
            count: limit,
            begin: offset,
        },
        id: 75,
        object,
        timeoutMs: cfg.timeouts?.rpc2 ?? 15000,
    });

    const records = doFind?.params?.records || [];
    const found = doFind?.params?.found ?? records.length;

    // 4) stopFind
    const stop = await rpc2CallForm({
        ip: device.ip,
        session,
        method: "RecordFinder.stopFind",
        params: null,
        id: 78,
        object,
        timeoutMs: cfg.timeouts?.rpc2 ?? 15000,
    });

    return {
        ok: true,
        session,
        object,
        fromEpoch,
        toEpoch,
        limit,
        offset,
        found,
        stop_ok: !!stop?.result,
        records,
    };
}

// ✅ Proxy fetch for images stored on device using RPC_Loadfile
async function getEventSnapshotProxy(cfg, { deviceId, url }) {
    if (!url) return { ok: false, error: "MISSING_URL" };

    const device = await cfg.resolveDevice(deviceId);
    if (!device?.ip) {
        return { ok: false, error: "DEVICE_NOT_FOUND", deviceId };
    }

    const session = await rpc2Login({
        ip: device.ip,
        user: device.user,
        pass: device.pass,
        timeoutMs: cfg.timeouts?.rpc2 ?? 15000,
    });

    // 1) Request magic download link
    const loadFile = await rpc2CallForm({
        ip: device.ip,
        session,
        method: "RPC_Loadfile",
        params: { Name: url },
        id: 99,
        timeoutMs: cfg.timeouts?.rpc2 ?? 15000,
    });

    if (!loadFile?.result || !loadFile?.params?.result) {
        console.error("RPC_Loadfile failed:", loadFile);
        return { ok: false, error: "LOAD_FILE_FAILED", raw: loadFile };
    }

    // Usually returns { result: true, url: "..." } in params
    // But sometimes params is the string URL directly? 
    // Intelbras/Dahua: params: { result: "http://127.0.0.1:80/..." } ?
    // Check structure. Standard is params: { result: <url> } or params: { url: <url> }
    // Let's assume params.result IS the url if it's a string, or params.url.
    let downloadPath = loadFile.params.result;

    // Safety check if result is bool
    if (typeof downloadPath !== "string") {
        downloadPath = loadFile.params.url;
    }

    if (!downloadPath) {
        return { ok: false, error: "NO_DOWNLOAD_URL", raw: loadFile };
    }

    // downloadPath might be absolute http URL with 127.0.0.1 or relative path
    // We need to fix the IP if it returns with localhost
    let fetchUrl = downloadPath;
    if (fetchUrl.includes("127.0.0.1")) {
        fetchUrl = fetchUrl.replace("127.0.0.1", device.ip);
    } else if (fetchUrl.startsWith("/")) {
        fetchUrl = `http://${device.ip}${fetchUrl}`;
    }

    // 2) Download actual content
    const r = await runCurlDigestBuffer({
        url: fetchUrl,
        user: device.user,
        pass: device.pass,
        timeoutMs: 15000,
    });

    if (!r.ok) {
        return { ok: false, error: "FETCH_ERROR", details: r.stderr };
    }

    return { ok: true, buffer: r.buffer, type: "image/jpeg" };
}

module.exports = {
    listEvents: getEvents,
    getEventSnapshotProxy
};
