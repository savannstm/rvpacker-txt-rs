const { join } = require("path");
const {
	readFileSync,
	writeFileSync,
	readdirSync,
	ensureDirSync,
	copyFileSync
} = require("fs-extra");
const { spawn } = require("child_process");

function render() {
	copy();

	// TODO: Make variable names better
	const contentContainer = document.getElementById("content-container");
	const leftPanelElements =
		document.getElementsByClassName("left-panel-element");
	const searchBtn = document.getElementById("search");
	const searchInput = document.getElementById("search-input");
	const replaceBtn = document.getElementById("replace");
	const replaceInput = document.getElementById("replace-input");
	const menuBtn = document.getElementById("menu-button");
	const leftPanel = document.getElementById("left-panel");
	const pageLoaded = document.getElementById("is-loaded");
	const searchPanel = document.getElementById("search-results");
	const currentState = document.getElementById("current-state");
	const saveBtn = document.getElementById("save");
	const compileBtn = document.getElementById("compile");
	const optionsBtn = document.getElementById("options");
	const optionsMenu = document.getElementById("options-menu");
	const searchCaseBtn = document.getElementById("case");
	const searchWholeBtn = document.getElementById("whole");
	const searchRegexBtn = document.getElementById("regex");
	const searchTransBtn = document.getElementById("translate");
	const backupCheck = document.getElementById("backup-check");
	const editOrigCheck = document.getElementById("edit-orig-check");
	const backupSettings = document.getElementById("backup-settings");
	const backupPeriodInput = document.getElementById("backup-period-input");
	const backupMaxInput = document.getElementById("backup-max-input");
	const appSettings = JSON.parse(readFileSync("settings.json", "utf-8"));

	/** @type {boolean} */
	let backupState = appSettings.backup.enabled;
	/** @type {number} */
	let backupPeriod = appSettings.backup.period;
	/** @type {number} */
	let backupMax = appSettings.backup.max;
	/** @type {boolean} */
	let editOrig = appSettings.editOrig;
	/** @type {string} */
	let workingDir = appSettings.workingDir;
	let searchRegex = false;
	let searchWhole = false;
	let searchCase = false;
	let searchTranslate = false;
	let optionsOpened = false;

	if (backupState) {
		backupCheck.innerHTML = "check";
		backupSettings.classList.remove("hidden");
	} else {
		backupCheck.innerHTML = "close";
		backupSettings.classList.add("hidden");
	}

	backupPeriodInput.value = backupPeriod;
	backupMaxInput.value = backupMax;

	if (editOrig) {
		editOrigCheck.innerHTML = "check";
	} else {
		editOrigCheck.innerHTML = "close";
	}

	let nextBackupNumber = parseInt(determineLastBackupNumber()) + 1;

	createContent(workingDir);

	if (backupState) backup(backupPeriod);

	// !!! this shit DOES NOT fucking WORK
	// !!! IT SHOULD BE FUCKING FIXED ASAP !!!
	// !!! AND AFTER IT'S FIXED, THE SAME SHIT MUST BE REMOVED FROM updateStateCallback() !!!
	function absolutize() {
		const childYCoordinates = new Map();

		window.scrollTo(0, 0);
		const pageLengths = [];
		for (const child of contentContainer.childNodes) {
			child.classList.remove("hidden");
			const nodeYCoordinates = new Map();
			pageLengths.push(child.clientHeight);

			for (const node of child.childNodes) {
				const nodeYCoordinate =
					node.getBoundingClientRect().y +
					node.getBoundingClientRect().height;
				nodeYCoordinates.set(node.id, nodeYCoordinate);
			}
			child.classList.add("hidden");

			for (const node of child.childNodes) {
				node.classList.add("hidden");
				node.classList.add("absolute");
				node.style.top = `${nodeYCoordinates.get(node.id)}px`;
			}

			childYCoordinates.set(child.id, nodeYCoordinates);
		}
		for (const [i, child] of contentContainer.childNodes.entries()) {
			child.style.height = pageLengths[i] + "px";
		}

		return childYCoordinates;
	}

	function determineLastBackupNumber() {
		const backupDir = "./backups";
		const backups = readdirSync(backupDir);

		if (backups.length === 0) {
			return "00";
		} else {
			return backups
				.map((backup) => backup.slice(-2))
				.sort((a, b) => b - a)[0];
		}
	}

	/**
	 * @param {Object<string, string>} paths
	 * @returns {Map<string, string[]>}
	 */
	function readFiles(paths) {
		const entries = Object.entries(paths);
		const resultMap = new Map();

		for (const [key, filePath] of entries) {
			resultMap.set(key, readFileSync(filePath, "utf-8").split("\n"));
		}

		return resultMap;
	}

	/**
	 * @param {Map<HTMLElement, string>} map
	 * @param {string} text
	 * @param {HTMLElement} node
	 * @returns {void}
	 */
	function setMatches(map, text, node) {
		// TODO: Refactor this into a function
		const regex = {
			text: text,
			attr: "i"
		};

		if (searchRegex) {
			regex.text = text;
			regex.attr = "";
		} else {
			if (searchCase) {
				regex.attr = "";
			}
			if (searchWhole) {
				regex.text = `\\b${text}\\b`;
			}
		}

		for (const textarea of node.childNodes) {
			const expr = new RegExp(regex.text, regex.attr);
			const result = textarea.value.search(expr);

			if (result !== -1) {
				const before = textarea.value.substring(0, result);
				const after = textarea.value.substring(result + text.length);

				const output = [
					`<div class="inline">${before}</div>`,
					`<div class="inline bg-gray-500">${text}</div>`,
					`<div class="inline">${after}</a>`
				];

				map.set(textarea, output.join(""));
			}
		}
	}

	/**
	 * @param {string} text
	 * @returns {Map<HTMLElement, string>}
	 */
	function searchText(text) {
		/**
		 * @type { Map<HTMLElement, string> }
		 */
		const matches = new Map();

		for (const child of contentContainer.childNodes) {
			for (const node of child.childNodes) {
				if (searchTranslate) {
					if (node.id.endsWith("translated")) {
						setMatches(matches, text, node);
					}
				} else {
					setMatches(matches, text, node);
				}
			}
		}

		return matches;
	}

	/**
	 * @param {string} id
	 * @returns {HTMLElement | null}
	 */
	// ? This function is fine, i guess?
	function findCounterpart(id) {
		if (id.includes("original")) {
			return document.getElementById(
				id.replace("original", "translated")
			);
		} else {
			return document.getElementById(
				id.replace("translated", "original")
			);
		}
	}

	// TODO: Make something with this mess
	function displaySearchResults(text) {
		const results = searchText(text);

		if (results.size === 0) {
			searchPanel.innerHTML = `<div class="flex justify-center items-center h-full">Нет совпадений</div>`;
		} else {
			for (const [element, result] of results) {
				const resultElement = document.createElement("div");
				resultElement.classList.add(
					"text-white",
					"text-xl",
					"cursor-pointer",
					"bg-gray-700",
					"my-1",
					"p-1",
					"border-2",
					"border-gray-600",
					"hidden"
				);

				resultElement.addEventListener("click", () => {
					/** @type {HTMLElement} */
					const grandParent = element.parentNode.parentNode;
					grandParent.classList.remove("hidden");

					element.scrollIntoView({ block: "center" });
					element.focus();
				});

				const counterpart = findCounterpart(element.id);

				/**
				 * @param {HTMLElement} el
				 * @returns {[parentId: string, id: string]}
				 */
				function extractInfo(el) {
					const parts = el.id.split("-");
					const parentId = parts[parts.length - 2];
					const id = parts[parts.length - 1];
					return [parentId, id];
				}

				const [elementParentId, elementId] = extractInfo(element);
				const [counterpartParentId, counterpartId] =
					extractInfo(counterpart);

				resultElement.innerHTML = `
					<div class="text-base">${result}</div>
					<div class="text-xs text-gray-400">${element.parentNode.parentNode.id} - ${elementParentId} - ${elementId}</div>
					<div class="flex justify-center items-center text-xl text-white font-material">arrow_downward</div>
					<div class="text-base">${counterpart.value}</div>
					<div class="text-xs text-gray-400">${counterpart.parentNode.parentNode.id} - ${counterpartParentId} - ${counterpartId}</div>
				`;

				searchPanel.appendChild(resultElement);
			}
		}
		searchPanel.classList.remove("translate-x-full");
		searchPanel.classList.add("translate-x-0");

		searchPanel.addEventListener(
			"transitionend",
			function handleTransitionEnd() {
				for (const child of searchPanel.childNodes) {
					child.classList.remove("hidden");
				}
				searchPanel.removeEventListener(
					"transitionend",
					handleTransitionEnd
				);
			}
		);
		return;
	}

	/**
	 *
	 * @param {string} text
	 * @returns {void}
	 */
	function replaceText(text) {
		const results = searchText(text);

		// TODO: Refactor into a function
		const regex = {
			text: text,
			attr: "i"
		};

		if (searchRegex) {
			regex.text = text;
			regex.attr = "";
		} else {
			if (searchCase) {
				regex.attr = "";
			}
			if (searchWhole) {
				regex.text = `\\b${text}\\b`;
			}
		}

		if (results.size === 0) {
			return;
		} else {
			for (const textarea of results.keys()) {
				const newValue = textarea.value.replaceAll(
					new RegExp(regex.text, regex.attr + "g"),
					replaceInput.value
				);

				if (newValue) {
					textarea.value = newValue;
				}
			}
		}

		return;
	}

	/**
	 * @param {Map<string, string>} paths
	 * @returns {boolean}
	 */
	function isCopied(paths) {
		ensureDirSync(paths.get("copies"));
		ensureDirSync(paths.get("copiesMaps"));
		ensureDirSync(paths.get("copiesOther"));

		const copiesMapsLength = readdirSync(paths.get("copiesMaps")).length;
		const mapsLength = readdirSync(paths.get("maps")).length;
		const copiesOtherLength = readdirSync(paths.get("copiesOther")).length;
		const otherLength = readdirSync(paths.get("other")).length;

		if (
			copiesMapsLength === mapsLength &&
			copiesOtherLength === otherLength
		) {
			return true;
		}

		console.log("Files are not copied yet.");
		return false;
	}

	// TODO: Make it more readable
	function copy() {
		const paths = new Map([
			["maps", "./maps"],
			["other", "./other"],
			["copies", "./copies"],
			["copiesMaps", "./copies/maps"],
			["copiesOther", "./copies/other"]
		]);

		if (isCopied(paths)) {
			console.log("Files are already copied.");
			return;
		}
		console.log("Copying files...");

		for (const file of readdirSync(paths.get("maps"))) {
			copyFileSync(
				join(paths.get("maps"), file),
				join(paths.get("copiesMaps"), file)
			);
		}

		for (const file of readdirSync(paths.get("other"))) {
			copyFileSync(
				join(paths.get("other"), file),
				join(paths.get("copiesOther"), file)
			);
		}

		return;
	}

	// ? Shorten and make more readable?
	function save(backup = false) {
		saveBtn.classList.add("animate-spin");

		setTimeout(() => {
			const fileMappings = {
				"maps-content": "./maps/maps_trans.txt",
				"maps-names-content": "./maps/names_trans.txt",
				"actors-content": "./other/Actors_trans.txt",
				"armors-content": "./other/Armors_trans.txt",
				"classes-content": "./other/Classes_trans.txt",
				"common-events-content": "./other/CommonEvents_trans.txt",
				"enemies-content": "./other/Enemies_trans.txt",
				"items-content": "./other/Items_trans.txt",
				"skills-content": "./other/Skills_trans.txt",
				"system-content": "./other/System_trans.txt",
				"troops-content": "./other/Troops_trans.txt",
				"weapons-content": "./other/Weapons_trans.txt"
			};

			let dirName = workingDir;

			if (backup) {
				const date = new Date();

				const dateProperties = {
					year: date.getFullYear(),
					month: date.getMonth() + 1,
					day: date.getDate(),
					hour: date.getHours(),
					minute: date.getMinutes(),
					second: date.getSeconds()
				};

				for (const [key, value] of Object.entries(dateProperties)) {
					dateProperties[key] = value.toString().padStart(2, "0");
				}

				if (nextBackupNumber === 99) {
					nextBackupNumber = 1;
				}
				const backupFolderName = `${Object.values(dateProperties).join(
					"-"
				)}_${nextBackupNumber.toString().padStart(2, "0")}`;
				nextBackupNumber++;

				dirName = join("./backups", backupFolderName);

				ensureDirSync(join(dirName, "maps"), {
					recursive: true
				});

				ensureDirSync(join(dirName, "other"), {
					recursive: true
				});
			}

			for (const child of contentContainer.childNodes) {
				const outputArray = Array.from(child.childNodes)
					.filter(
						(node) => node.id.split("-").at(-1) === "translated"
					)
					.flatMap((node) =>
						Array.from(node.childNodes).map((textarea) =>
							textarea.value.replaceAll("\n", "\\n")
						)
					);

				const filePath = fileMappings[child.id];

				if (filePath) {
					const dir = join(dirName, filePath);

					writeFileSync(dir, outputArray.join("\n"), "utf-8");
				}
			}
			setTimeout(() => {
				saveBtn.classList.remove("animate-spin");
			}, 1000);
		});
		return;
	}

	function backup(s) {
		if (backupState) {
			setTimeout(() => {
				save(true, { backupMax });
				backup(s);
			}, s * 1000);
		} else {
			return;
		}
	}

	/**
	 * @param {string} id
	 * @param {string} originalText
	 * @param {string} translatedText
	 */
	function createTextAreasChild(id, originalText, translatedText) {
		const content = document.createElement("div");
		content.id = id;
		content.classList.add("hidden", "flex", "flex-col");

		for (const [i, text] of originalText.entries()) {
			const contentParent = document.createElement("div");
			contentParent.id = `${id}-${i}`;
			contentParent.classList.add("w-full", "z-10");

			const contentChild = document.createElement("div");
			contentChild.classList.add("flex", "flex-row");

			//* Original text field
			const originalTextInput = document.createElement("textarea");
			const splittedText = text.split("\\n");
			originalTextInput.id = `${id}-original-${i}`;
			originalTextInput.value = splittedText.join("\n");
			originalTextInput.classList.add("text-field", "mr-2");

			//* If original field is not editable, make it read-only and cursor-default
			if (!editOrig) {
				originalTextInput.readOnly = true;
				originalTextInput.classList.add("cursor-default");
			}

			//* Translated text field
			const translatedTextInput = document.createElement("textarea");
			const splittedTranslatedText = translatedText[i].split("\\n");
			translatedTextInput.id = `${id}-translated-${i}`;
			translatedTextInput.value = splittedTranslatedText.join("\n");
			translatedTextInput.classList.add("text-field");

			//* Row field
			const row = document.createElement("textarea");
			row.id = `${id}-row-${i}`;
			row.value = i;
			row.readOnly = true;
			row.classList.add("row-field");

			//* All textareas should have the same number of rows
			const maxRows = Math.max(
				splittedText.length,
				splittedTranslatedText.length
			);
			originalTextInput.rows = maxRows;
			translatedTextInput.rows = maxRows;
			row.rows = maxRows;

			contentChild.appendChild(row);
			contentChild.appendChild(originalTextInput);
			contentChild.appendChild(translatedTextInput);
			contentParent.appendChild(contentChild);
			content.appendChild(contentParent);
		}

		contentContainer.appendChild(content);
	}

	/**
	 * @param {number} yCoordinate
	 * @returns {boolean}
	 */
	function isInViewport(yCoordinate) {
		return (
			yCoordinate >= window.scrollY &&
			yCoordinate < window.scrollY + window.innerHeight
		);
	}

	// TODO: Optimize for better performance
	/**
	 * @param {Map<string, number>} map
	 * @returns {void}
	 */
	function handleElementRendering(map) {
		for (const [node, y] of map) {
			const element = document.getElementById(node);

			if (isInViewport(y)) {
				element.classList.remove("hidden");
			} else {
				element.classList.add("hidden");
			}
		}
		return;
	}

	// !!! TODO: FUCKING REWRITE THIS SHITTY FUNCTION
	/**
	 * @param {string} newState
	 * @param {string} contentId
	 * @param {boolean} slide
	 * @returns {void}
	 */
	function updateStateCallback(newState, contentId, slide) {
		const contentParent = document.getElementById(contentId);
		contentParent.classList.remove("hidden");
		contentParent.classList.add("flex", "justify-start");

		window.scrollTo(0, 0);
		for (const child of contentContainer.childNodes) {
			const nodeY = new Map();
			function handleWindowScroll() {
				handleElementRendering(nodeY);
			}
			if (child.id !== contentId) {
				child.classList.remove("flex", "flex-row", "justify-start");
				child.classList.add("hidden");
				window.removeEventListener("scroll", handleWindowScroll);
			} else {
				// !!! REMOVE THIS SHIT TO PROGRAM INITIALIZATION
				// !!! THIS IS SO FUCKING DUMB
				const pageLength = child.clientHeight;
				let margin = 0;
				for (const node of child.childNodes) {
					if (node.classList.contains("hidden")) continue;
					const nodeYCoordinate =
						node.getBoundingClientRect().y + margin;
					margin += 8;
					nodeY.set(node.id, nodeYCoordinate);
				}

				for (const node of child.childNodes) {
					if (node.classList.contains("hidden")) continue;
					node.classList.add("hidden");
					node.classList.add("absolute");
					node.style.top = `${nodeY.get(node.id)}px`;
				}

				child.style.height = `${pageLength}px`;
				handleElementRendering(nodeY);

				window.addEventListener("scroll", handleWindowScroll);
			}
		}

		if (slide) {
			leftPanel.classList.toggle("translate-x-0");
			leftPanel.classList.toggle("-translate-x-full");
		}

		pageLoaded.innerHTML = "done";
		pageLoaded.classList.toggle("animate-spin");
		console.log(`Current state is ${newState}`);

		return;
	}

	/**
	 * @param {string} newState
	 * @param {string} contentId
	 * @param {boolean} slide
	 * @returns {void}
	 */
	function updateState(newState, contentId, slide = true) {
		pageLoaded.innerHTML = "refresh";
		pageLoaded.classList.toggle("animate-spin");

		currentState.innerHTML = newState;

		setTimeout(() => {
			updateStateCallback(newState, contentId, slide);
		});

		return;
	}

	/**
	 * @param {string} newState
	 * @param {boolean} [slide=true]
	 * @returns {void}
	 */
	function changeState(newState, slide = true) {
		switch (newState) {
			case "main":
				currentState.innerHTML = "";
				pageLoaded.innerHTML = "check_indeterminate_small";

				for (const node of contentContainer.childNodes) {
					node.classList.remove("flex", "flex-row", "justify-start");
					node.classList.add("hidden");
				}
				break;
			default:
				updateState(newState, `${newState}-content`, slide);
				break;
		}
		return;
	}

	/**
	 * @param {KeyboardEvent} event
	 * @returns {void}
	 */
	function handleKeypressBody(event) {
		switch (event.code) {
			case "Tab":
				leftPanel.classList.toggle("translate-x-0");
				leftPanel.classList.toggle("-translate-x-full");
				break;
			case "KeyR":
				searchPanel.classList.toggle("translate-x-full");
				searchPanel.classList.toggle("translate-x-0");
				searchPanel.addEventListener(
					"transitionend",
					function handleTransitionEnd() {
						for (const child of searchPanel.childNodes) {
							child.classList.toggle("hidden");
						}
						searchPanel.removeEventListener(
							"transitionend",
							handleTransitionEnd
						);
					}
				);
				break;
			case "Digit1":
				changeState("maps", false);
				break;
			case "Digit2":
				changeState("maps-names", false);
				break;
			case "Digit3":
				changeState("actors", false);
				break;
			case "Digit4":
				changeState("armors", false);
				break;
			case "Digit5":
				changeState("classes", false);
				break;
			case "Digit6":
				changeState("common-events", false);
				break;
			case "Digit7":
				changeState("enemies", false);
				break;
			case "Digit8":
				changeState("items", false);
				break;
			case "Digit9":
				changeState("skills", false);
				break;
			case "Digit0":
				changeState("system", false);
				break;
			case "Minus":
				changeState("troops", false);
				break;
			case "Equal":
				changeState("weapons", false);
				break;
			case "KeyS":
				if (event.ctrlKey) {
					save();
				}
				break;
			case "KeyF":
				if (event.ctrlKey) {
					searchInput.focus();
				}
				break;
		}
		return;
	}

	/**
	 * @param {KeyboardEvent} event
	 * @returns {void}
	 */
	function handleKeypressGlobal(event) {
		switch (event.code) {
			case "Escape":
				if (document.activeElement !== document.body) {
					document.activeElement.blur();
				} else {
					changeState("main");
				}
				break;
			case "Enter":
				if (document.activeElement !== document.body) {
					if (event.altKey) {
						const focusedElement = document.activeElement;
						const idParts = focusedElement.id.split("-");
						const index = parseInt(idParts.pop()) + 1;
						const elementToFocusId = document.getElementById(
							`${idParts.join("-")}-${index}`
						);

						if (elementToFocusId) {
							focusedElement.blur();
							elementToFocusId.focus();
							elementToFocusId.setSelectionRange(0, 0);
						}
					}
				}
				break;
		}
		return;
	}

	/**
	 * @param {KeyboardEvent} event
	 * @returns {void}
	 */
	function handleKeypressSearch(event) {
		if (event.code === "Enter") {
			if (searchInput.value) {
				searchPanel.innerHTML = "";
				displaySearchResults(searchInput.value.trim());
			} else {
				searchPanel.innerHTML = `<div class="flex justify-center items-center h-full">Результатов нет</div>`;
			}
		}
		return;
	}

	/**
	 * @param {string} workingDir
	 * @returns {void}
	 */
	// ! Single-call function
	function createContent(workingDir) {
		const paths = {
			originalMapText: join(workingDir, "maps/maps.txt"),
			translatedMapText: join(workingDir, "maps/maps_trans.txt"),
			originalMapNames: join(workingDir, "maps/names.txt"),
			translatedMapNames: join(workingDir, "maps/names_trans.txt"),
			originalActors: join(workingDir, "other/Actors.txt"),
			translatedActors: join(workingDir, "other/Actors_trans.txt"),
			originalArmors: join(workingDir, "other/Armors.txt"),
			translatedArmors: join(workingDir, "other/Armors_trans.txt"),
			originalClasses: join(workingDir, "other/Classes.txt"),
			translatedClasses: join(workingDir, "other/Classes_trans.txt"),
			originalCommonEvents: join(workingDir, "other/CommonEvents.txt"),
			translatedCommonEvents: join(
				workingDir,
				"other/CommonEvents_trans.txt"
			),
			originalEnemies: join(workingDir, "other/Enemies.txt"),
			translatedEnemies: join(workingDir, "other/Enemies_trans.txt"),
			originalItems: join(workingDir, "other/Items.txt"),
			translatedItems: join(workingDir, "other/Items_trans.txt"),
			originalSkills: join(workingDir, "other/Skills.txt"),
			translatedSkills: join(workingDir, "other/Skills_trans.txt"),
			originalSystem: join(workingDir, "other/System.txt"),
			translatedSystem: join(workingDir, "other/System_trans.txt"),
			originalTroops: join(workingDir, "other/Troops.txt"),
			translatedTroops: join(workingDir, "other/Troops_trans.txt"),
			originalWeapons: join(workingDir, "other/Weapons.txt"),
			translatedWeapons: join(workingDir, "other/Weapons_trans.txt")
		};

		const contentTypes = [
			{
				id: "maps-content",
				original: "originalMapText",
				translated: "translatedMapText"
			},
			{
				id: "maps-names-content",
				original: "originalMapNames",
				translated: "translatedMapNames"
			},
			{
				id: "actors-content",
				original: "originalActors",
				translated: "translatedActors"
			},
			{
				id: "armors-content",
				original: "originalArmors",
				translated: "translatedArmors"
			},
			{
				id: "classes-content",
				original: "originalClasses",
				translated: "translatedClasses"
			},
			{
				id: "common-events-content",
				original: "originalCommonEvents",
				translated: "translatedCommonEvents"
			},
			{
				id: "enemies-content",
				original: "originalEnemies",
				translated: "translatedEnemies"
			},
			{
				id: "items-content",
				original: "originalItems",
				translated: "translatedItems"
			},
			{
				id: "skills-content",
				original: "originalSkills",
				translated: "translatedSkills"
			},
			{
				id: "system-content",
				original: "originalSystem",
				translated: "translatedSystem"
			},
			{
				id: "troops-content",
				original: "originalTroops",
				translated: "translatedTroops"
			},
			{
				id: "weapons-content",
				original: "originalWeapons",
				translated: "translatedWeapons"
			}
		];

		const texts = readFiles(paths);

		for (const content of contentTypes) {
			createTextAreasChild(
				content.id,
				texts.get(content.original),
				texts.get(content.translated)
			);
		}
	}

	function compile() {
		compileBtn.classList.add("animate-spin");

		save();
		const writer = spawn("./write.exe");

		writer.on("close", () => {
			compileBtn.classList.remove("animate-spin");
			alert("Все файлы записаны успешно.");
		});
	}

	// ? Better way of handling settings write?
	function showOptions() {
		optionsOpened = !optionsOpened;
		optionsMenu.classList.toggle("hidden");

		if (optionsOpened) {
			document.body.classList.add("overflow-hidden");
		} else {
			document.body.classList.remove("overflow-hidden");
			appSettings.backup.enabled = backupState;
			appSettings.backup.period = backupPeriod;
			appSettings.backup.max = backupMax;
			appSettings.editOrig = editOrig;
			writeFileSync(
				"settings.json",
				JSON.stringify(appSettings, null, 4),
				"utf-8"
			);
		}
	}

	// TODO: Refactor listeners callbacks into their own functions

	document.body.addEventListener("keydown", (event) => {
		if (document.activeElement === document.body) {
			handleKeypressBody(event);
		} else {
			handleKeypressGlobal(event);
		}
	});

	searchInput.addEventListener("keydown", (event) => {
		handleKeypressSearch(event);
	});

	for (let i = 0; i < leftPanelElements.length; i++) {
		leftPanelElements[i].addEventListener("click", () => {
			changeState(leftPanelElements[i].id);
		});
	}

	menuBtn.addEventListener("click", () => {
		leftPanel.classList.toggle("translate-x-0");
		leftPanel.classList.toggle("-translate-x-full");
	});

	searchBtn.addEventListener("click", () => {
		if (searchInput.value) {
			searchPanel.innerHTML = "";
			displaySearchResults(searchInput.value.trim());
		} else if (document.activeElement === document.body) {
			searchInput.focus();
		} else {
			searchPanel.innerHTML = `<div class="flex justify-center items-center h-full">Результатов нет</div>`;
		}
	});

	replaceBtn.addEventListener("click", () => {
		if (searchInput.value && replaceInput.value) {
			replaceText(searchInput.value.trim());
		}
	});

	searchCaseBtn.addEventListener("click", () => {
		if (!searchRegex) {
			searchCase = !searchCase;
			searchCaseBtn.classList.toggle("bg-gray-500");
		}
	});

	searchWholeBtn.addEventListener("click", () => {
		if (!searchRegex) {
			searchWhole = !searchWhole;
			searchWholeBtn.classList.toggle("bg-gray-500");
		}
	});

	searchRegexBtn.addEventListener("click", () => {
		searchRegex = !searchRegex;
		if (searchCase) {
			searchCase = false;
			searchCaseBtn.classList.remove("bg-gray-500");
		}
		if (searchWhole) {
			searchWhole = false;
			searchWholeBtn.classList.remove("bg-gray-500");
		}
		searchRegexBtn.classList.toggle("bg-gray-500");
	});

	searchTransBtn.addEventListener("click", () => {
		searchTranslate = !searchTranslate;
		searchTransBtn.classList.toggle("bg-gray-500");
	});

	saveBtn.addEventListener("click", () => {
		save();
	});

	compileBtn.addEventListener("click", () => {
		compile();
	});

	optionsBtn.addEventListener("click", showOptions);

	backupCheck.addEventListener("click", () => {
		backupState = !backupState;
		if (backupState) {
			backupSettings.classList.remove("hidden");
			backup(backupPeriod);
		} else {
			backupSettings.classList.add("hidden");
		}
		if (backupCheck.innerHTML === "check") {
			backupCheck.innerHTML = "close";
		} else {
			backupCheck.innerHTML = "check";
		}
	});

	backupPeriodInput.addEventListener("change", () => {
		backupPeriod = parseInt(backupPeriodInput.value);
		if (backupPeriod < 60) {
			backupPeriodInput.value = 60;
		} else if (backupPeriod > 3600) {
			backupPeriodInput.value = 3600;
		}
	});

	backupMaxInput.addEventListener("change", () => {
		backupMax = parseInt(backupMaxInput.value);
		if (backupMax < 1) {
			backupMaxInput.value = 1;
		} else if (backupMax > 100) {
			backupMaxInput.value = 100;
		}
	});

	editOrigCheck.addEventListener("click", () => {
		editOrig = !editOrig;
		if (editOrigCheck.innerHTML === "check") {
			editOrigCheck.innerHTML = "close";
		} else {
			editOrigCheck.innerHTML = "check";
		}
	});
}

window.addEventListener("DOMContentLoaded", render);
