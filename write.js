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

function rmConMap401(file) {
	const newjson = JSON.parse(Deno.readTextFileSync(file));

	for (const [ev, event] of newjson?.events?.entries() || []) {
		for (const [pg, page] of event?.pages?.entries() || []) {
			const newArray = merge401(page.list);
			newjson.events[ev].pages[pg].list = newArray;
		}
	}
	return newjson;
}
function rmConOther401(file) {
	const newjson = JSON.parse(Deno.readTextFileSync(file));

	for (const element of newjson) {
		if (element?.pages) {
			for (const [pg, page] of element.pages.entries()) {
				const newArray = merge401(page.list);
				element.pages[pg].list = newArray;
			}
		} else if (!element?.pages) {
			if (element?.list) {
				const newArray = merge401(element.list);
				element.list = newArray;
			}
		}
	}

	return newjson;
}

const dirs = {
	original: join(Deno.cwd(), "./original"),
	output: join(Deno.cwd(), "./data"),
	maps: join(Deno.cwd(), "./maps/maps.txt"),
	maps_trans: join(Deno.cwd(), "./maps/maps_trans.txt"),
	names: join(Deno.cwd(), "./maps/names.txt"),
	names_trans: join(Deno.cwd(), "./maps/names_trans.txt"),
	other: join(Deno.cwd(), "./other"),
};

const jsonMaps = [...Deno.readDirSync(dirs.original)]
	.map((entry) => entry.name)
	.filter((file) => {
		return file.startsWith("Map");
	})
	.map((file) => {
		return rmConMap401(join(dirs.original, file));
	});

const jsonOther = [...Deno.readDirSync(dirs.original)]
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
		return rmConOther401(join(dirs.original, file));
	});

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
		].includes(line) ||
		line.startsWith("??") ||
		line.startsWith("RANDOM") ||
		line.startsWith("Empty scroll") ||
		line.startsWith("TALK")
	);
}

