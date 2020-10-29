// Node Modules
import { promises as fs } from "fs";
import * as path from "path";

// NPM Modules
import { Log, Trace, Err } from "multi-level-logger";
import { EnsurePathForFile } from "@davehermann/fs-utilities";
import { SpawnProcess } from "@davehermann/process-spawner";

// Application Modules
import { IRecognizedParameters } from "./interfaces";
import { ReadUserInput } from "./userPrompt";
import { CheckForLinuxOs, CheckForSystemd, CheckRunningAsTheRootUser, FindServiceFile, GetSymLinkForSystemd } from "./utilities";

const UNIT_TEMPLATE = path.join(__dirname, `systemd-service-template`);

/**
 * Get user-input name for the service if one is not already defined
 * @param serviceName - An existing service name
 */
async function nameService(serviceName: string): Promise<string> {
    let prompt = `Name of service`;
    if (!!serviceName) {
        Log(`${prompt}: ${serviceName}`, { configuration: { includeTimestamp: false, includeCodeLocation: false } });

        return serviceName;
    }

    // Get the name for the service
    const inputName = await ReadUserInput(prompt);
    return inputName;
}

/**
 * Ask for the username for a user account that can run the service, and confirm it exists
 * @param enteredName - The account name to search for
 * @param foundAccount - An account found on the system in the next recursion
 */
async function getServiceAccountName(enteredName: string, foundAccount?: string): Promise<string> {
    if (!!foundAccount)
        return foundAccount;

    // If no matching account was found, repeat the process
    if (foundAccount === null)
        Err(`An account with the username "${enteredName}" was not found.\n`);

    // Get the name for an account on the system
    let prompt = `Provide a system account name to run the service`,
        accountName;
    if ((foundAccount === undefined) && !!enteredName) {
        Log(`${prompt}: ${enteredName}`, { configuration: { includeTimestamp: false, includeCodeLocation: false } });
        accountName = enteredName;
    } else
        accountName = await ReadUserInput(prompt);

    // Check the accounts on the system for an existing user
    let systemUsersData = await fs.readFile(path.join(path.sep, `etc`, `passwd`), { encoding: `utf8` });
    let allFoundUserAccounts = systemUsersData
        .split(`\n`)
        .filter(u => { return u.length > 0; })
        .map(u => { return u.split(`:`)[0]; });
    let useAccount = (allFoundUserAccounts.indexOf(accountName) >= 0) ? accountName : null;

    return getServiceAccountName(accountName, useAccount);
}

/**
 * Get the path to the main JS file for the service
 * @param relativePathToApp - Already provided relative path to the application
 */
async function pathToService(relativePathToApp: string) {
    let prompt = `Path to service main JS`;
    if (!!relativePathToApp) {
        Log(`${prompt}: ${relativePathToApp}`, { configuration: { includeTimestamp: false, includeCodeLocation: false } });
    } else
        // Get the relative path from the application root to the service
        relativePathToApp = await ReadUserInput(prompt);

    // Confirm the file exists
    let absolutePath = path.join(process.cwd(), relativePathToApp);
    await fs.stat(absolutePath);

    return `.${path.sep}${path.relative(process.cwd(), absolutePath)}`;
}

/**
 * Get environment variables from user input
 * @param variables - existing variables array
 */
async function addEnvironmentVariables(variables?: Array<string>) {
    const ev = await ReadUserInput(`Add Environment Variable (NAME=val) [blank line when done]`);

    if (!variables)
        variables = [];

    if (ev.length == 0)
        return variables;

    variables.push(ev);

    return addEnvironmentVariables(variables);
}

/**
 * Load the template file, and replace the needed values within it
 * @param values - Replacement values for the template
 */
async function loadTemplate({ serviceName, userAccountName, environmentVariables, relativePathToApp }: IRecognizedParameters) {
    const template = await fs.readFile(UNIT_TEMPLATE, { encoding: `utf8` });

    const serviceShortName = serviceName.toLowerCase().replace(` `, `-`);

    let allEnvironmentVariables = environmentVariables.map(ev => { return `Environment="${ev}"`; }).join(`\n`);
    if (allEnvironmentVariables.length > 0)
        allEnvironmentVariables += `\n`;

    const serviceUnit = template
        .replace(/\{applicationPath\}/g, relativePathToApp)
        .replace(/\{serviceName\}/g, serviceName)
        .replace(/\{serviceShortName\}/g, serviceShortName)
        .replace(/\{username\}/g, userAccountName)
        .replace(/\{workingDirectory\}/g, process.cwd())
        .replace(/\{environmentVariables\}\n/g, allEnvironmentVariables);

    return { serviceUnit, serviceShortName };
}

