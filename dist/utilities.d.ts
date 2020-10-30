import { IExistingServiceFile } from "./interfaces";
/** Check for Linux as the OS powering this system */
declare function checkForLinuxOs(): void;
/** Ensure Systemd is the init system running */
declare function checkSystemd(): Promise<void>;
/** Check for running as the root user, and disallow */
declare function checkRunningAsRoot(): void;
/**
 * Get the absolute path to the service file
 *
 * @param relativePathToApp - relative path to the location of the service file
 *
 * @returns Both the absolute path, and the service name as listed in the file
 */
declare function findService(relativePathToApp: any): Promise<IExistingServiceFile>;
/**
 * Get the symbolic link for the unit file in /etc/systemd/system
 * @param serviceFileName - Name of the service unit
 */
declare function getUnitSymlink(serviceFileName: any): string;
export { checkForLinuxOs as CheckForLinuxOs, checkRunningAsRoot as CheckRunningAsTheRootUser, checkSystemd as CheckForSystemd, findService as FindServiceFile, getUnitSymlink as GetSymLinkForSystemd, };
