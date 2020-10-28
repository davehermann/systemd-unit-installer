#!/usr/bin/env node

// Node Modules
import { promises as fs } from "fs";
import * as path from "path";

// NPM Modules
import { InitializeLogging, Err, Trace, Log } from "multi-level-logger";

interface IArgumentData {
    help?: string;
}

async function parseArguments(): Promise<IArgumentData> {
    // Copy the arguments
    const args = process.argv.filter(() => true);

    Trace({ args });

    // Drop the first two arguments (node executable and this file)
    args.shift();
    args.shift();

    if (args.length == 0) {
        const helpText = (await fs.readFile(path.join(__dirname, `help`), { encoding: `utf8` }))
            .replace(/\{\{CURRENT_DIRECTORY\}\}/g, process.cwd());

        return { help: helpText };
    }
}

async function runLoop() {
    const { help } = await parseArguments();

    if (!!help)
        Log(help, { configuration: { includeCodeLocation: false, includeTimestamp: false } });
}

if (require.main === module) {
    InitializeLogging(process.env.LOG_LEVEL || `info`);

    runLoop()
        .catch(err => {
            Err(`---EXCEPTION--- (Unexpected exit)`);
            Err(err);
        });
}
