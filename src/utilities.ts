// Node Modules
import { promises as fs } from "fs";
import * as path from "path";

// NPM Modules
import { Err, Debug, Trace, Dev } from "multi-level-logger";
import { IExistingServiceFile } from "./interfaces";

/** Check for Linux as the OS powering this system */
function checkForLinuxOs() {
    if (process.platform != `linux`) {
        Err(`This can only be installed on Linux. Platform: ${process.platform}`);

        throw new Error(`Linux not detected as the OS`);
    }
}

/** Ensure Systemd is the init system running */
async function checkSystemd() {
    let linkPath = await fs.readlink(path.join(path.sep, `sbin`, `init`));
    let isSystemd = linkPath.search(/systemd/) >= 0;

    if (!isSystemd) {
        Err(`This module can only be used to install a systemd unit`);
        throw new Error(`Systemd not detected`);
    }
}

/** Check for running as the root user, and disallow */
function checkRunningAsRoot() {
    if (process.getuid() === 0) {
        Err(`'install' and 'uninstall' should not be run via the root account, or elevated priviledges.\nYou will be asked for your 'sudo' password when needed.`);
        throw new Error(`Not running via root/sudo`);
    }
}

/**
 * Get the absolute path to the service file
 *
 * @param relativePathToApp - relative path to the location of the service file
 * @param instanceName - Instance identifier
 *
 * @returns Both the absolute path, and the service name as listed in the file
 */
async function findService(relativePathToApp: string, instanceName: string): Promise<IExistingServiceFile> {
    // If a path has been specified, use that file
    // If not, try to locate a .service file in the current directory
    if (!relativePathToApp) {
        let files = await fs.readdir(process.cwd());

        relativePathToApp = files.find(f => { return f.search(/\.service$/) > 0; });
    }

    // Confirm the service file exists, and read it
    Debug({ relativePathToApp });

    let absolutePath = path.join(process.cwd(), relativePathToApp);
    Trace(absolutePath);
    let serviceUnit = await fs.readFile(absolutePath, { encoding: `utf8` });
    Dev(serviceUnit);

    // Parse the file to get the service name
    let lines = serviceUnit.split(`\n`);
    Dev(lines);
    let id = lines.find(l => { return l.search(/^SyslogIdentifier/) == 0; });
    let serviceShortName = id.split(`=`)[1];
    Trace({ id, serviceShortName });

    const serviceFileName = path.basename(absolutePath),
        serviceFileNameWithInstance = serviceFileName.replace(/\@/, `@${instanceName}`);
    Trace({ serviceFileName, serviceFileNameWithInstance });

    // If there's an @ at the end of the file name, and no instance name is specified, throw an exception
    if ((serviceFileName.search(/\@\.service$/) > 0) && !instanceName)
        throw new Error(`Service unit file "${serviceFileName}" is a template and requires an instance identifier.\nNo instance identifier specified`);

    return { absolutePath, serviceShortName, serviceFileName, serviceFileNameWithInstance };
}

/**
 * Get the symbolic link for the unit file in /etc/systemd/system
 * @param serviceFileName - Name of the service unit
 */
function getUnitSymlink(serviceFileName) {
    return `${path.sep}${path.join(`etc`, `systemd`, `system`, serviceFileName)}`;
}


export {
    checkForLinuxOs as CheckForLinuxOs,
    checkRunningAsRoot as CheckRunningAsTheRootUser,
    checkSystemd as CheckForSystemd,
    findService as FindServiceFile,
    getUnitSymlink as GetSymLinkForSystemd,
};
