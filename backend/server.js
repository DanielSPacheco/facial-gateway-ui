const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });

const express = require("express");
const cors = require("cors");

const { getConfig } = require("./config/env");

// rotas (factory)
const snapshotRoutes = require("./routes/snapshot.routes");
const doorRoutes = require("./routes/door.routes"); // ✅ Restore door routes
const eventsRoutes = require("./routes/events.routes");
const auditRoutes = require("./routes/audit.routes");

function startServer() {
    const cfg = getConfig();

    const app = express();

    app.use(cors());
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true }));

    app.get("/health", (req, res) => {
        res.json({
            ok: true,
            service: "facial-gateway-intelbras",
            time: new Date().toISOString(),
        });
    });

    const bases = ["", "/facial"];

    for (const base of bases) {
        app.use(`${base}/door`, doorRoutes(cfg));
        app.use(base, snapshotRoutes(cfg)); // Mount at base for /:id/snapshot
        app.use(`${base}/events`, eventsRoutes(cfg));
        app.use(base, auditRoutes(cfg));
        // app.use(`${base}/card`, cardsRoutes(cfg));
    }

    app.use((req, res) => {
        res.status(404).json({
            ok: false,
            error: "ROUTE_NOT_FOUND",
            method: req.method,
            path: req.path,
        });
    });

    app.listen(cfg.PORT, () => {
        console.log("====================================");
        console.log("🚪 FACIAL GATEWAY STARTED");
        console.log("PORT:", cfg.PORT);
        console.log("FACIAL_IP:", cfg.FACIAL_IP);
        console.log("FACIAL_CHANNEL:", cfg.FACIAL_CHANNEL);
        console.log("TIMEOUT_MS:", cfg.TIMEOUT_MS);
        console.log("====================================");
    });

    return app;
}

if (require.main === module) {
    startServer();
}

module.exports = { startServer };
