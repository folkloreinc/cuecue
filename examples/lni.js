import dotenv from 'dotenv';
import twilio from 'twilio';
import { v4 as uuid } from 'uuid';
import createDebug from 'debug';
import Fuse from 'fuse.js/dist/fuse.basic';

import Application from '../packages/app/src/Application';
import { terminate } from '../packages/app/src/utils';
import MysqlStore from '../packages/store-mysql/src/MysqlStore';

import PubNubOutput from '../packages/pubnub/src/PubNubOutput';
import PubNubInput from '../packages/pubnub/src/PubNubInput';
import createApi from '../packages/http/src/createApi';
import definition from './def-lni.json';

import HttpInput from '../packages/http/src/HttpInput';
import OscInput from '../packages/osc/src/OscInput';

dotenv.config();

const debug = createDebug('cuecue:lni:example');

const app = new Application(definition, { store: new MysqlStore() });
const httpInput = new HttpInput();
const router = httpInput.getRouter();

// Handle the text messages
router.post('/text', async (req, res) => {
    const twiml = new twilio.twiml.MessagingResponse();
    if (req.body) {
        const { Body: body = '', From: from = uuid() } = req.body || {};
        const cue = await app.getSessionCue();
        const { type, data = {} } = cue || {};
        const { answers = [], questionId = null } = data || {};

        // Remove uuid to make the replys one by phone number + fix front in case
        const uniqueId = `${questionId || 'my-question-id'}-${from}-${uuid()}`;

        debug('TEXT MESSAGE %s %s %s', body, from, uniqueId);

        if (type === 'logo') {
            twiml.message('Bienvenue à la LNI!');
        } else if (
            (type === 'question' || type === 'vote') &&
            answers !== null &&
            answers.length > 0
        ) {
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
                await app.interact({ body, from, questionId, value }, uniqueId);
                const interactions = await app.getInteractions();
                const filteredInteractions = interactions.filter(
                    ({ data: interactionData = {} }) =>
                        interactionData.questionId === questionId &&
                        interactionData.value === value,
                );

                // debug('Interactions %O', interactions);
                twiml.message(`Merci! ${label}: ${filteredInteractions.length} points`);
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
app.input(
    new OscInput({
        transformCommand: async (command, args) => {
            if (command === 'interact') {
                const cue = await app.getSessionCue();
                debug('sessionCue %O', cue);
                if (cue !== null) {
                    const { data = {} } = cue || {};
                    const { questionId = null } = data || {};
                    const [value = null] = args || [];
                    return {
                        command: 'interact',
                        args: [{ body: value, from: uuid(), questionId, value }, uuid()],
                    };
                }
                return null;
            }
            return { command, args };
        },
    }),
);
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
