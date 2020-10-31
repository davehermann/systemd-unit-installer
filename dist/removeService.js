"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoveService = void 0;
// Node Modules
const fs_1 = require("fs");
// NPM Modules
const multi_level_logger_1 = require("multi-level-logger");
const process_spawner_1 = require("@davehermann/process-spawner");
const utilities_1 = require("./utilities");
/**
 * Stop the unit, and disable launch at boot
 * @param serviceFileName - Name of the service unit to stop/disable
 */
async function stopUnit(serviceFileName) {
    await process_spawner_1.SpawnProcess(`sudo systemctl stop ${serviceFileName}`);
    try {
        await process_spawner_1.SpawnProcess(`sudo systemctl disable ${serviceFileName}`);
    }
    catch (err) {
        // Ignore "systemctl disable" writing to stderr
        if (err.search(/^Removed/) != 0)
            throw err;
    }
    multi_level_logger_1.Log(`${serviceFileName} has been stopped, and disabled from launch at boot.`, { configuration: { includeCodeLocation: false } });
}
/**
 * Remove the symlink to the unit file
 * @param unitLink - Location of the symlink in systemd for the unit file
 */
async function unlinkUnit(unitLink) {
    // Make sure the link exists, in case disable has removed it
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
    multi_level_logger_1.Log(`The symlink to '${unitLink}' has been removed\n`, { configuration: { includeCodeLocation: false } });
}
/**
 * Stop, disable, and remove a service from Systemd
 */
async function removeService({ relativePathToApp, instanceName }) {
    multi_level_logger_1.Log(`Removing systemd unit`, { configuration: { includeCodeLocation: false, includeTimestamp: false } });
    // Check for Linux as this OS
    utilities_1.CheckForLinuxOs();
    // Check for systemd
    await utilities_1.CheckForSystemd();
    // Check for running as root/via sudo
    utilities_1.CheckRunningAsTheRootUser();
    // Get the service file name
    const { serviceFileNameWithInstance } = await utilities_1.FindServiceFile(relativePathToApp, instanceName);
    // Stop the unit, and disable launch at boot
    await stopUnit(serviceFileNameWithInstance);
    // Remove the symlink
    const unitLink = utilities_1.GetSymLinkForSystemd(serviceFileNameWithInstance);
    multi_level_logger_1.Dev({ unitLink });
    await unlinkUnit(unitLink);
}
exports.RemoveService = removeService;
