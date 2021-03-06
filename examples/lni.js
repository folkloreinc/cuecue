import dotenv from 'dotenv';
import twilio from 'twilio';
import { v4 as uuid } from 'uuid';
import createDebug from 'debug';
import Fuse from 'fuse.js/dist/fuse.basic';

import Application from '../packages/app/src/Application';
import { terminate } from '../packages/app/src/utils';
import PubNubOutput from '../packages/pubnub/src/PubNubOutput';
import PubNubInput from '../packages/pubnub/src/PubNubInput';
import createApi from '../packages/http/src/createApi';
import definition from './def-lni.json';

import HttpInput from '../packages/http/src/HttpInput';

dotenv.config();

const debug = createDebug('cuecue:lni:example');

const app = new Application(definition);
const httpInput = new HttpInput();
const router = httpInput.getRouter();

// Handle the text messages
router.post('/text', async (req, res) => {
    const twiml = new twilio.twiml.MessagingResponse();
    if (req.body) {
        const { Body: body = '', From: from = uuid() } = req.body || {};
        const { cue: cueId = 'cue-type', data = {} } = app.getSessionCue();
        const { answers = [], questionId = null } = data || {};

        // Remove uuid to make the replys one by phone number + fix front in case
        const uniqueId = `${questionId || 'my-question-id'}-${from}-${uuid()}`;

        debug('TEXT MESSAGE %s %s %s', body, from, uniqueId);

        if ((cueId === 'question' || cueId === 'vote') && answers !== null && answers.length > 0) {
            const fuse = new Fuse(answers, {
                includeScore: true,
                ignoreLocation: true,
                threshold: 0.2,
                keys: ['label', 'value'],
            });
            const results = fuse.search(body || '');
            const item = results.length > 0 ? results[0].item : null;
            const { value, label } = item || {};
            if (value) {
                await httpInput.interact({ body, from, questionId, value }, uniqueId);
                const interactions = app
                    .getInteractions()
                    .filter(
                        ({ data: interactionData = {} }) =>
                            interactionData.questionId === questionId &&
                            interactionData.value === value,
                    );
                // debug('Interactions %O', interactions);
                twiml.message(`Merci! ${label}: ${interactions.length} points`);
            } else {
                twiml.message('Nous n’avons pas pu interpréter ce message, veuillez réessayer.');
            }
        } else {
            twiml.message('Le vote est fermé.');
        }
    } else {
        twiml.message('Veuillez envoyer un message.');
    }

    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml.toString());
});

httpInput.setRouter(createApi(app, httpInput, router));
app.input(httpInput);
app.input(new PubNubInput());
app.output(new PubNubOutput());

const exitHandler = terminate(null, {
    coredump: false,
    timeout: 500,
});

process.on('uncaughtException', exitHandler(1, 'Unexpected Error'));
process.on('unhandledRejection', exitHandler(1, 'Unhandled Promise'));
process.on('SIGTERM', exitHandler(0, 'SIGTERM'));
process.on('SIGINT', exitHandler(0, 'SIGINT'));

app.start();
