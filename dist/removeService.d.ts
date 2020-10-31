import { IRecognizedParameters } from "./interfaces";
/**
 * Stop, disable, and remove a service from Systemd
 */
declare function removeService({ relativePathToApp, instanceName }: IRecognizedParameters): Promise<void>;
export { removeService as RemoveService, };
