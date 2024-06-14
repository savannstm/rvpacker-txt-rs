import { dump, load } from "@hyrious/marshal";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { Help, Option, program } from "commander";
import { getUserLocale } from "get-user-locale";
import chalk from "chalk";

import { readMap, readOther, readSystem, readScripts } from "./read";
import { mergeMap, mergeOther, writeMap, writeOther, writeSystem, writeScripts } from "./write";
import "./shuffle";

interface ProgramLocalization {
    programDesc: string;
    languageDesc: string;
    inputDirType: string;
    outputDirType: string;
    readInputDirDesc: string;
    readOutputDirDesc: string;
    writeInputDirDesc: string;
    writeOutputDirDesc: string;
    helpOptionDesc: string;
    helpCommandDesc: string;
    helpCommandType: string;
    usage: string;
    arguments: string;
    commands: string;
    options: string;
    error: string;
    optionsType: string;
    commandType: string;
    readDesc: string;
    writeDesc: string;
    default: string;
    choices: string;
    false: string;
    true: string;
    logOptionDesc: string;
    languageType: string;
    drunkType: string;
    drunkDesc: string;
    readLogString: string;
    writeLogString: string;
    timeElapsed: string;
}

class ProgramLocalization {
    constructor(language: string) {
        switch (language) {
            case "en":
                this.programDesc = "A tool, that parses .rvdata files into text and writes them back.";
                this.languageDesc = "Sets tool language to specified.";
                this.inputDirType = "INPUT_PATH";
                this.outputDirType = "OUTPUT_PATH";
                this.readInputDirDesc =
                    'Path to the input directory, containing a "original" folder with .rvdata files.';
                this.readOutputDirDesc =
                    'Path to the output directory, where the "parsed" folder with .txt files with text from the parsed .rvdata files will be created.';
                this.writeInputDirDesc =
                    'Path to the input directory, containing folders "original" with original game .rvdata files, and "translation" with "maps" and "other" folders with .txt game files.';
                this.writeOutputDirDesc =
                    'Path to the output directory, where the "output" folder with .rvdata files will be created out of .txt translation files.';
                this.helpOptionDesc = "Prints this help message.";
                this.helpCommandDesc = "Prints a help message for specified command.";
                this.helpCommandType = "COMMAND_NAME";
                this.usage = "Usage:";
                this.arguments = "Arguments;";
                this.commands = "Commands:";
                this.options = "Options:";
                this.error = "error:";
                this.optionsType = "OPTIONS";
                this.commandType = "COMMAND";
                this.readDesc =
                    'Parses .rvdata files from the "original" folder of input directory to the "parsed" folder of output directory.';
                this.writeDesc =
                    'Writes translated .rvdata files using original files from the "original" folder of input directory, replacing their text with the files from "translation" folder and outputting results to the "output" folder.';
                this.default = "default:";
                this.choices = "choices:";
                this.false = "false";
                this.true = "true";
                this.logOptionDesc = "Enables logging.";
                this.languageType = "LANGUAGE";
                this.drunkType = "NUMBER";
                this.drunkDesc =
                    "At value 1: shuffles all translation lines. At value 2: shuffles all words in translation lines.";
                this.readLogString = "Parsed file";
                this.writeLogString = "Written file";
                this.timeElapsed = "Time elapsed (in seconds):";
                break;
            case "ru":
                this.programDesc = "Инструмент, который парсит .rvdata файлы в текст и записывает их обратно.";
                this.languageDesc = "Устанавливает язык инструмента на введённый.";
                this.inputDirType = "ВХОДНОЙ_ПУТЬ";
                this.outputDirType = "ВЫХОДНОЙ_ПУТЬ";
                this.readInputDirDesc = 'Путь к директории входа, содержащей папку "original" с .rvdata файлами игры.';
                this.readOutputDirDesc =
                    'Путь к директории выхода, в которой будет создана папка "parsed" с .txt файлами из распарсенных .rvdata файлов.';
                this.writeInputDirDesc =
                    'Путь к директории входа, содержащей папки "original" с оригинальными .rvdata файлами игры, и "translation" с папками "maps" и "other" с .txt файлами игры.';
                this.writeOutputDirDesc =
                    'Путь к директории выхода, в которой будет создана папка "output" с .rvdata файлами, созданными из .txt файлов с переводом.';
                this.helpOptionDesc = "Выводит эту справку.";
                this.helpCommandDesc = "Выводит справку для указанной команды.";
                this.helpCommandType = "ИМЯ_КОМАНДЫ";
                this.usage = "Использование:";
                this.arguments = "Аргументы:";
                this.commands = "Команды:";
                this.options = "Опции:";
                this.error = "ошибка:";
                this.optionsType = "ОПЦИИ";
                this.commandType = "КОМАНДА";
                this.readDesc =
                    'Парсит .rvdata файлы из папки "original" входной директории в папку "parsed" выходной директории.';
                this.writeDesc = "";
                this.default = "по умолчанию:";
                this.choices = "варианты:";
                this.false = "нет";
                this.true = "да";
                this.logOptionDesc = "Включает логирование.";
                this.languageType = "ЯЗЫК";
                this.drunkType = "ЧИСЛО";
                this.writeDesc =
                    'Записывает переведенные файлы .rvdata, используя исходные файлы из папки "original" входной директории, заменяя текст файлами из папки "translation" и выводя результаты в папку "output".';
                this.drunkDesc =
                    "При значении 1: перемешивает все строки перевода. При значении 2: перемешивает все слова в строках перевода.";
                this.readLogString = "Распарсен файл";
                this.writeLogString = "Записан файл";
                this.timeElapsed = "Время выполнения (в секундах):";
                break;
        }

        this.usage = chalk.bold.underline(this.usage);
        this.arguments = chalk.bold.underline(this.arguments);
        this.commands = chalk.bold.underline(this.commands);
        this.options = chalk.bold.underline(this.options);
        this.optionsType = chalk.bold(this.optionsType);
        this.commandType = chalk.bold(this.commandType);
    }
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

program.helpOption("-h, --help", localization.helpOptionDesc);
program.helpCommand(`help [${localization.helpCommandType}]`, localization.helpCommandDesc);

program
    .option("--log", localization.logOptionDesc, false)
    .addOption(
        new Option(`-l, --language <${localization.languageType}>`, localization.languageDesc).choices(allowedLanguages)
    );

program
    .command("read")
    .option(`-i, --inputDir <${localization.inputDirType}>`, localization.readInputDirDesc, "./")
    .option(`-o, --outputDir <${localization.outputDirType}>`, localization.readOutputDirDesc, "./")
    .usage(localization.optionsType)
    .description(localization.readDesc)
    .action(function () {
        const { inputDir, outputDir }: { [key: string]: string } = this.opts();
        const { log } = program.opts();

        const paths: Record<string, string> = {
            original: `${inputDir}/original`,
            maps: `${outputDir}/translation/maps`,
            other: `${outputDir}/translation/other`,
            plugins: `${outputDir}/translation/plugins`,
        };

        mkdirSync(paths.maps, { recursive: true });
        mkdirSync(paths.other, { recursive: true });
        mkdirSync(paths.plugins, { recursive: true });

        readMap(paths.original, paths.maps, log, localization.readLogString);
        readOther(paths.original, paths.other, log, localization.readLogString);
        readSystem(paths.original, paths.other, log, localization.readLogString);
        readScripts(paths.original, paths.other, log, localization.readLogString);
    });

program
    .command("write")
    .option(`-i, --inputDir <${localization.inputDirType}>`, localization.writeInputDirDesc, "./")
    .option(`-o, --outputDir <${localization.outputDirType}>`, localization.writeOutputDirDesc, "./")
    .option(`-d, --drunk <${localization.drunkType}>`, localization.drunkDesc, "0")
    .usage(localization.optionsType)
    .description(localization.writeDesc)
    .action(function () {
        const { inputDir, outputDir, drunk }: { [key: string]: string } = this.opts();
        const { log } = program.opts();

        const drunkInt = Number.parseInt(drunk);

        const paths: Record<string, string> = {
            original: `${inputDir}/original`,
            maps: `${inputDir}/translation/maps/maps.txt`,
            mapsTrans: `${inputDir}/translation/maps/maps_trans.txt`,
            names: `${inputDir}/translation/maps/names.txt`,
            namesTrans: `${inputDir}/translation/maps/names_trans.txt`,
            other: `${inputDir}/translation/other`,
            output: `${outputDir}/output/data`,
        };

        mkdirSync(paths.output, { recursive: true });

        const mapsObjMap = new Map(
            readdirSync(paths.original)
                .filter((filename) => filename.startsWith("Map"))
                .map((filename) => [filename, mergeMap(load(readFileSync(`${paths.original}/${filename}`)) as object)])
        );

        const mapsOriginalText = readFileSync(paths.maps, "utf8")
            .split("\n")
            .map((line) => line.replaceAll("\\n", "\n").trim());

        let mapsTranslatedText = readFileSync(paths.mapsTrans, "utf8")
            .split("\n")
            .map((line) => line.replaceAll("\\n", "\n").trim());

        const mapsOriginalNames = readFileSync(paths.names, "utf8")
            .split("\n")
            .map((line) => line.replaceAll("\\n", "\n").trim());

        let mapsTranslatedNames = readFileSync(paths.mapsTrans, "utf8")
            .split("\n")
            .map((line) => line.replaceAll("\\n", "\n").trim());

        if (drunkInt > 0) {
            mapsTranslatedText = mapsTranslatedText.shuffle();
            mapsTranslatedNames = mapsTranslatedNames.shuffle();

            if (drunkInt === 2) {
                mapsTranslatedText = mapsTranslatedText.map((string) => {
                    return string
                        .split("\n")
                        .map((line) => line.split(" ").shuffle().join(" "))
                        .join("\n");
                });
            }
        }

        const mapsTranslationMap = new Map(mapsOriginalText.map((string, i) => [string, mapsTranslatedText[i]]));
        const namesTranslationMap = new Map(mapsOriginalNames.map((string, i) => [string, mapsTranslatedNames[i]]));

        writeMap(mapsObjMap, paths.output, mapsTranslationMap, namesTranslationMap, log, localization.writeLogString);

        const otherObjMap = new Map(
            readdirSync(`${inputDir}/original`)
                .filter(
                    (filename) =>
                        !["Map", "Tilesets", "Animations", "States", "System", "Scripts"].some((prefix) =>
                            filename.startsWith(prefix)
                        )
                )
                .map((filename) => [
                    filename,
                    mergeOther(load(readFileSync(`${paths.original}/${filename}`)) as object[]),
                ])
        );

        writeOther(otherObjMap, paths.output, paths.other, log, localization.writeLogString, drunkInt);

        const systemObj = load(readFileSync(`${paths.original}/System.rvdata2`)) as object;

        const systemOriginalText = readFileSync(`${paths.other}/system.txt`, "utf8").split("\n");
        let systemTranslatedText = readFileSync(`${paths.other}/system_trans.txt`, "utf8").split("\n");

        if (drunkInt > 0) {
            systemTranslatedText = systemTranslatedText.shuffle();

            if (drunkInt === 2) {
                systemTranslatedText = systemTranslatedText.map((string) => {
                    return string
                        .split("\n")
                        .map((line) => line.split(" ").shuffle().join(" "))
                        .join("\n");
                });
            }
        }

        const systemTranslationMap = new Map(systemOriginalText.map((string, i) => [string, systemTranslatedText[i]]));

        writeSystem(systemObj, paths.output, systemTranslationMap, log, localization.writeLogString);

        const scriptsArr = load(readFileSync(`${paths.original}/Scripts.rvdata2`), {
            string: "binary",
        }) as Uint8Array[][];
        const scriptsTranslation = readFileSync(`${paths.other}/scripts_trans.txt`, "utf8").split("\n");

        writeScripts(scriptsArr, scriptsTranslation, paths.output, log, localization.writeLogString);
    });

program.parse(process.argv);
console.log(`${localization.timeElapsed} ${(performance.now() - startTime) / 1000}`);
