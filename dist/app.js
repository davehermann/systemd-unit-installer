#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Node Modules
const fs_1 = require("fs");
const path = require("path");
// NPM Modules
const multi_level_logger_1 = require("multi-level-logger");
const installService_1 = require("./installService");
const removeService_1 = require("./removeService");
async function displayHelp() {
    const helpContents = await fs_1.promises.readFile(path.join(__dirname, `help`), { encoding: `utf8` });
    const helpText = helpContents
        .replace(/\{\{CURRENT_DIRECTORY\}\}/g, process.cwd());
    return helpText;
}
function getAdditionalParameters(args) {
    const argList = {};
    while (args.length > 0) {
        const nextArg = args.shift();
        switch (nextArg.toLowerCase()) {
            case `--account`:
                {
                    const accountName = args.shift();
                    if (!accountName)
                        throw new Error(`--account: a value is required`);
                    argList.userAccountName = accountName;
                }
                break;
            case `--ev`:
                {
                    const environmentVariables = args.shift();
                    if (!environmentVariables)
                        throw new Error(`--ev: a comma-separated list is required`);
                    argList.environmentVariables = environmentVariables.split(`,`);
                }
                break;
            case `--existing`:
                {
                    const path = args.shift();
                    if (!path)
                        throw new Error(`--existing: path to file required`);
                    argList.existingServiceFile = path;
                }
                break;
            case `--instance`:
                {
                    const instanceIdentifier = args.shift();
                    if (!instanceIdentifier)
                        throw new Error(`--instance: requires a value for the identifier of the service instance`);
                    argList.instanceName = instanceIdentifier;
                }
                break;
            case `--name`:
                {
                    const serviceName = args.shift();
                    if (!serviceName)
                        throw new Error(`--name: requires a value for the name of the service`);
                    argList.serviceName = serviceName;
                }
                break;
            case `--no-start`:
                argList.doNotStartEnable = true;
                break;
            case `--path`:
                {
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
async function parseArguments() {
    // Copy the arguments
    const args = process.argv.filter(() => true);
    multi_level_logger_1.Trace({ args });
    // Drop the first two arguments (node executable and this file)
    args.shift();
    args.shift();
    if ((args.length == 0) || (args.indexOf(`--help`) >= 0)) {
        const help = await displayHelp();
        return { help };
    }
    else {
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
        multi_level_logger_1.Log(help, { configuration: { includeCodeLocation: false, includeTimestamp: false } });
    else if (installService)
        await installService_1.InstallService(argList);
    else if (installService === false)
        await removeService_1.RemoveService(argList);
}
if (require.main === module) {
    multi_level_logger_1.InitializeLogging(process.env.LOG_LEVEL || `info`);
    runLoop()
        .catch(err => {
        multi_level_logger_1.Err(`---EXCEPTION--- (Unexpected exit)`, { configuration: { includeTimestamp: false, includeCodeLocation: false } });
        multi_level_logger_1.Err(err, { configuration: { includeTimestamp: false, includeCodeLocation: false } });
        multi_level_logger_1.Log(`\nTry running with "--help" for more information\n`, { configuration: { includeTimestamp: false, includeCodeLocation: false } });
    });
}
