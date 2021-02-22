import dotenv from 'dotenv';
import program from 'commander';
import { OscOutput } from '@cuecue/osc';

dotenv.config({});

let oscCommand;
let oscCommandArgs;

program
    .arguments('<command> [commandArgs...]')
    .option('--host <port>', 'The host of the osc server', process.env.OSC_HOST || 'localhost')
    .option('-p, --port <port>', 'The port of the osc server', process.env.OSC_PORT || 8081)
    .action((command, commandArgs) => {
        oscCommand = command;
        oscCommandArgs = commandArgs;
    });

program.parse(process.argv);

const output = new OscOutput({ host: program.host, port: program.port });

output.onStart();

console.log(oscCommand, oscCommandArgs); //eslint-disable-line

output.send(oscCommand, ...oscCommandArgs, (err) => {
    if (err) console.error(err);
    output.close();
});
