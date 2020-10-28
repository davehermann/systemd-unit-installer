// Node Modules
import { promises as fs } from "fs";

// NPM Modules
import { Log, Trace } from "multi-level-logger";
import { SpawnProcess } from "@davehermann/process-spawner";

// Application Modules
import { IRecognizedParameters } from "./interfaces";
import { CheckForLinuxOs, CheckForSystemd, CheckRunningAsTheRootUser, FindServiceFile, GetSymLinkForSystemd } from "./utilities";

/**
 * Stop the unit, and disable launch at boot
 * @param serviceFileName - Name of the service unit to stop/disable
 */
async function stopUnit(serviceFileName: string) {
    await SpawnProcess(`sudo systemctl stop ${serviceFileName}`);
    try {
        await SpawnProcess(`sudo systemctl disable ${serviceFileName}`);
    } catch (err) {
        // Ignore "systemctl disable" writing to stderr
        if (err.search(/^Removed/) != 0)
            throw err;
    }
    Log(`\n${serviceFileName} has been stopped, and disabled from launch at boot.`);
}

/**
 * Remove the symlink to the unit file
 * @param unitLink - Location of the symlink in systemd for the unit file
 */
async function unlinkUnit(unitLink: string) {
    // Make sure the link exists, in case disable has removed it
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

    Log(`\nThe symlink to '${unitLink}' has been removed\n`);
}

/**
 * Stop, disable, and remove a service from Systemd
 */
async function removeService({ relativePathToApp }: IRecognizedParameters) {
    Log(`Removing systemd unit`);

    // Check for Linux as this OS
    CheckForLinuxOs();
    // Check for systemd
    await CheckForSystemd();
    // Check for running as root/via sudo
    CheckRunningAsTheRootUser();

    // Get the service file name
    const { serviceShortName } = await FindServiceFile(relativePathToApp);
    const serviceFileName = `${serviceShortName}.service`;
    Trace({ serviceShortName, serviceFileName });

    // Stop the unit, and disable launch at boot
    await stopUnit(serviceFileName);

    // Remove the symlink
    const unitLink = GetSymLinkForSystemd(serviceFileName);
    await unlinkUnit(unitLink);
}

export {
    removeService as RemoveService,
};
