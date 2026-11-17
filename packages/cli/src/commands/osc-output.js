import { Command } from 'commander';
import { Output as OscOutput } from '@cuecue/osc';

const command = new Command('osc-output');

command
    .description('Send an OSC message, such as cue/1/start')
    .arguments('<command> [commandArgs...]')
    .option('--host <host>', 'The host of the OSC server', process.env.OSC_HOST || 'localhost')
    .option('-p, --port <port>', 'The port of the OSC server', process.env.OSC_PORT || 8081)
    .action(async (commandName, commandArgs) => {
        const { host, port } = command.opts();
        const output = new OscOutput({ host, port: Number(port) });
        const path = commandName.replace(/^\/?/, '/');

        await output.init();
        try {
            await output.send(path, ...commandArgs);
            console.log(path, ...commandArgs);
        } catch (error) {
            console.error(`Sending ${path} failed: ${error.message}`);
            process.exitCode = 1;
        } finally {
            await output.destroy();
        }
    });

export default command;
