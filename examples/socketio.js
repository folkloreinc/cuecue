// eslint-disable-next-line import/no-extraneous-dependencies
import dotenv from 'dotenv';

import Application from '../packages/app/src/Application';
// import OscInput from '../packages/osc/src/OscInput';
import SocketIOServerOutput from '../packages/socketio/src/ServerOutput';
import SocketIOServerInput from '../packages/socketio/src/ServerInput';

import HttpInput from '../packages/http/src/HttpInput';
import createApi from '../packages/http/src/createApi';

import definition from './def-passedate.json';

dotenv.config();

const app = new Application(definition);

const httpInput = new HttpInput({ port: 8888 });
httpInput.setRouter(createApi(app, httpInput));
app.input(httpInput);

app.input(
    new SocketIOServerInput({
        port: 5000,
        cors: {
            origin: ['https://passedate.dev.folklore.sh/', 'https://localhost:8080'],
            methods: ['GET', 'POST'],
        },
    }),
);
app.output(
    new SocketIOServerOutput({
        port: 5001,
        cors: {
            origin: ['https://passedate.dev.folklore.sh/', 'https://localhost:8080'],
            methods: ['GET', 'POST'],
        },
    }),
);

// const server = new Server();
// server.use('/api', router);
// server.start();

app.start();
