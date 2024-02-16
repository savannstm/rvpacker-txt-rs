const fs = require("fs");
const path = require("path");

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

	const newJSONData = JSON.parse(fs.readFileSync(file, "utf8"));

	for (const [ev, event] of newJSONData?.events?.entries() || []) {
		for (const [pg, page] of event?.pages?.entries() || []) {
			const newArray = mergeConsequent401Objects(page.list);
			newJSONData.events[ev].pages[pg].list = newArray;
		}
	}

	return newJSONData;
}

const jsonObjects = fs
	.readdirSync(path.join(__dirname, "./original"))
	.filter((file) => {
		return file.startsWith("Map");
	})
	.map((file) => {
		return removeConsequent401(path.join(__dirname, "./original", file), "utf8");
	});

function jsonWrite(files, transfileog, transfile) {
	const transog = fs.readFileSync(transfileog, "utf8").split("\n");
	const trans = fs.readFileSync(transfile, "utf8").split("\n");
	const filenames = fs.readdirSync(path.join(__dirname, "./original")).filter((file) => {
		return file.startsWith("Map");
	});
	const locnames = fs.readFileSync(path.join(__dirname, "./names.txt"), "utf8").split("\n");
	const locnamestrans = fs.readFileSync(path.join(__dirname, "./names_trans.txt"), "utf8").split("\n");

	for (const [f, file] of files.entries()) {
		const newjson = file;
		const outputPath = path.join(__dirname, "./output", filenames[f]);
		const locationName = newjson?.displayName;

		for (let i = 0; i < locnames.length; i++) {
			if (JSON.stringify(locationName) !== undefined && JSON.stringify(locationName).length < 3) {
				break;
			}
			if (locationName !== undefined && locnames[i].trim() === locationName.trim()) {
				newjson.displayName = locnamestrans[i];
				break;
			} else if (i === locnames.length - 1) {
				console.log(JSON.stringify(locationName));
				console.log(locnames[i]);
			}
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
										for (let i = 0; i < transog.length; i++) {
											{
												if (param.replaceAll("\n", "\\n").trim() === transog[i].trim()) {
													item.parameters[pr][p] = trans[i].replaceAll("\\n", "\n");
													break;
												} else if (i === transog.length - 1) {
													console.log(param, transog[i]);
												}
											}
										}
									}
								}
							}
						} else if ([401, 402, 356].includes(code)) {
							if (code === 401) {
								for (let i = 0; i < transog.length; i++) {
									if (parameter.replaceAll("\n", "\\n").trim() === transog[i].trim()) {
										item.parameters[0] = trans[i].replaceAll("\\n", "\n");
										break;
									} else if (i === transog.length - 1) {
										console.log("401");
										console.log(parameter.replaceAll("\n", "\\n").trim(), transog[i]);
									}
								}
							} else if (code === 402) {
								for (let i = 0; i < transog.length; i++) {
									if (
										typeof parameter === "string" &&
										parameter.replaceAll("\n", "\\n").trim() === transog[i].trim()
									) {
										item.parameters[1] = trans[i].replaceAll("\\n", "\n");
										break;
									} else if (typeof parameter === "string" && i === transog.length - 1) {
										console.log("402");
										console.log(parameter.replaceAll("\n", "\\n").trim(), transog[i]);
									}
								}
							} else if (code === 356) {
								if (
									parameter.startsWith("GabText") ||
									(parameter.startsWith("choice_text") && !parameter.endsWith("????"))
								) {
									for (let i = 0; i < transog.length; i++) {
										if (parameter.replaceAll("\n", "\\n").trim() === transog[i].trim()) {
											item.parameters[0] = trans[i].replaceAll("\\n", "\n");
											break;
										} else if (i === transog.length - 1) {
											console.log("356");
											console.log(parameter.replaceAll("\n", "\\n").trim(), transog[i]);
										}
									}
								}
							}
						}
					}
				}
			}
		}
		fs.writeFileSync(outputPath, JSON.stringify(newjson));
	}
}

jsonWrite(jsonObjects, path.join(__dirname, "./maps.txt"), path.join(__dirname, "./maps_trans.txt"));
