import dotenv from 'dotenv';
import twilio from 'twilio';
import { v4 as uuid } from 'uuid';
import createDebug from 'debug';
import Fuse from 'fuse.js/dist/fuse.basic';

import Application from '../packages/app/src/Application';
import OscInput from '../packages/osc/src/OscInput';
import PubNubOutput from '../packages/pubnub/src/PubNubOutput';
import PubNubInput from '../packages/pubnub/src/PubNubInput';
import createApi from '../packages/http/src/createApi';
import definition from './def-lni.json';

import HttpInput from '../packages/http/src/HttpInput';

dotenv.config();
const debug = createDebug('cuecue:lni:example');

// process.on('unhandledRejection', (reason, p) => {
//     console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
//     // application specific logging, throwing an error, or other logic here
// });

const app = new Application(definition);
const httpInput = new HttpInput();
const router = httpInput.getRouter();

// Handle the text message case
router.post('/text', async (req, res) => {
    const twiml = new twilio.twiml.MessagingResponse();

    if (req.body) {
        const { Body: body = '', From: from = uuid() } = req.body || {};
        const { cue: cueId = 'my-cue', data = {} } = app.getSessionCue();
        const { answers = [] } = data || {};
        debug('answers %O', answers);

        const uniqueId = `${cueId || 'my-cue'}-${from}`;
        debug('HELL %s %s %s', uniqueId, body, from);

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
            await httpInput.interact({ body, from, cue: cueId, value }, uniqueId);
            const interactions = app
                .getInteractions()
                .filter(
                    ({ data: interData = {} }) =>
                        interData.cue === cueId && interData.value === value,
                );
            debug('Interactions %O', interactions);
            twiml.message(`Merci! ${label}: ${interactions.length} points`);
        } else {
            twiml.message('No match mon.');
        }
    } else {
        twiml.message('Goodbye');
    }

    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml.toString());
});

httpInput.setRouter(createApi(app, httpInput, router));

app.input(
    new OscInput({
        transformCommand: (command, args) => {
            console.log('command', command, 'args', args);
            if (command === 'cue' && args && (args[0] === 'question' || args[0] === 'vote')) {
                const [type = 'question', question = '', ...answers] = args || [];
                const allAnswers = [...answers];
                const labels = allAnswers.filter((ans, i) => i % 2 === 0 || i === 0);
                const values = allAnswers.filter((ans, i) => i % 2 !== 0 && i !== 0);
                console.log(allAnswers, labels, values);
                return {
                    command,
                    args: [
                        args[0],
                        {
                            type,
                            question,
                            answers: labels.map((label, index) => ({
                                label,
                                value: values[index] || label,
                            })),
                        },
                    ],
                };
            }
            return { command, args };
        },
    }),
);
app.input(httpInput);
app.input(new PubNubInput());
app.output(new PubNubOutput());

// const server = new Server();
// server.use('/api', router);
// server.start();

app.start();
