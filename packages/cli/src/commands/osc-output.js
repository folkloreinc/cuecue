import { Command } from 'commander';
import { OscOutput } from '@cuecue/osc';

const command = new Command('osc-output');

command
    .arguments('<command> [commandArgs...]')
    .option('--host <port>', 'The host of the osc server', process.env.OSC_HOST || 'localhost')
    .option('-p, --port <port>', 'The port of the osc server', process.env.OSC_PORT || 8081)
    .action((commandName, commandArgs) => {
        const { host, port } = command.opts();
        const output = new OscOutput({ host, port });

        output.onStart();

        console.log(commandName, commandArgs); //eslint-disable-line

        output.send(commandName, ...commandArgs, (err) => {
            if (err) console.error(err);
            output.close();
        });
    });

    export default command;
