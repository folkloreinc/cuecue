import { Router } from 'express';
import { isArray } from 'lodash';
import { Parser, transforms } from 'json2csv';

const createApi = (app, input, externalRouter = null) => {
    const router = externalRouter === null ? new Router() : externalRouter;

    const sendNotFound = (res) => {
        res.status(404).json({
            success: false,
            error: 'not_found',
        });
    };

    const getUserId = (req) => req.header('X-User-Id') || null;

    const downloadCSV = (res, fileName, data) => {
        const json2csv = new Parser({ transforms: [transforms.flatten('.')] });
        const csv = json2csv.parse(data);
        res.header('Content-Type', 'text/csv');
        res.attachment(fileName);
        return res.send(csv);
    };

    router.get('/', async (req, res) => {
        res.json({ message: 'Welcome to CueCue' });
    });

    router.get('/cues', async (req, res) => {
        const cues = await app.getCues();
        res.json(cues);
    });

    router.get('/cues/current', async (req, res) => {
        const cue = await app.getSessionCue();
        res.json(cue);
    });

    router.post('/cues/define', async (req, res) => {
        const { body = null } = req || {};
        if (body === null) {
            sendNotFound(res);
            return;
        }
        try {
            await app.define(body);
            res.json({
                success: true,
            });
        } catch (e) {
            res.json({
                success: false,
            });
        }
    });

    router.get('/cues/:id', async (req, res) => {
        const cues = await app.getCues();
        const cue = cues.find((it) => it.id === req.params.id) || null;
        if (cue === null) {
            sendNotFound(res);
            return;
        }
        res.json(cue);
    });

    router.post('/cues/:id', async (req, res) => {
        const cues = await app.getCues();
        const cue = cues.find((it) => it.id === req.params.id) || null;
        if (cue === null) {
            sendNotFound(res);
            return;
        }

        try {
            await input.cue(cue.id, req.body || null);
            res.json({
                success: true,
            });
        } catch (e) {
            res.json({
                success: false,
            });
        }
    });

    router.get('/cues/:id/interactions', async (req, res) => {
        const cues = await app.getCues();
        const cue = cues.find((it) => it.id === req.params.id) || null;
        if (cue === null) {
            sendNotFound(res);
            return;
        }
        const interactions = await app.getInteractionsByCue(cue.id);
        res.json(interactions);
    });

    router.post('/uncue', async (req, res) => {
        try {
            await app.uncue();
            res.json({
                success: true,
            });
        } catch (e) {
            res.json({
                success: false,
            });
        }
    });

    router.get('/interactions', async (req, res) => {
        const userId = getUserId(req);
        const interactions =
            userId !== null ? await app.getInteractionsByUser(userId) : await app.getInteractions();
        res.json(interactions);
    });

    router.post('/interactions', async (req, res) => {
        try {
            const userId = getUserId(req);
            await input.interact(req.body, userId);
            res.json({
                success: true,
            });
        } catch (e) {
            res.json({
                success: false,
            });
        }
    });

    router.get('/session/current', async (req, res) => {
        const { session } = app;
        if (session === null) {
            sendNotFound(res);
            return;
        }
        res.json(session.id);
    });

    router.get('/session/:id', async (req, res) => {
        const { session } = app;
        // TODO: Find a session?
        if (session === null) {
            sendNotFound(res);
            return;
        }
        res.json(session);
    });

    router.get('/app/state', async (req, res) => {
        const { state } = app.state;
        if (state === null) {
            sendNotFound(res);
            return;
        }
        res.json(state);
    });

    router.get('/export/sessions.:format', async (req, res) => {
        const format = req.params.format || null;
        const items = await app.store.getItems('sessions', {}, true);
        if (items === null || !isArray(items)) {
            sendNotFound(res);
            return;
        }
        if (format === 'csv') {
            downloadCSV(res, 'sessions.csv', items);
            return;
        }
        res.json(items);
    });

    router.get('/export/interactions.:format', async (req, res) => {
        const format = req.params.format || null;
        const items = await app.store.getItems('interactions', {}, true);
        if (items === null || !isArray(items)) {
            sendNotFound(res);
            return;
        }
        if (format === 'csv') {
            downloadCSV(res, 'interactions.csv', items);
            return;
        }
        res.json(items);
    });

    router.get('/export/cues.:format', async (req, res) => {
        const format = req.params.format || null;
        const items = await app.store.getItems('cues', {}, true);
        if (items === null || !isArray(items)) {
            sendNotFound(res);
            return;
        }
        if (format === 'csv') {
            downloadCSV(res, 'cues.csv', items);
            return;
        }
        res.json(items);
    });

    return router;
};

export default createApi;
