import dotenv from 'dotenv';
import { Command } from 'commander';

import oscOutput from './commands/osc-output';
import { version } from '../package.json';

dotenv.config({});

const program = new Command();

program.version(version).description('CLI to interact with cuecue').addCommand(oscOutput);

program.parse(process.argv);
