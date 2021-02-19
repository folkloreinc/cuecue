import dotenv from 'dotenv';

import Application from '../packages/app/src/Application';
import OscInput from '../packages/osc/src/OscInput';
import PubNubOutput from '../packages/pubnub/src/PubNubOutput';
import PubNubInput from '../packages/pubnub/src/PubNubInput';
import Server from '../packages/http/src/Server';
import createApi from '../packages/http/src/createApi';
import definition from './def-lni.json';

dotenv.config();

const app = new Application(definition);

const { router, input: inputApi } = createApi(app);

app.input(
    new OscInput({
        transformCommand: (command, args) => {
            console.log('args', args);
            if (command === 'cue' && args && args[0] === 'question') {
                const [type = 'question', question = '', ...answers] = args || [];
                const allAnswers = [...answers];
                const labels = allAnswers.filter((ans, i) => i % 2 === 0 || i === 0);
                const values = allAnswers.filter((ans, i) => i % 1 === 0 && i !== 0);
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
app.input(inputApi);
app.input(new PubNubInput());
app.output(new PubNubOutput());

const server = new Server();
server.use('/api', router);
server.start();

app.start();
