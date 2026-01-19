const { spawn } = require("child_process");

function runCurlDigest({ url, user, pass, method = "GET", body = null, timeoutMs = 5000 }) {
    return new Promise((resolve) => {
        const args = [
            "-sS",
            "--digest",
            "-u",
            `${user}:${pass}`,
            "--max-time",
            String(Math.ceil(timeoutMs / 1000)),
            "-X",
            method,
            url,
        ];

        if (body) {
            args.push("-H", "Content-Type: application/json");
            args.push("-d", JSON.stringify(body));
        }

        const child = spawn("curl", args);
        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (d) => (stdout += d.toString()));
        child.stderr.on("data", (d) => (stderr += d.toString()));

        child.on("close", (code) => {
            if (code === 0) {
                try {
                    // Try to parse JSON if possible, else return text
                    const json = JSON.parse(stdout);
                    resolve({ ok: true, data: json, stdout });
                } catch {
                    resolve({ ok: true, data: stdout, stdout });
                }
            } else {
                resolve({ ok: false, error: stderr || "CURL_ERROR" });
            }
        });

        child.on("error", (err) => {
            resolve({ ok: false, error: err.message });
        });
    });
}

async function openDoor(cfg, { target }) {
    // target: { ip, channel, user, pass }
    // Intelbras Open Door CGI: /cgi-bin/accessControl.cgi?action=openDoor&channel=1&UserID=1&Type=Remote
    // Or RPC: AccessControl.openDoor (some models)
    // We use CGI as it's often more reliable for simple actions.

    const ip = target.ip || cfg.FACIAL_IP;
    const channel = target.channel || cfg.FACIAL_CHANNEL || 1;
    const user = target.user || cfg.FACIAL_USER || "admin";
    const pass = target.pass || cfg.FACIAL_PASS || "admin";

    const url = `http://${ip}/cgi-bin/accessControl.cgi?action=openDoor&channel=${channel}&UserID=1&Type=Remote`;

    const res = await runCurlDigest({
        url,
        user,
        pass,
        timeoutMs: cfg.TIMEOUT_MS || 5000
    });

    if (!res.ok) {
        return { ok: false, error: res.error };
    }

    // Check output content
    // SUCCESS: OK
    // ERROR: ERROR
    // Check output content
    // SUCCESS: OK
    // ERROR: ERROR
    if (typeof res.data === 'string') {
        if (res.data.includes('OK')) {
            return { ok: true, raw: res.data };
        }
        if (res.data.includes('Error') || res.data.includes('Invalid')) {
            return { ok: false, error: res.data.trim() };
        }
    }

    // If we're here, it might be unexpected content. Default to fail if not explicit OK?
    // Or be lenient? Given the "Invalid Authority" example, we should be stricter.
    return { ok: false, error: "UNKNOWN_RESPONSE: " + (typeof res.data === 'string' ? res.data : JSON.stringify(res.data)) };
}

module.exports = { openDoor };
