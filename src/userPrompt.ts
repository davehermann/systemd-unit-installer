import { createInterface as PromptUser} from "readline";

async function readUserInput(prompt, trim = true): Promise<string> {
    // Get the name for an account on the system
    const userInput = await new Promise((resolve: (value: string) => void) => {
        let rl = PromptUser({
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

export {
    readUserInput as ReadUserInput,
};
