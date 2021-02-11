import dotenv from 'dotenv';

import Application from '../packages/app/src/Application';
import OscInput from '../packages/osc/src/OscInput';
import PubNubOutput from '../packages/pubnub/src/PubNubOutput';
import Server from '../packages/http/src/Server';
import createApi from '../packages/http/src/createApi';
import definition from './definition.json';

dotenv.config();

const app = new Application(definition);

const { router, input: inputApi } = createApi(app);

app.input(new OscInput());
app.input(inputApi);
app.output(new PubNubOutput());

const server = new Server();
server.use('/api', router);
server.start();

app.start();