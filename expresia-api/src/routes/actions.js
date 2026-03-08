// routes/actions.js
// Single POST /content_api endpoint. Dispatches by body.action.
// Auth-gated actions require Authorization: Bearer <token> header.

const express = require("express");
const router = express.Router();
const actions = require("../actions");

// Actions that require a valid instance token in the Authorization header
const AUTH_REQUIRED = new Set([
    "logout", "postData", "putData", "getData", "deleteData",
    "getCurrentPage", "checkAuth", "checkCustomerPrivilege",
    "uploadFile",
]);

router.post("/", async (req, res, next) => {
    const body = req.body ?? {};
    const { action } = body;

    if (!action) {
        return res.status(400).json({ error: "Missing action" });
    }

    // Extract bearer token from Authorization header
    const authHeader = req.headers.authorization ?? "";
    const instanceToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    // Enforce auth on gated actions
    if (AUTH_REQUIRED.has(action) && !instanceToken) {
        return res.status(401).json({ error: "Authorization required" });
    }

    try {
        let result;

        switch (action) {
            case "login":
                result = await actions.login(body);
                break;
            case "logout":
                result = await actions.logout(instanceToken);
                break;
            case "resetPassword":
                result = await actions.resetPassword(body);
                break;
            case "setPassword":
                result = await actions.setPassword(body);
                break;
            case "checkAuth":
                result = await actions.checkAuth(instanceToken);
                break;
            case "checkCustomerPrivilege":
                result = await actions.checkCustomerPrivilege(instanceToken);
                break;

            case "getSitemap":
                result = await actions.getSitemap(instanceToken);
                break;
            case "getPlaylists":
                result = await actions.getPlaylists(body, instanceToken);
                break;
            case "getPlaylist":
                result = await actions.getPlaylist(body, instanceToken);
                break;
            case "getAIPlaylists":
                result = await actions.getAIPlaylists(instanceToken);
                break;
            case "getPlaylistsMetaData":
                result = await actions.getPlaylistsMetaData(instanceToken);
                break;
            case "updatePlaylistData":
                result = await actions.updatePlaylistData(body, instanceToken);
                break;
            case "updateSortOrder":
                result = await actions.updateSortOrder(body, instanceToken);
                break;

            case "getCurrentPage":
                result = await actions.getCurrentPage(body, instanceToken);
                break;
            case "getJsonDocument":
                result = await actions.getJsonDocument(body, instanceToken);
                break;

            case "getImages":
                result = await actions.getImages(body, instanceToken);
                break;
            case "uploadFile":
                result = await actions.uploadFile(body, instanceToken);
                break;

            case "getEditCodeURL":
                result = await actions.getEditCodeURL(body, instanceToken);
                break;
            case "showIntro":
                result = await actions.showIntro();
                break;
            case "getProducer":
                result = await actions.getProducer();
                break;

            // Generic CRUD pass-throughs
            case "postData":
                result = await actions.genericCrud("POST", body, instanceToken);
                break;
            case "putData":
                result = await actions.genericCrud("PUT", body, instanceToken);
                break;
            case "getData":
                result = await actions.genericCrud("GET", body, instanceToken);
                break;
            case "deleteData":
                result = await actions.genericCrud("DELETE", body, instanceToken);
                break;

            default:
                return res.status(400).json({ error: `Unknown action: ${action}` });
        }

        res.json(result);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
