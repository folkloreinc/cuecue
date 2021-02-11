import { Router } from 'express';
import HttpInput from './HttpInput';

const createApi = (app) => {
    const router = new Router();
    const input = new HttpInput();

    const sendNotFound = (res) => {
        res.status(404).json({
            success: false,
            error: 'not_found',
        });
    };

    const getUserId = (req) => req.header('X-User-Id') || null;

    router.get('/cues', async (req, res) => {
        const cues = await app.cues();
        res.json(cues);
    });

    router.get('/cues/:id', async (req, res) => {
        const cues = await app.cues();
        const cue = cues.find((it) => it.id === req.params.id) || null;
        if (cue === null) {
            sendNotFound(res);
            return;
        }
        res.json(cue);
    });

    router.post('/cues/:id/show', async (req, res) => {
        const cues = await app.cues();
        const cue = cues.find((it) => it.id === req.params.id) || null;
        if (cue === null) {
            sendNotFound(res);
            return;
        }

        try {
            await input.cue(cue.id);
            res.json({
                success: true,
            });
        } catch (e) {
            res.json({
                success: false,
            });
        }
    });

    router.post('/cues/:id/hide', async (req, res) => {
        const cues = await app.cues();
        const cue = cues.find((it) => it.id === req.params.id) || null;
        if (cue === null) {
            sendNotFound(res);
            return;
        }

        try {
            await input.wait();
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
        const cues = await app.cues();
        const cue = cues.find((it) => it.id === req.params.id) || null;
        if (cue === null) {
            sendNotFound(res);
            return;
        }
        const interactions = await app.getInteractionsByCue(cue.id);
        res.json(interactions);
    });

    router.post('/cues/:id/interactions', async (req, res) => {
        const cues = await app.cues();
        const cue = cues.find((it) => it.id === req.params.id) || null;
        if (cue === null) {
            sendNotFound(res);
            return;
        }

        try {
            const userId = getUserId(req);
            await input.interactOnCue(cue.id, req.body, userId);
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

    return { router, input };
};

export default createApi;
