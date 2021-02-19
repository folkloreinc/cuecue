import dotenv from 'dotenv';

import Application from '../packages/app/src/Application';
import OscInput from '../packages/osc/src/OscInput';
import PubNubOutput from '../packages/pubnub/src/PubNubOutput';
import PubNubInput from '../packages/pubnub/src/PubNubInput';
import definition from './definition.json';

dotenv.config();

const app = new Application(definition);

app.input(new OscInput());
app.input(
    new PubNubInput({
        transformCommand: (command, args) => {
            if (command === 'interact') {
                const { value, userId } = args || {};
                return { command, args: [value, userId] };
            }
            return { command, args };
        },
    }),
);
app.output(new PubNubOutput());

app.start();
