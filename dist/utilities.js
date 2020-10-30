"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetSymLinkForSystemd = exports.FindServiceFile = exports.CheckForSystemd = exports.CheckRunningAsTheRootUser = exports.CheckForLinuxOs = void 0;
// Node Modules
const fs_1 = require("fs");
const path = require("path");
// NPM Modules
const multi_level_logger_1 = require("multi-level-logger");
/** Check for Linux as the OS powering this system */
function checkForLinuxOs() {
    if (process.platform != `linux`) {
        multi_level_logger_1.Err(`This can only be installed on Linux. Platform: ${process.platform}`);
        throw new Error(`Linux not detected as the OS`);
    }
}
exports.CheckForLinuxOs = checkForLinuxOs;
/** Ensure Systemd is the init system running */
async function checkSystemd() {
    let linkPath = await fs_1.promises.readlink(path.join(path.sep, `sbin`, `init`));
    let isSystemd = linkPath.search(/systemd/) >= 0;
    if (!isSystemd) {
        multi_level_logger_1.Err(`This module can only be used to install a systemd unit`);
        throw new Error(`Systemd not detected`);
    }
}
exports.CheckForSystemd = checkSystemd;
/** Check for running as the root user, and disallow */
function checkRunningAsRoot() {
    if (process.getuid() === 0) {
        multi_level_logger_1.Err(`'install' and 'uninstall' should not be run via the root account, or elevated priviledges.\nYou will be asked for your 'sudo' password when needed.`);
        throw new Error(`Not running via root/sudo`);
    }
}
exports.CheckRunningAsTheRootUser = checkRunningAsRoot;
/**
 * Get the absolute path to the service file
 *
 * @param relativePathToApp - relative path to the location of the service file
 *
 * @returns Both the absolute path, and the service name as listed in the file
 */
async function findService(relativePathToApp) {
    // If a path has been specified, use that file
    // If not, try to locate a .service file in the current directory
    if (!relativePathToApp) {
        let files = await fs_1.promises.readdir(process.cwd());
        relativePathToApp = files.find(f => { return f.search(/\.service$/) > 0; });
    }
    // Confirm the service file exists, and read it
    multi_level_logger_1.Debug({ relativePathToApp });
    let absolutePath = path.join(process.cwd(), relativePathToApp);
    multi_level_logger_1.Trace(absolutePath);
    let serviceUnit = await fs_1.promises.readFile(absolutePath, { encoding: `utf8` });
    multi_level_logger_1.Dev(serviceUnit);
    // Parse the file to get the service name
    let lines = serviceUnit.split(`\n`);
    multi_level_logger_1.Dev(lines);
    let id = lines.find(l => { return l.search(/^SyslogIdentifier/) == 0; });
    let serviceShortName = id.split(`=`)[1];
    multi_level_logger_1.Trace({ id, serviceShortName });
    return { absolutePath, serviceShortName };
}
exports.FindServiceFile = findService;
/**
 * Get the symbolic link for the unit file in /etc/systemd/system
 * @param serviceFileName - Name of the service unit
 */
function getUnitSymlink(serviceFileName) {
    return `${path.sep}${path.join(`etc`, `systemd`, `system`, serviceFileName)}`;
}
exports.GetSymLinkForSystemd = getUnitSymlink;
