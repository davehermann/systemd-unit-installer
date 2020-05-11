// NPM Modules
const { InitializeLogging, Info, Err } = require(`multi-level-logger`);

function hello() {
    Info(`Systemd Unit Installer Operational`);

    return Promise.resolve();
}

InitializeLogging(`info`);

hello()
    .catch(err => {
        // Log the error data as-is
        Err(err, true);
    });