function jsonWriteMaps(files, ogfile, transfile) {
	const filenames = [...Deno.readDirSync(dirs.original)]
		.map((entry) => entry.name)
		.filter((file) => {
			return file.startsWith("Map");
		});

	const transog = Deno.readTextFileSync(ogfile).split("\n");
	const trans = Deno.readTextFileSync(transfile).split("\n");
	const translationHashmap = new Map();
	for (let i = 0; i < transog.length; i++) {
		translationHashmap.set(transog[i].trim(), trans[i].replaceAll("\\n", "\n").trim());
	}

	const locnames = Deno.readTextFileSync(dirs.names).split("\n");
	const locnamestrans = Deno.readTextFileSync(dirs.names_trans).split("\n");
	const namesHashmap = new Map();
	for (let i = 0; i < locnames.length; i++) {
		namesHashmap.set(locnames[i].trim(), locnamestrans[i].trim());
	}

	for (const [f, file] of files.entries()) {
		const newjson = file;
		const outputFolderPath = dirs.output;

		ensureDirSync(outputFolderPath);

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
		Deno.writeTextFileSync(outputPath, JSON.stringify(newjson));
		console.log(`Записан файл ${filenames[f]}.`);
	}
	return;
}
function jsonWriteOther(files, ogfile, transfile) {
	const filenames = [...Deno.readDirSync(dirs.original)]
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

	const transog = [];
	for (const entry of Deno.readDirSync(ogfile)) {
		if (entry.name.endsWith("_trans.txt")) continue;
		transog.push(entry.name);
	}
	for (let i = 0; i < transog.length; i++) {
		const element = transog[i];
		transog[i] = Deno.readTextFileSync(join(ogfile, element)).split("\n");
	}

	const trans = [];
	for (const entry of Deno.readDirSync(transfile)) {
		if (!entry.name.endsWith("_trans.txt")) continue;
		trans.push(entry.name);
	}
	for (let i = 0; i < trans.length; i++) {
		const element = trans[i];
		trans[i] = Deno.readTextFileSync(join(transfile, element)).split("\n");
	}

	for (const [f, file] of files.entries()) {
		const newjson = file;
		const outputFolderPath = dirs.output;

		const hashmap = new Map();
		for (let i = 0; i < transog[f].length; i++) {
			hashmap.set(transog[f][i].replaceAll("\\n", "\n"), trans[f][i].replaceAll("\\n", "\n"));
		}

		ensureDirSync(outputFolderPath);

		const outputPath = join(outputFolderPath, filenames[f]);

		for (const element of newjson) {
			if (!element) continue;

			if (!element.pages) {
				if (!element.list) {
					const attributes = ["name", "description", "note"];
					for (const attr of attributes) {
						if (element[attr] && (!isUselessLine(element[attr]) || attr === "note")) {
							if (hashmap.has(element[attr])) {
								element[attr] = hashmap.get(element[attr]);
							} else {
								console.log(element[attr]);
							}
						}
					}
				} else if (element.list) {
					if (element.name && !isUselessLine(element.name)) {
						if (hashmap.has(element.name)) {
							element.name = hashmap.get(element.name);
						} else {
							console.log(element.name);
						}
					}

					for (const list of element.list || []) {
						const code = list.code;

						for (const parameter of list.parameters) {
							if (code === 102 && Array.isArray(parameter)) {
								for (const param of parameter) {
									if (typeof param === "string") {
										if (hashmap.has(param.replaceAll("\\n[", "\\N["))) {
											list.parameters[parameter.indexOf(param)] = hashmap.get(
												param.replaceAll("\\n[", "\\N[")
											);
										} else {
											console.log(param);
										}
									}
								}
							} else if (code !== 102) {
								if (code === 401) {
									if (typeof parameter === "string") {
										if (hashmap.has(parameter.replaceAll("\\n[", "\\N["))) {
											list.parameters[0] = hashmap.get(parameter.replaceAll("\\n[", "\\N["));
										} else {
											console.log(parameter);
										}
									}
								} else if (code !== 401) {
									if (typeof parameter === "string") {
										if (code === 402) {
											if (hashmap.has(parameter.replaceAll("\\n[", "\\N["))) {
												list.parameters[1] = hashmap.get(parameter.replaceAll("\\n[", "\\N["));
											} else {
												console.log(parameter);
											}
										} else if (code === 356) {
											if (
												(parameter.startsWith("choice_text") ||
													parameter.startsWith("GabText")) &&
												!parameter.endsWith("????")
											) {
												if (hashmap.has(parameter.replaceAll("\\n[", "\\N["))) {
													list.parameters[0] = hashmap.get(
														parameter.replaceAll("\\n[", "\\N[")
													);
												} else {
													console.log(parameter);
												}
											}
										}
									}
								}
							}
						}
					}
				}
			} else if (element.pages) {
				for (const page of element.pages) {
					for (const list of page.list || []) {
						const code = list.code;

						for (const [pr, parameter] of list.parameters.entries()) {
							if (code === 102 && Array.isArray(parameter)) {
								for (const [p, param] of parameter.entries()) {
									if (typeof param === "string") {
										if (hashmap.has(param.replaceAll("\\n[", "\\N["))) {
											list.parameters[pr][p] = hashmap.get(param.replaceAll("\\n[", "\\N["));
										} else {
											console.log(param);
										}
									}
								}
							} else if (code !== 102) {
								if (code === 401) {
									if (typeof parameter === "string") {
										if (hashmap.has(parameter.replaceAll("\\n[", "\\N["))) {
											list.parameters[0] = hashmap.get(parameter.replaceAll("\\n[", "\\N["));
										} else {
											console.log(parameter);
										}
									}
								} else if (code !== 401) {
									if (typeof parameter === "string") {
										if (code === 402) {
											if (hashmap.has(parameter.replaceAll("\\n[", "\\N["))) {
												list.parameters[1] = hashmap.get(parameter.replaceAll("\\n[", "\\N["));
											} else {
												console.log(parameter);
											}
										} else if (code === 356) {
											if (
												(parameter.startsWith("choice_text") ||
													parameter.startsWith("GabText")) &&
												!parameter.endsWith("????")
											) {
												if (hashmap.has(parameter.replaceAll("\\n[", "\\N["))) {
													list.parameters[0] = hashmap.get(
														parameter.replaceAll("\\n[", "\\N[")
													);
												} else {
													console.log(parameter);
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}
		}
		Deno.writeTextFileSync(outputPath, JSON.stringify(newjson));
		console.log(`Записан файл ${filenames[f]}.`);
	}
	return;
}

jsonWriteMaps(jsonMaps, dirs.maps, dirs.maps_trans);
jsonWriteOther(jsonOther, dirs.other, dirs.other);

console.log("Все файлы успешно записаны.");
console.log("Потрачено времени: " + (Date.now() - start) / 1000 + " секунд.");

setTimeout(() => {
	Deno.exit();
}, 3000);
