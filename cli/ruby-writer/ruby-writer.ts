import { mkdir } from "node:fs/promises";
import { Help, Option, program } from "commander";
import { getUserLocale } from "get-user-locale";

import { readMap, readOther, readSystem, readScripts } from "./read";
import { writeMap, writeOther, writeSystem, writeScripts } from "./write";
import { ProgramLocalization } from "./program-localization";
import "./shuffle";

const startTime = performance.now();
const args = process.argv;

let locale = getUserLocale();

const allowedLanguages = ["ru", "en"];

for (let i = 0; i < args.length; i++) {
    if (args[i] === "-l" || args[i] === "--language") {
        if (allowedLanguages.includes(args[i + 1])) {
            locale = args[i + 1];
            break;
        }
    }
}

locale = locale.split("-")[0];

let language;
switch (locale) {
    case "ru" || "uk" || "be":
        language = "ru";
        break;
    case "en":
        language = "en";
        break;
    default:
        language = "en";
        break;
}

const localization = new ProgramLocalization(language);

program.description(localization.programDesc);

program.configureHelp({
    formatHelp: (cmd, helper) =>
        new Help()
            .formatHelp(cmd, helper)
            .replace("Arguments:", localization.arguments)
            .replace("Commands:", localization.commands)
            .replace("Options:", localization.options)
            .replace("Usage:", localization.usage)
            .replaceAll("default:", localization.default)
            .replaceAll("choices:", localization.choices)
            .replaceAll("false", localization.false)
            .replaceAll("true", localization.true),
});

program.configureOutput({
    writeErr: (str) => process.stderr.write(str.replace("error:", localization.error)),
});

program.usage(`[${localization.optionsType}] [${localization.commandType}]`);

program.helpOption("-h, --help", localization.helpOptionDesc);
program.helpCommand(`help [${localization.helpCommandType}]`, localization.helpCommandDesc);

program
    .option("--log", localization.logOptionDesc, false)
    .addOption(
        new Option(`-l, --language <${localization.languageType}>`, localization.languageDesc).choices(allowedLanguages)
    )
    .addOption(
        new Option(`--no <${localization.noType}>`, localization.noOptionDesc).argParser((value) => value.split(","))
    );

program
    .command("read")
    .option(`-i, --inputDir <${localization.inputDirType}>`, localization.readInputDirDesc, "./")
    .option(`-o, --outputDir <${localization.outputDirType}>`, localization.readOutputDirDesc, "./")
    .addOption(
        new Option(`--no <${localization.noType}>`, localization.noOptionDesc).argParser((value) => value.split(","))
    )
    .usage(localization.optionsType)
    .description(localization.readDesc)
    .action(async (_name, options) => {
        const { inputDir, outputDir }: { [key: string]: string } = options.opts();
        const { log, no } = program.opts();

        const paths: Record<string, string> = {
            original: `${inputDir}/original`,
            maps: `${outputDir}/translation/maps`,
            other: `${outputDir}/translation/other`,
        };

        await mkdir(paths.maps, { recursive: true });
        await mkdir(paths.other, { recursive: true });

        if (!no || !no.includes("maps")) {
            await readMap(paths.original, paths.maps, log, localization.readLogString);
        }

        if (!no || !no.includes("other")) {
            await readOther(paths.original, paths.other, log, localization.readLogString);
        }

        if (!no || !no.includes("system")) {
            const systemPaths = [
                `${paths.original}/System.rvdata2`,
                `${paths.original}/System.rvdata`,
                `${paths.original}/System.rxdata`,
            ];

            for (const path of systemPaths) {
                const file = Bun.file(path);

                if (await file.exists()) {
                    await readSystem(path, paths.other, log, localization.readLogString);
                    break;
                }
            }
        }

        if (!no || !no.includes("scripts")) {
            const scriptsPaths = [
                `${paths.original}/Scripts.rvdata2`,
                `${paths.original}/Scripts.rvdata`,
                `${paths.original}/Scripts.rxdata`,
            ];

            for (const scriptsPath of scriptsPaths) {
                const file = Bun.file(scriptsPath);

                if (await file.exists()) {
                    await readScripts(scriptsPath, paths.other, log, localization.readLogString);
                    break;
                }
            }
        }

        console.log(`${localization.timeElapsed} ${(performance.now() - startTime) / 1000}`);
    });

program
    .command("write")
    .option(`-i, --inputDir <${localization.inputDirType}>`, localization.writeInputDirDesc, "./")
    .option(`-o, --outputDir <${localization.outputDirType}>`, localization.writeOutputDirDesc, "./")
    .option(`-d, --drunk <${localization.drunkType}>`, localization.drunkDesc, "0")
    .addOption(
        new Option(`--no <${localization.noType}>`, localization.noOptionDesc).argParser((value) => value.split(","))
    )
    .usage(localization.optionsType)
    .description(localization.writeDesc)
    .action(async (_name, options) => {
        const { inputDir, outputDir, drunk }: { [key: string]: string } = options.opts();
        const { log, no } = program.opts();

        const drunkInt = Number.parseInt(drunk);

        const paths: Record<string, string> = {
            original: `${inputDir}/original`,
            maps: `${inputDir}/translation/maps`,
            other: `${inputDir}/translation/other`,
            output: `${outputDir}/output/data`,
        };

        await mkdir(paths.output, { recursive: true });

        if (no && !no.includes("maps")) {
            await writeMap(paths.original, paths.maps, paths.output, drunkInt, log, localization.writeLogString);
        }

        if (no && !no.includes("other")) {
            await writeOther(paths.original, paths.output, paths.other, drunkInt, log, localization.writeLogString);
        }

        if (no && !no.includes("system")) {
            const systemFilePaths = [
                `${paths.original}/System.rvdata2`,
                `${paths.original}/System.rvdata`,
                `${paths.original}/System.rxdata`,
            ];

            for (const path of systemFilePaths) {
                const file = Bun.file(path);

                if (await file.exists()) {
                    await writeSystem(path, paths.other, paths.output, drunkInt, log, localization.writeLogString);
                    break;
                }
            }
        }

        if (no && !no.includes("scripts")) {
            const scriptsPaths = [
                `${paths.original}/Scripts.rvdata2`,
                `${paths.original}/Scripts.rvdata`,
                `${paths.original}/Scripts.rxdata`,
            ];

            for (const path of scriptsPaths) {
                const file = Bun.file(path);

                if (await file.exists()) {
                    await writeScripts(path, paths.other, paths.output, log, localization.writeLogString);
                    break;
                }
            }
        }

        console.log(`${localization.timeElapsed} ${(performance.now() - startTime) / 1000}`);
    });

program.parse(process.argv);
