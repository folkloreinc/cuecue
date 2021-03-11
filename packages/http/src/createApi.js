import { Router } from 'express';

const createApi = (app, input, externalRouter = null) => {
    const router = externalRouter === null ? new Router() : externalRouter;

    const sendNotFound = (res) => {
        res.status(404).json({
            success: false,
            error: 'not_found',
        });
    };

    const getUserId = (req) => req.header('X-User-Id') || null;

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

    return router;
};

export default createApi;
