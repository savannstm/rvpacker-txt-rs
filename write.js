import { ensureDirSync } from "https://deno.land/std@0.216.0/fs/mod.ts";
import { join } from "https://deno.land/std@0.216.0/path/mod.ts";

const start = Date.now();
const decoder = new TextDecoder("utf-8");
const encoder = new TextEncoder();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function removeConsequent401(file) {
	function mergeConsequent401Objects(array) {
		let first = undefined;
		let number = -1;
		let newString = "";

		for (let i = 0; i < array.length; i++) {
			const object = array[i];
			const code = object.code;
			if (code === 401 && first === undefined) {
				first = i;
				number++;
				newString += object.parameters[0] + "\n";
			} else if (code === 401 && first !== undefined) {
				number++;
				newString += object.parameters[0] + "\n";
			}
			if (i > 0 && array[i - 1].code === 401 && code !== 401 && first !== undefined) {
				array[first].parameters[0] = newString.slice(0, -1);
				array.splice(first + 1, number);
				i -= number;
				newString = "";
				number = -1;
				first = undefined;
			}
		}
		return array;
	}

	const newJSONData = JSON.parse(decoder.decode(Deno.readFileSync(file)));

	for (const [ev, event] of newJSONData?.events?.entries() || []) {
		for (const [pg, page] of event?.pages?.entries() || []) {
			const newArray = mergeConsequent401Objects(page.list);
			newJSONData.events[ev].pages[pg].list = newArray;
		}
	}

	return newJSONData;
}

const jsonObjects = [...Deno.readDirSync(join(import.meta.dirname, "./original"))]
	.map((entry) => entry.name)
	.filter((file) => {
		return file.startsWith("Map");
	})
	.map((file) => {
		return removeConsequent401(join(import.meta.dirname, "./original", file));
	})
	.slice(0, -1);

function jsonWrite(files, transfileog, transfile) {
	const filenames = [...Deno.readDirSync(join(import.meta.dirname, "./original"))]
		.map((entry) => entry.name)
		.filter((file) => {
			return file.startsWith("Map");
		});

	const transog = decoder.decode(Deno.readFileSync(transfileog)).split("\n");
	const trans = decoder.decode(Deno.readFileSync(transfile)).split("\n");
	const translationHashmap = new Map();
	for (let i = 0; i < transog.length; i++) {
		translationHashmap.set(transog[i].trim(), trans[i].replaceAll("\\n", "\n").trim());
	}

	const locnames = decoder.decode(Deno.readFileSync(join(import.meta.dirname, "./names.txt"))).split("\n");
	const locnamestrans = decoder.decode(Deno.readFileSync(join(import.meta.dirname, "./names_trans.txt"))).split("\n");
	const namesHashmap = new Map();
	for (let i = 0; i < locnames.length; i++) {
		namesHashmap.set(locnames[i].trim(), locnamestrans[i].trim());
	}

	for (const [f, file] of files.entries()) {
		const newjson = file;
		const outputFolderPath = join(import.meta.dirname, "./data");

		if (!ensureDirSync(outputFolderPath)) {
			Deno.mkdirSync(outputFolderPath, { recursive: true });
		}

		const outputPath = join(outputFolderPath, filenames[f]);
		const locationName = newjson?.displayName;

		if (namesHashmap.has(locationName)) {
			newjson.displayName = namesHashmap.get(locationName);
		}

		for (const event of newjson?.events || []) {
			for (const page of event?.pages || []) {
				for (const item of page.list) {
					const code = item.code;

					for (const [pr, parameter] of item.parameters.entries()) {
						if (code === 102) {
							if (Array.isArray(parameter)) {
								for (const [p, param] of parameter.entries()) {
									if (typeof param === "string") {
										if (translationHashmap.has(param.replaceAll("\n", "\\n").trim())) {
											item.parameters[pr][p] = translationHashmap.get(
												param.replaceAll("\n", "\\n").trim()
											);
										} else {
											console.log(
												param,
												translationHashmap.get(param.replaceAll("\n", "\\n").trim())
											);
										}
									}
								}
							}
						} else if ([401, 402, 356].includes(code)) {
							if (code === 401) {
								if (translationHashmap.has(parameter.replaceAll("\n", "\\n").trim())) {
									item.parameters[0] = translationHashmap.get(
										parameter.replaceAll("\n", "\\n").trim()
									);
								} else {
									console.log("401");
									console.log(
										parameter.replaceAll("\n", "\\n").trim(),
										translationHashmap.get(parameter.replaceAll("\n", "\\n").trim())
									);
								}
							} else if (code === 402) {
								if (
									typeof parameter === "string" &&
									translationHashmap.has(parameter.replaceAll("\n", "\\n").trim())
								) {
									item.parameters[1] = translationHashmap.get(
										parameter.replaceAll("\n", "\\n").trim()
									);
								} else if (typeof parameter === "string") {
									console.log("402");
									console.log(
										parameter.replaceAll("\n", "\\n").trim(),
										translationHashmap.get(parameter.replaceAll("\n", "\\n").trim())
									);
								}
							} else if (code === 356) {
								if (
									parameter.startsWith("GabText") ||
									(parameter.startsWith("choice_text") && !parameter.endsWith("????"))
								) {
									if (translationHashmap.has(parameter.replaceAll("\n", "\\n").trim())) {
										item.parameters[0] = translationHashmap.get(
											parameter.replaceAll("\n", "\\n").trim()
										);
									} else {
										console.log("356");
										console.log(
											parameter.replaceAll("\n", "\\n").trim(),
											translationHashmap.get(parameter.replaceAll("\n", "\\n").trim())
										);
									}
								}
							}
						}
					}
				}
			}
		}
		Deno.writeFileSync(outputPath, encoder.encode(JSON.stringify(newjson)));
		console.log(`Записан файл ${filenames[f]}.`);
	}
}

jsonWrite(jsonObjects, join(import.meta.dirname, "./maps.txt"), join(import.meta.dirname, "./maps_trans.txt"));

console.log("Все файлы успешно записаны.");
console.log("Потрачено времени: " + (Date.now() - start) / 1000 + " секунд.");

await sleep(3000);
