const express = require("express");
const { openDoor } = require("../services/door.service");

module.exports = (cfg) => {
    const router = express.Router();

    router.post("/open", async (req, res) => {
        try {
            // req.body should contain { target: { ip, ... } }
            const params = req.body;
            const result = await openDoor(cfg, params);

            // If result.ok is true, we return 200
            if (result.ok) {
                res.json({ ok: true, ...result });
            } else {
                res.status(502).json({ ok: false, ...result });
            }
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    return router;
};
