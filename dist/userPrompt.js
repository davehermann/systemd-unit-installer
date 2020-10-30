"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadUserInput = void 0;
const readline_1 = require("readline");
async function readUserInput(prompt, trim = true) {
    // Get the name for an account on the system
    const userInput = await new Promise((resolve) => {
        let rl = readline_1.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question(`${prompt}: `, (enteredText) => {
            rl.close();
            if (trim)
                enteredText = enteredText.trim();
            resolve(enteredText);
        });
    });
    return userInput;
}
exports.ReadUserInput = readUserInput;
