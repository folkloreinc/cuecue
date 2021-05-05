import dotenv from 'dotenv';

import Application from '../packages/app/src/Application';
import OscInput from '../packages/osc/src/OscInput';
import OscOutput from '../packages/osc/src/OscOutput';
import PubNubOutput from '../packages/pubnub/src/PubNubOutput';
import PubNubInput from '../packages/pubnub/src/PubNubInput';

import HttpInput from '../packages/http/src/HttpInput';
import createApi from '../packages/http/src/createApi';

import definition from './duration.json';

dotenv.config();

const app = new Application(definition);

const httpInput = new HttpInput();
httpInput.setRouter(createApi(app, httpInput));

app.input(new OscInput());
app.output(
    new OscOutput({
        port: 53000,
        host: '127.0.0.1',
        transformCommand: (command, args) => {
            if (command === 'interact') {
                return {
                    command: `/cue/${args[0]}/start`,
                    args: [],
                };
            }
            return null;
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
