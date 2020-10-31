import { IRecognizedParameters } from "./interfaces";
/** Add service to Systemd, and - optionally - enable and start */
declare function installService({ existingServiceFile, serviceName, instanceName, userAccountName, relativePathToApp, environmentVariables, doNotStartEnable }?: IRecognizedParameters): Promise<void>;
export { installService as InstallService, };
