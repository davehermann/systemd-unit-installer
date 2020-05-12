// Node Modules
const readline = require(`readline`),
    path = require(`path`);

// External Modules
const { fs, EnsurePathForFile } = require(`@davehermann/fs-utilities`),
    { SpawnProcess } = require(`@davehermann/process-spawner`),
    { OutputFormatting, Info, Warn, Err, Log } = require(`multi-level-logger`);

const UNIT_TEMPLATE = path.join(__dirname, `systemd-service-template`);

function checkForLinuxOs() {
    if (process.platform != `linux`) {
        Err(`This can only be installed on Linux. Platform: ${process.platform}`);
        throw new Error(`Linux not detected as the OS`);
    }
}

async function checkSystemd() {
    let linkPath = await fs.readlink(path.join(path.sep, `sbin`, `init`));
    let isSystemd = linkPath.search(/systemd/) >= 0;

    if (!isSystemd) {
        Err(`This module can only be used to install a systemd unit`);
        throw new Error(`Systemd not detected`);
    }
}

function checkRunningAsRoot() {
    if (process.getuid() === 0) {
        Err(`'install' and 'remove' should not be run via the root account, or elevated priviledges.\nYou will be asked for your 'sudo' password when needed.`);
        throw new Error(`Not running via root/sudo`);
    }
}

async function readUserInput(prompt, trim = true) {
    // Get the name for an account on the system
    let userInput = await new Promise(resolve => {
        let rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        rl.question(`${prompt}: `, (enteredText) => {
            rl.close();

            if (trim)
                enteredText = enteredText.trim();

            resolve(enteredText);
        });
    });

    return userInput;
}

async function getServiceAccountName(foundAccount, enteredName) {
    if (!!foundAccount)
        return foundAccount;

    // If no matching account was found, repeat the process
    if (foundAccount === null)
        Err(`An account with the username "${enteredName}" was not found.\n`);

    // Get the name for an account on the system
    let prompt = `Provide a system account name to run the service`,
        accountName;
    if ((foundAccount === undefined) && !!enteredName) {
        OutputFormatting(false);
        Log(`${prompt}: ${enteredName}`);
        OutputFormatting(true);
        accountName = enteredName;
    } else
        accountName = await readUserInput(prompt);

    // Check the accounts on the system for an existing user
    let systemUsersData = await fs.readFile(path.join(path.sep, `etc`, `passwd`), { encoding: `utf8` });
    let allFoundUserAccounts = systemUsersData
        .split(`\n`)
        .filter(u => { return u.length > 0; })
        .map(u => { return u.split(`:`)[0]; });
    let useAccount = (allFoundUserAccounts.indexOf(accountName) >= 0) ? accountName : null;

    return await getServiceAccountName(useAccount, accountName);
}

async function nameService(serviceName) {
    let prompt = `Name of service`;
    if (!!serviceName) {
        OutputFormatting(false);
        Log(`${prompt}: ${serviceName}`);
        OutputFormatting(true);

        return serviceName;
    }

    // Get the name for the service
    return await readUserInput(prompt);
}

async function pathToService(relativePathToApp) {
    let prompt = `Path to service main JS`;
    if (!!relativePathToApp) {
        OutputFormatting(false);
        Log(`${prompt}: ${relativePathToApp}`);
        OutputFormatting(true);
    } else
        // Get the relative path from the application root to the service
        relativePathToApp = await readUserInput(prompt);

    // Confirm the file exists
    let absolutePath = path.join(process.cwd(), relativePathToApp);
    await fs.stat(absolutePath);

    return `.${path.sep}${path.relative(process.cwd(), absolutePath)}`;
}

async function addEnvironmentVariables(variables) {
    let ev = await readUserInput(`Add Environment Variable (NAME=val) [blank line when done]`);

    if (!variables)
        variables = [];

    if (ev.length == 0)
        return variables;

    variables.push(ev);

    return addEnvironmentVariables(variables);
}

async function loadTemplate({ serviceName, userAccountName, environmentVariables, relativePathToApp }) {
    let template = await fs.readFile(UNIT_TEMPLATE, { encoding: `utf8` });

    let serviceShortName = serviceName.toLowerCase().replace(` `, `-`);

    let allEnvironmentVariables = environmentVariables.map(ev => { return `Environment="${ev}"`; }).join(`\n`);
    if (allEnvironmentVariables.length > 0)
        allEnvironmentVariables += `\n`;

    template = template
        .replace(/\{applicationPath\}/g, relativePathToApp)
        .replace(/\{serviceName\}/g, serviceName)
        .replace(/\{serviceShortName\}/g, serviceShortName)
        .replace(/\{username\}/g, userAccountName)
        .replace(/\{workingDirectory\}/g, process.cwd())
        .replace(/\{environmentVariables\}\n/g, allEnvironmentVariables);

    return { template, serviceShortName };
}

async function writeServiceFile({ serviceUnit, serviceShortName }) {
    let filePath = path.join(process.cwd(), `${serviceShortName}.service`);
    await EnsurePathForFile(filePath);

    await fs.writeFile(filePath, serviceUnit, { encoding: `utf8` });

    Log(`\nA unit file has been generated at "${filePath}"`);

    return filePath;
}

async function linkUnit({ unitLink, generatedServicePath }) {
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

async function installService({ serviceName, userAccountName, relativePathToApp, environmentVariables, doNotStartEnable } = {}) {
    Log(`Installing as a systemd unit`);

    // Check for Linux as the OS
    checkForLinuxOs();

    // Check for systemd
    await checkSystemd();

    // Check for running as root/via sudo
    checkRunningAsRoot();

    // Get the name of the service
    serviceName = await nameService(serviceName);

    // Ask for the username for a user account that can run the service, and confirm it exists
    userAccountName = await getServiceAccountName(undefined, userAccountName);

    // Ask for the path to the main JS file for the service
    relativePathToApp = await pathToService(relativePathToApp);

    // Get any environment variables
    if (!environmentVariables)
        environmentVariables = await addEnvironmentVariables();

    // Load the template file, and replace the username and the working directory in the template
    let { template: serviceUnit, serviceShortName } = await loadTemplate({ serviceName, userAccountName, environmentVariables, relativePathToApp });

    // Write to a local .service file
    let generatedServicePath  = await writeServiceFile({ serviceUnit, serviceShortName });

    let unitLink = `${path.sep}${path.join(`etc`, `systemd`, `system`, `${serviceShortName}.service`)}`;
    await linkUnit({ unitLink, generatedServicePath });
}

async function removeService() {
    Log(`Removing systemd unit`);

    // Check for Linux as the OS
    checkForLinuxOs();

    // Check for systemd
    await checkSystemd();

    // Check for running as root/via sudo
    checkRunningAsRoot();

}

module.exports.InstallService = installService;
module.exports.RemoveService = removeService;
