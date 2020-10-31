interface IArgumentData {
    help?: string;
    installService?: boolean;
    argList?: IRecognizedParameters;
}
interface IRecognizedParameters {
    /**
     * Account to use when running the service unit
     *
     * @remarks
     * _install only_
     */
    userAccountName?: string;
    /**
     * Comma-separated list of `NAME=value` pairs to include in the `.service` file
     *
     * @remarks
     * _install only_
     */
    environmentVariables?: Array<string>;
    /**
     * Path to existing `.service` file
     *   + **Prevents generating a new `.service` file**
     *
     * @remarks
     * _install only_
     */
    existingServiceFile?: string;
    /**
     * Name used for the service unit
     *
     * @remarks
     * _install only_
     */
    serviceName?: string;
    /**
     * Name used to identify the instance
     *   + Inclusion automatically names the `.service` file as a template: `@.service`
     *
     * @remarks
     * _install only_
     */
    instanceName?: string;
    /**
     * Only create an install the unit; do not start or enable it
     *
     * @remarks
     * _install only_
     */
    doNotStartEnable?: boolean;
    /**
     * + install: Path to the application, from the current directory
     * + uninstall: Path to the `.service` file to uninstall
     *   + Automatically uses the first `.service` file in the directory if a file is not specified
     */
    relativePathToApp?: string;
}
interface IExistingServiceFile {
    absolutePath: string;
    serviceShortName: string;
    serviceFileName: string;
    serviceFileNameWithInstance: string;
}
export { IArgumentData, IExistingServiceFile, IRecognizedParameters, };
