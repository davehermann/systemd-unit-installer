#!/usr/bin/env node

// NPM Modules
const { InitializeLogging, OutputFormatting, Trace, Debug, Err, Log } = require(`multi-level-logger`),
    { InstallService, RemoveService } = require(`./installer`);

async function parseArguments() {
    let args = process.argv.filter(() => { return true; });

    Trace({ args });

    // Drop the first two arguments (node and this file)
    args.shift();
    args.shift();

    if (args.length == 0) {
        let help =
            `\nService Installer\n`
            + `-----------------\n`
            + `Usage: service <action> [options]\n`
            + `\n`
            + `--<Actions>--\n`
            + `    i[nstall]    - Create a systemd unit file, and install as a service\n`
            + `    u[ninstall]  - Stop and Uninstall the service\n`
            + `\n`
            + `--[Options]-- (Only impact install)\n`
            + `    --account <account name> - Name of system account to run the service\n`
            + `    --ev <variable-list>     - Comma-separated list of NAME=value pairs\n`
            + `    --name <NAME>            - The name for the service\n`
            + `    --no-start               - Create and install the unit file, but do not start/enable it\n`
            + `    --path                   - Path to application, from current directory (${process.cwd()})\n`
            ;

        return { help };
    } else {
        let action = { uninstall: false };

        // Set the install/uninstall action
        let actionText = args.shift();
        switch (actionText) {
            // Do nothing for install
            case `i`:
            case `install`:
                break;

            case `u`:
            case `uninstall`:
                action.uninstall = true;
                break;

            default:
                throw new Error(`<action> is required, and must be i | install | u | uninstall`);
                // eslint-disable-next-line no-unreachable
                break;
        }

        // Handle any additional parameters
        let argList = {};

        while (args.length > 0) {
            let nextArg = args.shift();
            switch (nextArg.toLowerCase()) {
                case `--account`: {
                    let accountName = args.shift();
                    if (!accountName)
                        throw new Error(`--account value required`);

                    argList.userAccountName = accountName;
                }
                    break;

                case `--ev`: {
                    let vars = args.shift();
                    if (!vars)
                        throw new Error(`--ev value required`);

                    argList.environmentVariables = vars.split(`,`);
                }
                    break;

                case `--name`: {
                    let serviceName = args.shift();
                    if (!serviceName)
                        throw new Error(`--name value required`);

                    argList.serviceName = serviceName;
                }
                    break;

                case `--no-start`:
                    argList.doNotStartEnable = true;
                    break;

                case `--path`: {
                    let path = args.shift();
                    if (!path)
                        throw new Error(`--path value required`);

                    argList.relativePathToApp = path;
                }
                    break;

                default:
                    throw new Error(`"${nextArg}" is not a valid option`);
                    // eslint-disable-next-line no-unreachable
                    break;
            }
        }

        return { action, argList };
    }
}

async function runLoop() {
    let { action, argList, help } = await parseArguments();
    Debug( { action, argList });

    if (!!action && !action.uninstall)
        await InstallService(argList);
    else if (!!action && action.uninstall)
        await RemoveService(argList);
    else {
        OutputFormatting(false);
        Log(help);
    }
}

InitializeLogging(process.env.LOG_LEVEL || `info`);

runLoop()
    .catch(err => {
        // Log the error data as-is
        Err(err, true);
    });

