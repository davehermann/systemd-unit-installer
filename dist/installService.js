"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstallService = void 0;
// Node Modules
const fs_1 = require("fs");
const path = require("path");
// NPM Modules
const multi_level_logger_1 = require("multi-level-logger");
const fs_utilities_1 = require("@davehermann/fs-utilities");
const process_spawner_1 = require("@davehermann/process-spawner");
const userPrompt_1 = require("./userPrompt");
const utilities_1 = require("./utilities");
const UNIT_TEMPLATE = path.join(__dirname, `systemd-service-template`);
/**
 * Get user-input name for the service if one is not already defined
 * @param serviceName - An existing service name
 */
async function nameService(serviceName) {
    let prompt = `Name of service`;
    if (!!serviceName) {
        multi_level_logger_1.Log(`${prompt}: ${serviceName}`, { configuration: { includeTimestamp: false, includeCodeLocation: false } });
        return serviceName;
    }
    // Get the name for the service
    const inputName = await userPrompt_1.ReadUserInput(prompt);
    return inputName;
}
/**
 * Ask for the username for a user account that can run the service, and confirm it exists
 * @param enteredName - The account name to search for
 * @param foundAccount - An account found on the system in the next recursion
 */
async function getServiceAccountName(enteredName, foundAccount) {
    if (!!foundAccount)
        return foundAccount;
    // If no matching account was found, repeat the process
    if (foundAccount === null)
        multi_level_logger_1.Err(`An account with the username "${enteredName}" was not found.\n`);
    // Get the name for an account on the system
    let prompt = `Provide a system account name to run the service`, accountName;
    if ((foundAccount === undefined) && !!enteredName) {
        multi_level_logger_1.Log(`${prompt}: ${enteredName}`, { configuration: { includeTimestamp: false, includeCodeLocation: false } });
        accountName = enteredName;
    }
    else
        accountName = await userPrompt_1.ReadUserInput(prompt);
    // Check the accounts on the system for an existing user
    let systemUsersData = await fs_1.promises.readFile(path.join(path.sep, `etc`, `passwd`), { encoding: `utf8` });
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
async function pathToService(relativePathToApp) {
    let prompt = `Path to service main JS`;
    if (!!relativePathToApp) {
        multi_level_logger_1.Log(`${prompt}: ${relativePathToApp}`, { configuration: { includeTimestamp: false, includeCodeLocation: false } });
    }
    else
        // Get the relative path from the application root to the service
        relativePathToApp = await userPrompt_1.ReadUserInput(prompt);
    // Confirm the file exists
    let absolutePath = path.join(process.cwd(), relativePathToApp);
    await fs_1.promises.stat(absolutePath);
    return `.${path.sep}${path.relative(process.cwd(), absolutePath)}`;
}
/**
 * Get environment variables from user input
 * @param variables - existing variables array
 */
async function addEnvironmentVariables(variables) {
    const ev = await userPrompt_1.ReadUserInput(`Add Environment Variable (NAME=val) [blank line when done]`);
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
async function loadTemplate({ serviceName, userAccountName, environmentVariables, relativePathToApp }) {
    const template = await fs_1.promises.readFile(UNIT_TEMPLATE, { encoding: `utf8` });
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
async function writeServiceFile(serviceUnit, serviceFileName) {
    let filePath = path.join(process.cwd(), serviceFileName);
    await fs_utilities_1.EnsurePathForFile(filePath);
    await fs_1.promises.writeFile(filePath, serviceUnit, { encoding: `utf8` });
    multi_level_logger_1.Log(`A unit file has been generated at "${filePath}"`, { configuration: { includeCodeLocation: false } });
    return filePath;
}
/**
 * Add a symbolic link in Systemd for the service unit
 * @param unitLink - Path to symlink
 * @param generatedServicePath - Path to the generated service unit file
 */
async function linkUnit(unitLink, generatedServicePath) {
    // Check for an existing linkUnit, and remove if found
    let linkExists = true;
    try {
        await fs_1.promises.stat(unitLink);
    }
    catch (err) {
        if (err.code == `ENOENT`)
            linkExists = false;
        else
            throw err;
    }
    if (linkExists)
        await process_spawner_1.SpawnProcess(`sudo rm ${unitLink}`);
    await process_spawner_1.SpawnProcess(`sudo ln -s "${generatedServicePath}" "${unitLink}"`);
    multi_level_logger_1.Log(`The unit file has been symlinked to '${unitLink}'\n`, { configuration: { includeCodeLocation: false } });
}
/**
 * Start/Enable the service unit
 * @param serviceName - Name of the service
 * @param serviceFileName - Service unit file
 * @param doNotStartEnable - Flag to skip start/enable
 */
async function startUnit(serviceName, serviceFileName, doNotStartEnable) {
    if (doNotStartEnable) {
        multi_level_logger_1.Log(`${serviceName} service has been configured as a service; however, the systemd unit has not had start or enable run.\n\nPlease start/enable when you are ready to use.`, { configuration: { includeCodeLocation: false, includeTimestamp: false } });
    }
    else {
        try {
            await process_spawner_1.SpawnProcess(`sudo systemctl enable ${serviceFileName}`);
        }
        catch (err) {
            // Ignore "systemctl enable" writing to stderr
            if (err.search(/^Created symlink/) != 0)
                throw err;
        }
        await process_spawner_1.SpawnProcess(`sudo systemctl start ${serviceFileName}`);
        multi_level_logger_1.Log(`${serviceName} service has been started, and enabled to launch at boot.`, { configuration: { includeCodeLocation: false } });
    }
}
/** Add service to Systemd, and - optionally - enable and start */
async function installService({ existingServiceFile, serviceName, userAccountName, relativePathToApp, environmentVariables, doNotStartEnable } = {}) {
    multi_level_logger_1.Log(`Installing as a systemd unit`, { configuration: { includeTimestamp: false, includeCodeLocation: false } });
    // Check for Linux as this OS
    utilities_1.CheckForLinuxOs();
    // Check for systemd
    await utilities_1.CheckForSystemd();
    // Check for running as root/via sudo
    utilities_1.CheckRunningAsTheRootUser();
    let generatedServicePath, serviceFileName;
    if (!!existingServiceFile) {
        const { absolutePath, serviceShortName } = await utilities_1.FindServiceFile(existingServiceFile);
        generatedServicePath = absolutePath;
        serviceFileName = `${serviceShortName}.service`;
    }
    else {
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
        generatedServicePath = await writeServiceFile(serviceUnit, serviceFileName);
    }
    let unitLink = utilities_1.GetSymLinkForSystemd(serviceFileName);
    await linkUnit(unitLink, generatedServicePath);
    // Start/Enable the unit
    await startUnit(serviceName, serviceFileName, doNotStartEnable);
}
exports.InstallService = installService;
