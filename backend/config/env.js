// Envs are loaded by entry point (server.js or agent.js)

function getConfig() {
    return {
        PORT: process.env.PORT || 4000, // Default to 4000 as per plan
        FACIAL_IP: process.env.FACIAL_IP || "192.168.1.100", // Example default
        FACIAL_CHANNEL: process.env.FACIAL_CHANNEL || 1,
        TIMEOUT_MS: Number(process.env.TIMEOUT_MS) || 15000,
        // Add resolveDevice if needed for dynamic device resolution similar to agent.js
        // For now, we'll assume the service might need to resolve IP from DB if not single-device mode
        // but the provided getEvents calls 'cfg.resolveDevice(deviceId)'.
        // We need to implement resolveDevice to fetch from Supabase if we want full parity with agent.js logic,
        // or just a mock if we only have one device in env.
        // Given the user context implies multiple devices/database, let's include Supabase client here if possible,
        // or keep it simple as a placeholder if the service handles it.
        // The user's code snippet for events.service says:
        // "const device = await cfg.resolveDevice(deviceId);"
        // So we MUST implement resolveDevice here.
    };
}

// We need a way to resolve devices.
// Since we are in the backend unrelated to the Next.js app directly (it's a separate process),
// we might need supabase-js here too.
const { createClient } = require("@supabase/supabase-js");

// Initialize Supabase if env vars exist
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Add resolveDevice to the config object returned
const extendedGetConfig = () => {
    const config = getConfig();
    config.resolveDevice = async (deviceId) => {
        // If we have supabase, try to fetch
        if (supabase) {
            const { data, error } = await supabase
                .from("facials")
                .select("*")
                .eq("id", deviceId)
                .single();

            if (data && !error) {
                // Fetch secrets if needed
                const { data: secrets } = await supabase
                    .from("facial_secrets")
                    .select("username, password")
                    .eq("facial_id", deviceId)
                    .maybeSingle();

                return {
                    ip: data.ip,
                    user: secrets?.username || "admin",
                    pass: secrets?.password || "admin"
                };
            }
        }

        // Fallback or mock if no DB
        return {
            ip: config.FACIAL_IP,
            user: "admin", // Default
            pass: "admin"  // Default
        };
    };
    return config;
};

module.exports = { getConfig: extendedGetConfig };
