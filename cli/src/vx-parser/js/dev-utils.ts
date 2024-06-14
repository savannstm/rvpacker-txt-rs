import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { load } from "@hyrious/marshal";
import { inspect } from "util";
import { isTypedArray } from "util/types";

export function dumpOriginalJSON(originalDir: string, outputDir: string) {
    const originalRubyFiles: string[] = readdirSync(originalDir).filter((filename: string) =>
        filename.endsWith(".rvdata")
    );

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

export function dumpReadableJSON(originalDir: string, outputDir: string) {
    const originalRubyFiles: string[] = readdirSync(originalDir).filter((filename: string) =>
        filename.includes(".rvdata")
    );

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
