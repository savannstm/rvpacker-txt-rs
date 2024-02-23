import { ensureDirSync } from "https://deno.land/std@0.216.0/fs/mod.ts";
import { join } from "https://deno.land/std@0.216.0/path/mod.ts";

const start = Date.now();

function merge401(array) {
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

function mergeMap401(file) {
	const outputJSON = JSON.parse(Deno.readTextFileSync(file));

	for (const [ev, event] of outputJSON?.events?.entries() || []) {
		for (const [pg, page] of event?.pages?.entries() || []) {
			const newList = merge401(page.list);
			outputJSON.events[ev].pages[pg].list = newList;
		}
	}
	return outputJSON;
}

function mergeOther401(file) {
	const outputJSON = JSON.parse(Deno.readTextFileSync(file));

	for (const element of outputJSON) {
		if (element?.pages) {
			for (const [pg, page] of element.pages.entries()) {
				const newArray = merge401(page.list);
				element.pages[pg].list = newArray;
			}
		} else {
			if (element?.list) {
				const newArray = merge401(element.list);
				element.list = newArray;
			}
		}
	}

	return outputJSON;
}

const dirPaths = {
	original: join(Deno.cwd(), "./original"),
	output: join(Deno.cwd(), "./data"),
	maps: join(Deno.cwd(), "./maps/maps.txt"),
	mapsTrans: join(Deno.cwd(), "./maps/maps_trans.txt"),
	names: join(Deno.cwd(), "./maps/names.txt"),
	namesTrans: join(Deno.cwd(), "./maps/names_trans.txt"),
	other: join(Deno.cwd(), "./other"),
	plugins: join(Deno.cwd(), "./plugins"),
};

const mapsJSON = [...Deno.readDirSync(dirPaths.original)]
	.map((entry) => entry.name)
	.filter((file) => {
		return file.startsWith("Map");
	})
	.map((file) => {
		return mergeMap401(join(dirPaths.original, file));
	});

const otherJSON = [...Deno.readDirSync(dirPaths.original)]
	.map((entry) => entry.name)
	.filter((file) => {
		return (
			!file.startsWith("Map") &&
			!file.startsWith("Tilesets") &&
			!file.startsWith("Animations") &&
			!file.startsWith("States") &&
			!file.startsWith("System")
		);
	})
	.map((file) => {
		return mergeOther401(join(dirPaths.original, file));
	});

const systemJSON = JSON.parse(Deno.readTextFileSync(join(dirPaths.original, "System.json")));

function extractPluginsJSON() {
	const pluginsPath = join(Deno.cwd(), "./plugins/plugins.js");
	const fileContent = Deno.readTextFileSync(pluginsPath).split("\n");
	let newString = "";
	for (let i = 3; i < fileContent.length - 1; i++) {
		newString += fileContent[i];
	}
	newString = newString.slice(0, -1);
	return newString;
}

const pluginsJSON = JSON.parse(extractPluginsJSON());

function isUselessLine(line) {
	return (
		line.includes("_") ||
		line.includes("---") ||
		line.startsWith("//") ||
		/\d$/.test(line) ||
		/^[A-Z\s]+$/.test(line) ||
		/^[A-Z]+$/.test(line) ||
		[
			"gfx",
			"WakeUP",
			"LegHURT",
			"smokePipe",
			"DEFAULT CHARACTER",
			"RITUAL CIRCLE",
			"GameOver",
			"deathCheck",
			"REMOVEmembers",
			"Beartrap",
			"TransferSTATStoFUSION",
			"PartyREARRANGE",
			"SKILLSdemonSeedAVAILABLE",
			"TransferSKILLStoMARRIAGE",
			"counter-magic Available?",
			"greater magic Available?",
			"Blood sacrifice Available?",
			"Back from Mahabre",
			"BLINDNESS?",
			"Crippled?",
			"WhileBackstab",
			"TransferSTATStoMARRIAGE",
		].includes(line) ||
		line.startsWith("??") ||
		line.startsWith("RANDOM") ||
		line.startsWith("Empty scroll") ||
		line.startsWith("TALK")
	);
}

function writeMaps(files, originalTextFile, translatedTextFile) {
	const filenames = [...Deno.readDirSync(dirPaths.original)]
		.map((entry) => entry.name)
		.filter((file) => {
			return file.startsWith("Map");
		});

	const originalText = Deno.readTextFileSync(originalTextFile).split("\n");
	const translatedText = Deno.readTextFileSync(translatedTextFile).split("\n");
	const textHashMap = new Map(
		originalText.map((item, i) => [
			item.replaceAll("\\n[", "\\N[").replaceAll("\\n", "\n"),
			translatedText[i].replaceAll("\\n", "\n").trim(),
		])
	);

	const originalNames = Deno.readTextFileSync(dirPaths.names).split("\n");
	const translatedNames = Deno.readTextFileSync(dirPaths.namesTrans).split("\n");
	const namesHashMap = new Map(originalNames.map((item, i) => [item.trim(), translatedNames[i].trim()]));

	for (const [f, file] of files.entries()) {
		const outputJSON = file;
		const outputDir = dirPaths.output;

		ensureDirSync(outputDir);

		const outputPath = join(outputDir, filenames[f]);
		const locationName = outputJSON?.displayName;

		if (namesHashMap.has(locationName)) {
			outputJSON.displayName = namesHashMap.get(locationName);
		}

		for (const event of outputJSON?.events || []) {
			for (const page of event?.pages || []) {
				for (const item of page.list) {
					const code = item.code;

					for (const [pr, parameter] of item.parameters.entries()) {
						switch (code) {
							case 102:
								if (Array.isArray(parameter)) {
									for (const [p, param] of parameter.entries()) {
										if (typeof param === "string") {
											if (textHashMap.has(param.replaceAll("\\n[", "\\N["))) {
												item.parameters[pr][p] = textHashMap.get(
													param.replaceAll("\\n[", "\\N[")
												);
											} else {
												console.warn("102", param);
											}
										}
									}
								}
								break;
							case 401:
								if (textHashMap.has(parameter.replaceAll("\\n[", "\\N["))) {
									item.parameters[0] = textHashMap.get(parameter.replaceAll("\\n[", "\\N["));
								} else {
									console.warn("401", parameter);
								}
								break;
							case 402:
								if (
									typeof parameter === "string" &&
									textHashMap.has(parameter.replaceAll("\\n[", "\\N["))
								) {
									item.parameters[1] = textHashMap.get(parameter.replaceAll("\\n[", "\\N["));
								} else if (typeof parameter === "string") {
									console.warn("402", parameter);
								}
								break;
							case 356:
								if (
									parameter.startsWith("GabText") ||
									(parameter.startsWith("choice_text") && !parameter.endsWith("????"))
								) {
									if (textHashMap.has(parameter.replaceAll("\\n[", "\\N["))) {
										item.parameters[0] = textHashMap.get(parameter.replaceAll("\\n[", "\\N["));
									} else {
										console.warn("356", parameter);
									}
								}
								break;
						}
					}
				}
			}
		}
		Deno.writeTextFileSync(outputPath, JSON.stringify(outputJSON));
		console.log(`Записан файл ${filenames[f]}.`);
	}
	return;
}

function writeOther(files, originalTextFile, translatedTextFile) {
	const filenames = [...Deno.readDirSync(dirPaths.original)]
		.map((entry) => entry.name)
		.filter((file) => {
			return (
				!file.startsWith("Map") &&
				!file.startsWith("Tilesets") &&
				!file.startsWith("Animations") &&
				!file.startsWith("States") &&
				!file.startsWith("System")
			);
		});

	const originalText = [...Deno.readDirSync(originalTextFile)]
		.map((entry) => {
			if (entry.name.endsWith("_trans.txt") || entry.name.startsWith("System")) return undefined;
			return Deno.readTextFileSync(join(originalTextFile, entry.name)).split("\n");
		})
		.filter((element) => element !== undefined);

	const translatedText = [...Deno.readDirSync(translatedTextFile)]
		.map((entry) => {
			if (!entry.name.endsWith("_trans.txt") || entry.name.startsWith("System")) return undefined;
			return Deno.readTextFileSync(join(translatedTextFile, entry.name)).split("\n");
		})
		.filter((element) => element !== undefined);

	for (const [f, file] of files.entries()) {
		const outputJSON = file;
		const outputDir = dirPaths.output;

		const hashMap = new Map(
			originalText[f].map((item, i) => [
				item.replaceAll("\\n", "\n"),
				translatedText[f][i].replaceAll("\\n", "\n"),
			])
		);
		ensureDirSync(outputDir);

		const outputPath = join(outputDir, filenames[f]);

		for (const element of outputJSON) {
			if (!element) continue;

			if (!element.pages) {
				if (!element.list) {
					const attributes = ["name", "description", "note"];
					for (const attr of attributes) {
						if (
							element[attr] &&
							(!isUselessLine(element[attr]) ||
								element[attr].startsWith("Alchem") ||
								element[attr].startsWith("Recipes") ||
								attr === "note")
						) {
							if (hashMap.has(element[attr])) {
								element[attr] = hashMap.get(element[attr]);
							} else {
								console.warn(element[attr]);
							}
						}
					}
				} else {
					const name = element.name;
					if (name && !isUselessLine(name)) {
						if (hashMap.has(name)) {
							element.name = hashMap.get(name);
						} else {
							console.warn(name);
						}
					}
				}
			}

			const pagesLength = element.pages !== undefined ? element.pages.length : 1;
			for (let i = 0; i < pagesLength; i++) {
				const iterableObj = pagesLength !== 1 ? element.pages[i] : element;

				for (const list of iterableObj.list || []) {
					const code = list.code;

					for (const [pr, parameter] of list.parameters.entries()) {
						switch (code) {
							case 102:
								if (Array.isArray(parameter)) {
									for (const [p, param] of parameter.entries()) {
										if (typeof param === "string") {
											if (hashMap.has(param.replaceAll("\\n[", "\\N["))) {
												list.parameters[pr][p] = hashMap.get(param.replaceAll("\\n[", "\\N["));
											} else {
												console.warn(param);
											}
										}
									}
								}
								break;
							case 401:
								if (typeof parameter === "string") {
									if (hashMap.has(parameter.replaceAll("\\n[", "\\N["))) {
										list.parameters[0] = hashMap.get(parameter.replaceAll("\\n[", "\\N["));
									} else {
										console.warn(parameter);
									}
								}
								break;
							case 402:
								if (typeof parameter === "string") {
									if (hashMap.has(parameter.replaceAll("\\n[", "\\N["))) {
										list.parameters[1] = hashMap.get(parameter.replaceAll("\\n[", "\\N["));
									} else {
										console.warn(parameter);
									}
								}
								break;
							case 356:
								if (
									(parameter.startsWith("choice_text") || parameter.startsWith("GabText")) &&
									!parameter.endsWith("????")
								) {
									if (hashMap.has(parameter.replaceAll("\\n[", "\\N["))) {
										list.parameters[0] = hashMap.get(parameter.replaceAll("\\n[", "\\N["));
									} else {
										console.warn(parameter);
									}
								}
								break;
						}
					}
				}
			}
		}
		Deno.writeTextFileSync(outputPath, JSON.stringify(outputJSON));
		console.log(`Записан файл ${filenames[f]}.`);
	}
	return;
}

function writeSystem(file, originalTextFile, translatedTextFile) {
	const outputJSON = file;
	const originalText = Deno.readTextFileSync(originalTextFile).split("\n");
	const translatedText = Deno.readTextFileSync(translatedTextFile).split("\n");
	const hashMap = new Map(originalText.map((item, i) => [item, translatedText[i]]));

	for (const [el, element] of outputJSON.equipTypes.entries()) {
		if (element && hashMap.has(element)) {
			outputJSON.equipTypes[el] = hashMap.get(element);
		}
	}

	for (const [el, element] of outputJSON.skillTypes.entries()) {
		if (element && hashMap.has(element)) {
			outputJSON.skillTypes[el] = hashMap.get(element);
		}
	}

	for (const key in outputJSON.terms) {
		if (key !== "messages") {
			for (const [i, str] of outputJSON.terms[key].entries()) {
				if (str && hashMap.has(str)) {
					outputJSON.terms[key][i] = hashMap.get(str);
				}
			}
		} else {
			for (const messageKey in outputJSON.terms.messages) {
				const message = outputJSON.terms.messages[messageKey];
				if (message && hashMap.has(message)) {
					outputJSON.terms.messages[messageKey] = hashMap.get(message);
				}
			}
		}
	}

	Deno.writeTextFileSync(join(dirPaths.output, "System.json"), JSON.stringify(outputJSON));
	console.log("Записан файл System.json.");
	return;
}

function writePlugins(file, originalTextFile, translatedTextFile) {
	const outputJSON = file;
	const originalText = Array.from(new Set(Deno.readTextFileSync(originalTextFile).split("\n")));
	const translatedText = Array.from(new Set(Deno.readTextFileSync(translatedTextFile).split("\n")));
	const hashMap = new Map(originalText.map((item, i) => [item, translatedText[i]]));

	for (const obj of outputJSON) {
		const name = obj.name;
		if (
			[
				"YEP_BattleEngineCore",
				"YEP_OptionsCore",
				"SRD_NameInputUpgrade",
				"YEP_KeyboardConfig",
				"YEP_ItemCore",
				"YEP_X_ItemDiscard",
				"YEP_EquipCore",
				"YEP_ItemSynthesis",
				"ARP_CommandIcons",
				"YEP_X_ItemCategories",
				"Olivia_OctoBattle",
			].includes(name)
		) {
			for (const key in obj.parameters) {
				const param = obj.parameters[key];
				if (hashMap.has(param)) {
					obj.parameters[key] = hashMap.get(param);
				}
			}
		}
	}

	const prefix = "// Generated by RPG Maker.\n// Do not edit this file directly.\nvar $plugins =\n";
	Deno.writeTextFileSync(join("./js", "plugins.js"), prefix + JSON.stringify(outputJSON));
	console.log("Записан файл plugins.js.");
	return;
}

writeMaps(mapsJSON, dirPaths.maps, dirPaths.mapsTrans);
writeOther(otherJSON, dirPaths.other, dirPaths.other);
writeSystem(systemJSON, join(dirPaths.other, "System.txt"), join(dirPaths.other, "System_trans.txt"));
writePlugins(pluginsJSON, join(dirPaths.plugins, "plugins.txt"), join(dirPaths.plugins, "plugins_trans.txt"));

console.log("Все файлы успешно записаны.");
console.log("Потрачено времени: " + (Date.now() - start) / 1000 + " секунд.");

setTimeout(() => {
	Deno.exit();
}, 3000);
