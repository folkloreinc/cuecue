import dotenv from 'dotenv';

import Application from '../packages/app/src/Application';
import { terminate } from '../packages/app/src/utils';
import OscInput from '../packages/osc/src/OscInput';
import PubNubOutput from '../packages/pubnub/src/PubNubOutput';
import definition from './def-lni.json';

dotenv.config();

// const debug = createDebug('cuecue:lni:example');

const app = new Application(definition);

app.input(
    new OscInput({
        transformCommand: (command, args) => {
            // Make command out of an array of osc params
            if (command === 'cue' && args && (args[0] === 'question' || args[0] === 'vote')) {
                const [type = 'question', question = '', ...answers] = args || [];
                const allAnswers = [...answers];
                const labels = allAnswers.filter((ans, i) => i % 2 === 0 || i === 0);
                const values = allAnswers.filter((ans, i) => i % 2 !== 0 && i !== 0);
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
