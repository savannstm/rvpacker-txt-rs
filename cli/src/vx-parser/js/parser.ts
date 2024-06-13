import { dump, load } from "@hyrious/marshal";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { OrderedSet } from "immutable";
import { parseArgs, inspect } from "util";
import { isTypedArray } from "util/types";
import { readMap, readOther, readSystem } from "./read";
import { writeMap, mergeMap, mergeOther, writeOther, writeSystem } from "./write";
import { program } from "commander";

/*
const { values, positionals } = parseArgs({
    args: process.argv,

    options: {
        command: {
            type: "string",
        },
        inputDir: {
            type: "string",
        },
        outputDir: {
            type: "string",
        },
    },
    strict: true,
    allowPositionals: true,
});
*/

program.description("Parse .rvdata files and write .json files");
program
    .requiredOption("-c, --command <command>", "Command")
    .option("-i, --inputDir <inputDir>", "Input directory")
    .option("-o, --outputDir <outputDir>", "Output directory")
    .parse();

const options = program.opts();

const { command, inputDir, outputDir } = options;

function dumpOriginalJSON(originalDir: string, outputDir: string) {
    const originalRubyFiles: string[] = readdirSync(originalDir).filter((f: string) => f.includes(".rvdata"));

    for (const rubyFile of originalRubyFiles) {
        const data: object = load(readFileSync(`${originalDir}/${rubyFile}`)) as object;
        const inspectable: string = inspect(data, {
            showHidden: true,
            depth: null,
            maxArrayLength: null,
            maxStringLength: null,
        });

        mkdirSync(`${outputDir}/inspectable`, { recursive: true });
        writeFileSync(
            `${outputDir}/inspectable/${rubyFile.slice(0, rubyFile.lastIndexOf("."))}.json`,
            inspectable,
            "utf8"
        );
    }
}

function dumpReadableJSON(originalDir: string, outputDir: string) {
    const originalRubyFiles: string[] = readdirSync(originalDir).filter((f: string) => f.includes(".rvdata"));

    mkdirSync(`${outputDir}/readable`, { recursive: true });
    for (const rubyFile of originalRubyFiles) {
        const data: object = load(readFileSync(`${originalDir}/${rubyFile}`), { ivarToString: "" }) as object;

        writeFileSync(
            `${outputDir}/readable/${rubyFile.slice(0, rubyFile.lastIndexOf("."))}.json`,
            JSON.stringify(
                data,
                (_, value: any) =>
                    isTypedArray(value) && !(value instanceof BigInt64Array || value instanceof BigUint64Array)
                        ? Array.from(value)
                        : value,
                4
            ),
            "utf8"
        );
    }
}

switch (command) {
    case "dump":
        dumpReadableJSON(inputDir, outputDir);
        break;
    case "read":
        readMap(inputDir, outputDir);
        readOther(inputDir, outputDir);
        readSystem(inputDir, outputDir);
        break;
    case "write":
        const mapsHashmap: any = new Map();

        for (const filename of readdirSync(`${inputDir}/original`).filter((f: string) => f.startsWith("Map"))) {
            mapsHashmap.set(filename, mergeMap(load(readFileSync(`${inputDir}/original/${filename}`))));
        }

        const mapsOriginalText: string[] = readFileSync(`${inputDir}/translation/maps/maps.txt`, "utf8")
            .split("\n")
            .map((l) => l.replaceAll("\\n", "\n").trim());

        const mapsTranslatedText: string[] = readFileSync(`${inputDir}/translation/maps/maps_trans.txt`, "utf8")
            .split("\n")
            .map((l) => l.replaceAll("\\n", "\n").trim());

        const mapsOriginalNames: string[] = readFileSync(`${inputDir}/translation/maps/names.txt`, "utf8")
            .split("\n")
            .map((l) => l.replaceAll("\\n", "\n").trim());

        const mapsTranslatedNames: string[] = readFileSync(`${inputDir}/translation/maps/names_trans.txt`, "utf8")
            .split("\n")
            .map((l) => l.replaceAll("\\n", "\n").trim());

        const mapsTextHashmap: Map<string, string> = new Map();
        const mapsNamesHashmap: Map<string, string> = new Map();

        for (let i = 0; i < mapsOriginalText.length; i++) {
            mapsTextHashmap.set(mapsOriginalText[i], mapsTranslatedText[i]);
        }

        for (let i = 0; i < mapsOriginalNames.length; i++) {
            mapsNamesHashmap.set(mapsOriginalNames[i], mapsTranslatedNames[i]);
        }

        writeMap(mapsHashmap, outputDir, mapsTextHashmap, mapsNamesHashmap);

        const otherHashmap: any = new Map();

        for (const filename of readdirSync(`${inputDir}/original`).filter((f: string) => {
            const FILENAMES: string[] = ["Map", "Tilesets", "Animations", "States", "System"];
            for (const filename of FILENAMES) {
                if (f.startsWith(filename)) {
                    return false;
                }
            }
            return true;
        })) {
            otherHashmap.set(filename, mergeOther(load(readFileSync(`${inputDir}/original/${filename}`))));
        }

        writeOther(otherHashmap, outputDir, `${inputDir}/translation/other`);

        const systemJSON: string = load(readFileSync(`${inputDir}/original/System.rvdata2`)) as string;

        const systemOriginalText: string[] = readFileSync(`${inputDir}/translation/other/system.txt`, "utf8").split(
            "\n"
        );

        const systemTranslatedText: string[] = readFileSync(
            `${inputDir}/translation/other/system_trans.txt`,
            "utf8"
        ).split("\n");

        const systemTextHashmap: Map<string, string> = new Map();

        for (let i = 0; i < systemOriginalText.length; i++) {
            systemTextHashmap.set(systemOriginalText[i], systemTranslatedText[i]);
        }

        writeSystem(systemJSON, outputDir, systemTextHashmap);
        break;
}