/**
 * Write a service unit file to disk in the current working directory
 * @param serviceUnit - The complete unit file contents
 * @param serviceFileName - Name of the service unit file
 */
async function writeServiceFile(serviceUnit: string, serviceFileName: string) {
    let filePath = path.join(process.cwd(), serviceFileName);
    await EnsurePathForFile(filePath);

    await fs.writeFile(filePath, serviceUnit, { encoding: `utf8` });

    Log(`\nA unit file has been generated at "${filePath}"`);

    return filePath;
}

/**
 * Add a symbolic link in Systemd for the service unit
 * @param unitLink - Path to symlink
 * @param generatedServicePath - Path to the generated service unit file
 */
async function linkUnit(unitLink: string, generatedServicePath: string) {
    // Check for an existing linkUnit, and remove if found
    let linkExists = true;

    try {
        await fs.stat(unitLink);
    } catch (err) {
        if (err.code == `ENOENT`)
            linkExists = false;
        else
            throw err;
    }

    if (linkExists)
        await SpawnProcess(`sudo rm ${unitLink}`);

    await SpawnProcess(`sudo ln -s "${generatedServicePath}" "${unitLink}"`);

    Log(`\nThe unit file has been symlinked to '${unitLink}'\n`);
}

/**
 * Start/Enable the service unit
 * @param serviceName - Name of the service
 * @param serviceFileName - Service unit file
 * @param doNotStartEnable - Flag to skip start/enable
 */
async function startUnit(serviceName: string, serviceFileName: string, doNotStartEnable: boolean) {
    if (doNotStartEnable) {
        Log(`${serviceName} service has been configured as a service; however, the systemd unit has not had start or enable run.\n\nPlease start/enable when you are ready to use.`);
    } else {
        try {
            await SpawnProcess(`sudo systemctl enable ${serviceFileName}`);
        } catch (err) {
            // Ignore "systemctl enable" writing to stderr
            if (err.search(/^Created symlink/) != 0)
                throw err;
        }
        await SpawnProcess(`sudo systemctl start ${serviceFileName}`);
        Log(`\n${serviceName} service has been started, and enabled to launch at boot.`);
    }
}

/** Add service to Systemd, and - optionally - enable and start */
async function installService({ existingServiceFile, serviceName, userAccountName, relativePathToApp, environmentVariables, doNotStartEnable }: IRecognizedParameters = {}) {
    Log(`Installing as a systemd unit`);

    // Check for Linux as this OS
    CheckForLinuxOs();
    // Check for systemd
    await CheckForSystemd();
    // Check for running as root/via sudo
    CheckRunningAsTheRootUser();

    let generatedServicePath: string,
        serviceFileName: string;

    if (!!existingServiceFile) {
        const { absolutePath, serviceShortName } = await FindServiceFile(existingServiceFile);
        generatedServicePath = absolutePath;
        serviceFileName = `${serviceShortName}.service`;
    } else {
        // Get the name of the service
        serviceName = await nameService(serviceName);

        // Get a confirmed username to run the service
        userAccountName = await getServiceAccountName(userAccountName);

        // Get path to main JS
        relativePathToApp = await pathToService(relativePathToApp);

        // Get any environment variables
        if (!environmentVariables)
            environmentVariables = await addEnvironmentVariables();

        // Get the filled in template
        const { serviceUnit, serviceShortName } = await loadTemplate({ serviceName, userAccountName, environmentVariables, relativePathToApp });
        serviceFileName = `${serviceShortName}.service`;

        // Write to a local .service file
        generatedServicePath  = await writeServiceFile(serviceUnit, serviceFileName);
    }

    let unitLink = GetSymLinkForSystemd(serviceFileName);
    await linkUnit(unitLink, generatedServicePath);

    // Start/Enable the unit
    await startUnit(serviceName, serviceFileName, doNotStartEnable);
}

export {
    installService as InstallService,
};
