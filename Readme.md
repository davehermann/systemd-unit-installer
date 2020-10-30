# Systemd Unit Installer

*Add a unit file to an application repo, and install to systemd*

## Installing

### Global

`npm install -g @davehermann/systemd-unit-installer`

+ Use `service-installer` to run [Command Line](#command-line-usage)

### Local to Application

`npm install @davehermann/systemd-unit-installer`

+ Use `npx service-installer` to run [Command Line](#command-line-usage)

## Command line usage

`service-installer <action> [options]`

### In-line Help

`service-installer` or `service-installer --help`

+ In-line help prints the current working directory as part of the commands that utilize it

### Actions

| Command | Description |
| ------- | ----------- |
| `i` or `install` | Install a systemd unit file, and *by default* create that file and start/enable the service |
| `u` or `uninstall` | Stop, disable, and remove the unit file from systemd |

### Install Options

| Flag | Expected Data | Description |
| ---- | ------------- | ----------- |
| `--account` | Account name | Name of the system account to run the service as |
| `--ev` | Environment Variables | Comma-separated list of `NAME=value` pairs to add as environment variables to the unit file |
| `--existing` | Path to existing `.service` file | Relative path from the current working directory to a previously generated file when using `service-installer` to add+start/enable or stop/disable+remove a unit file |
| `--name` | Service name | Your name for the service in systemd |
| `--no-start` | **NONE** | When creating and adding to systemd, <u>do not</u> start/enable the service |
| `--path` | Application main .js file | Relative path from the current working directory to the main application file |

### Uninstall Options

| Flag | Expected Data | Description |
| ---- | ------------- | ----------- |
| `--path` | `.service` file location | Path to the service file to uninstall<br />*Defaults to the first `.service` file found in the current working directory* |
