const express = require("express");
const { listEvents } = require("../services/events.service");
const { fetchEventPhoto } = require("../services/eventPhoto.service");

module.exports = (cfg) => {
    const router = express.Router();

    // GET /events/:deviceId?from=...&to=...&limit=...&offset=...
    router.get("/:deviceId", async (req, res) => {
        try {
            const { deviceId } = req.params;

            const r = await listEvents(cfg, {
                deviceId,
                from: req.query.from,
                to: req.query.to,
                limit: req.query.limit,
                offset: req.query.offset,
            });

            return res.status(r.ok ? 200 : 502).json(r);
        } catch (e) {
            return res.status(500).json({
                ok: false,
                error: "INTERNAL_ERROR",
                details: e?.message || String(e),
            });
        }
    });

    // ✅ GET /events/:deviceId/photo?path=/mnt/...jpg
    router.get("/:deviceId/photo", async (req, res) => {
        try {
            const { deviceId } = req.params;
            const path = req.query.url; // 'url' param mapped to 'path' argument

            const r = await fetchEventPhoto(cfg, { deviceId, path });

            if (!r.ok) {
                return res.status(502).json(r);
            }

            res.setHeader("Content-Type", "image/jpeg");
            res.setHeader("Cache-Control", "no-store");
            return res.status(200).send(r.jpeg);
        } catch (e) {
            return res.status(500).json({
                ok: false,
                error: "INTERNAL_ERROR",
                message: e?.message || "Erro inesperado",
            });
        }
    });

    return router;
};
