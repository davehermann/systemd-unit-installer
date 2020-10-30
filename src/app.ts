#!/usr/bin/env node

// Node Modules
import { promises as fs } from "fs";
import * as path from "path";

// NPM Modules
import { InitializeLogging, Err, Trace, Log } from "multi-level-logger";
import { IArgumentData, IRecognizedParameters } from "./interfaces";
import { InstallService } from "./installService";
import { RemoveService } from "./removeService";

async function displayHelp() {
    const helpContents = await fs.readFile(path.join(__dirname, `help`), { encoding: `utf8` });
    const helpText = helpContents
        .replace(/\{\{CURRENT_DIRECTORY\}\}/g, process.cwd());

    return helpText;
}

function getAdditionalParameters(args: Array<string>): IRecognizedParameters {
    const argList: IRecognizedParameters = {};

    while (args.length > 0) {
        const nextArg = args.shift();

        switch (nextArg.toLowerCase()) {
            case `--account`: {
                const accountName = args.shift();
                if (!accountName)
                    throw new Error(`--account: a value is required`);

                argList.userAccountName = accountName;
            }
                break;

            case `--ev`: {
                const environmentVariables = args.shift();
                if (!environmentVariables)
                    throw new Error(`--ev: a comma-separated list is required`);

                argList.environmentVariables = environmentVariables.split(`,`);
            }
                break;

            case `--existing`: {
                const path = args.shift();
                if (!path)
                    throw new Error(`--existing: path to file required`);

                argList.existingServiceFile = path;
            }
                break;

            case `--name`: {
                const serviceName = args.shift();
                if (!serviceName)
                    throw new Error(`--name: requires a value for the name of the service`);

                argList.serviceName = serviceName;
            }
                break;

            case `--no-start`:
                argList.doNotStartEnable = true;
                break;

            case `--path`: {
                const path = args.shift();
                if (!path)
                    throw new Error(`--path: relative path to application is required`);

                argList.relativePathToApp = path;
            }
                break;

            default:
                throw new Error(`"${nextArg}" is not a valid option`);
                // eslint-disable-next-line no-unreachable
                break;

        }
    }

    return argList;
}

async function parseArguments(): Promise<IArgumentData> {
    // Copy the arguments
    const args = process.argv.filter(() => true);

    Trace({ args });

    // Drop the first two arguments (node executable and this file)
    args.shift();
    args.shift();

    if ((args.length == 0) || (args.indexOf(`--help`) >= 0)) {
        const help = await displayHelp();

        return { help };
    } else {
        let installService = true;

        switch (args.shift()) {
            // Do nothing for install
            case `i`:
            case `install`:
                break;

            // Uninstall sets install to false
            case `u`:
            case `uninstall`:
                installService = false;
                break;

            // Any other parameter throws an exception
            default:
                throw new Error(`<action> is required, and must be i[nstall] or u[ninstall]`);
                // eslint-disable-next-line no-unreachable
                break;
        }

        const argList = getAdditionalParameters(args);

        return { installService, argList };
    }
}

async function runLoop() {
    const { help, installService, argList } = await parseArguments();

    if (!!help)
        Log(help, { configuration: { includeCodeLocation: false, includeTimestamp: false } });
    else if (installService)
        await InstallService(argList);
    else if (installService === false)
        await RemoveService(argList);
}

if (require.main === module) {
    InitializeLogging(process.env.LOG_LEVEL || `info`);

    runLoop()
        .catch(err => {
            Err(`---EXCEPTION--- (Unexpected exit)`, { configuration: { includeTimestamp: false, includeCodeLocation: false } });
            Err(err, { configuration: { includeTimestamp: false, includeCodeLocation: false } });
            Log(`\nTry running with "--help" for more information`, { configuration: { includeTimestamp: false, includeCodeLocation: false } });
        });
}
