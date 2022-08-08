// eslint-disable-next-line import/no-extraneous-dependencies
import dotenv from 'dotenv';

import Application from '../packages/app/src/Application';
// import OscInput from '../packages/osc/src/OscInput';
import SocketIOInput from '../packages/socketio/src/ClientInput';

import definition from './def-passedate.json';

dotenv.config();

const app = new Application(definition);

app.input(
    new SocketIOInput({
        host: 'http://localhost:5101',
        cors: {
            origin: [
                'https://passedate.dev.folklore.sh/',
                'http://localhost:8080',
                'http://localhost:5101',
            ],
            methods: ['GET', 'POST'],
        },
    }),
);

app.start();
