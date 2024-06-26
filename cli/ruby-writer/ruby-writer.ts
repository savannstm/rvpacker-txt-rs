import { mkdir, readdir, exists } from "node:fs/promises";
import { Command, Help, Option, program } from "commander";
import { getUserLocale } from "get-user-locale";
import { load } from "@hyrious/marshal";

import "./shuffle";
import { readMap, readOther, readSystem, readScripts } from "./read";
import { writeMap, writeOther, writeSystem, writeScripts } from "./write";
import { ProgramLocalization } from "./program-localization";
import { getValueBySymbolDesc } from "./symbol-utils";

async function getGameType(systemFilePath: string): Promise<string> {
    const file = Bun.file(systemFilePath);
    const obj = load(await file.arrayBuffer()) as RubyObject;

    let gameTitle = getValueBySymbolDesc(obj, "@game_title");

    if (gameTitle instanceof Uint8Array) {
        const decoded = new TextDecoder().decode(gameTitle);

        if (decoded.length > 0) {
            gameTitle = decoded;
        }
    }

    if (typeof gameTitle === "string" && gameTitle.length > 0) {
        gameTitle = gameTitle.toLowerCase();

        if (gameTitle.includes("lisa")) {
            return "lisa";
        }
    }

    return "";
}

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

program.helpOption("-h, --help", localization.helpArgDesc);
program.helpCommand(`help [${localization.helpCommandType}]`, localization.helpCommandDesc);

program
    .option("--log", localization.logArgDesc, false)
    .addOption(
        new Option(`-l, --language <${localization.languageType}>`, localization.languageArgDesc).choices(
            allowedLanguages
        )
    )
    .addOption(
        new Option(`--no <${localization.noType}>`, localization.noArgDesc).argParser((value) => value.split(","))
    )
    .option(`--disable-custom-parsing`, localization.disableCustomParsingDesc, false);

program
    .command("read")
    .option(`-i, --input-dir <${localization.inputDirArgType}>`, localization.readInputDirDesc, "./")
    .option(`-o, --output-dir <${localization.outputDirArgType}>`, localization.readOutputDirDesc, "./")
    .addOption(
        new Option(`--no <${localization.noType}>`, localization.noArgDesc).argParser((value) => value.split(","))
    )
    .usage(localization.optionsType)
    .description(localization.readCommandDesc)
    .action(async (_name, options: Command) => {
        const { inputDir, outputDir }: { [key: string]: string } = options.opts();
        const { log, no, disableCustomParsing } = program.opts();

        const paths: Record<string, string> = {
            original: `${inputDir}/original`,
            maps: `${outputDir}/translation/maps`,
            other: `${outputDir}/translation/other`,
        };

        if (!(await exists(paths.original))) {
            const files = await readdir(inputDir);

            const dataFolder = files.find((file) => /^data/i.test(file));
            if (!dataFolder) {
                throw localization.originalDirMissing;
            }

            paths.original = `${inputDir}/${dataFolder}`;
        }

        if (outputDir === "./") {
            paths.maps = `${inputDir}/translation/maps`;
            paths.other = `${inputDir}/translation/other`;
        }

        await mkdir(paths.maps, { recursive: true });
        await mkdir(paths.other, { recursive: true });

        let systemPath;
        const systemPaths = [
            `${paths.original}/System.rvdata2`,
            `${paths.original}/System.rvdata`,
            `${paths.original}/System.rxdata`,
        ];

        for (const _systemPath of systemPaths) {
            const file = Bun.file(_systemPath);

            if (await file.exists()) {
                systemPath = _systemPath;
                break;
            }
        }

        let gameType: string = "";

        if (!disableCustomParsing) {
            if (systemPath) {
                gameType = await getGameType(systemPath);
            } else {
                throw localization.systemFileMissing;
            }
        }

        if (!no || !no.includes("maps")) {
            await readMap(paths.original, paths.maps, log, localization.readLogMessage, gameType);
        }

        if (!no || !no.includes("other")) {
            await readOther(paths.original, paths.other, log, localization.readLogMessage, gameType);
        }

        if (!no || !no.includes("system")) {
            if (systemPath) {
                await readSystem(systemPath, paths.other, log, localization.readLogMessage);
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
                    await readScripts(scriptsPath, paths.other, log, localization.readLogMessage);
                    break;
                }
            }
        }

        console.log(`${localization.timeElapsed} ${(performance.now() - startTime) / 1000}`);
    });

program
    .command("write")
    .option(`-i, --input-dir <${localization.inputDirArgType}>`, localization.writeInputDirDesc, "./")
    .option(`-o, --output-dir <${localization.outputDirArgType}>`, localization.writeOutputDirDesc, "./")
    .option(`-d, --shuffle <${localization.shuffleArgType}>`, localization.shuffleArgDesc, "0")
    .addOption(
        new Option(`--no <${localization.noType}>`, localization.noArgDesc).argParser((value) => value.split(","))
    )
    .usage(localization.optionsType)
    .description(localization.writeCommandDesc)
    .action(async (_name, options: Command) => {
        const { inputDir, outputDir, shuffle }: { [key: string]: string } = options.opts();
        const { log, no, disableCustomParsing } = program.opts();

        const shuffleLevel = Number.parseInt(shuffle);

        const paths: Record<string, string> = {
            original: `${inputDir}/original`,
            maps: `${inputDir}/translation/maps`,
            other: `${inputDir}/translation/other`,
            output: `${outputDir}/output/data`,
        };

        if (!(await exists(paths.original))) {
            const files = await readdir(inputDir);

            const dataFolder = files.find((file) => /^data/i.test(file));
            if (!dataFolder) {
                throw localization.originalDirMissing;
            }

            paths.original = `${inputDir}/${dataFolder}`;
        }

        if (outputDir === "./") {
            paths.output = `${inputDir}/output/data`;
        }

        if (!(await exists(paths.maps)) || !(await exists(paths.other))) {
            throw localization.translationDirsMissing;
        }

        await mkdir(paths.output, { recursive: true });

        let systemPath;
        for (const _systemPath of [
            `${paths.original}/System.rvdata2`,
            `${paths.original}/System.rvdata`,
            `${paths.original}/System.rxdata`,
        ]) {
            const file = Bun.file(_systemPath);

            if (await file.exists()) {
                systemPath = _systemPath;
                break;
            }
        }

        let gameType: string = "";

        if (!disableCustomParsing) {
            if (systemPath) {
                gameType = await getGameType(systemPath);
            } else {
                throw localization.systemFileMissing;
            }
        }
        if (!no || !no.includes("maps")) {
            await writeMap(
                paths.maps,
                paths.original,
                paths.output,
                shuffleLevel,
                log,
                localization.writeLogMessage,
                gameType
            );
        }

        if (!no || !no.includes("other")) {
            await writeOther(
                paths.other,
                paths.original,
                paths.output,
                shuffleLevel,
                log,
                localization.writeLogMessage,
                gameType
            );
        }

        if (!no || !no.includes("system")) {
            if (systemPath) {
                await writeSystem(
                    systemPath,
                    paths.other,
                    paths.output,
                    shuffleLevel,
                    log,
                    localization.writeLogMessage
                );
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
                    await writeScripts(scriptsPath, paths.other, paths.output, log, localization.writeLogMessage);
                    break;
                }
            }
        }

        console.log(`${localization.timeElapsed} ${(performance.now() - startTime) / 1000}`);
    });

program.parse(process.argv);
