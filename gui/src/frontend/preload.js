const { join } = require("path");
const {
	readFileSync,
	writeFileSync,
	readdirSync,
	ensureDirSync,
	copyFileSync
} = require("fs-extra");
const { spawn } = require("child_process");

const production = false;

function render() {
	const copiesRoot = production
		? join(__dirname, "../../../../copies")
		: join(__dirname, "../../copies");
	const backupRoot = production
		? join(__dirname, "../../../../backups")
		: join(__dirname, "../../backups");
	const translationRoot = production
		? join(__dirname, "../../../../translation")
		: join(__dirname, "../../../translation");

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

	const copiesDirs = {
		originalMapText: join(copiesRoot, "maps/maps.txt"),
		translatedMapText: join(copiesRoot, "maps/maps_trans.txt"),
		originalMapNames: join(copiesRoot, "maps/names.txt"),
		translatedMapNames: join(copiesRoot, "maps/names_trans.txt"),
		originalActors: join(copiesRoot, "other/Actors.txt"),
		translatedActors: join(copiesRoot, "other/Actors_trans.txt"),
		originalArmors: join(copiesRoot, "other/Armors.txt"),
		translatedArmors: join(copiesRoot, "other/Armors_trans.txt"),
		originalClasses: join(copiesRoot, "other/Classes.txt"),
		translatedClasses: join(copiesRoot, "other/Classes_trans.txt"),
		originalCommonEvents: join(copiesRoot, "other/CommonEvents.txt"),
		translatedCommonEvents: join(
			copiesRoot,
			"other/CommonEvents_trans.txt"
		),
		originalEnemies: join(copiesRoot, "other/Enemies.txt"),
		translatedEnemies: join(copiesRoot, "other/Enemies_trans.txt"),
		originalItems: join(copiesRoot, "other/Items.txt"),
		translatedItems: join(copiesRoot, "other/Items_trans.txt"),
		originalSkills: join(copiesRoot, "other/Skills.txt"),
		translatedSkills: join(copiesRoot, "other/Skills_trans.txt"),
		originalSystem: join(copiesRoot, "other/System.txt"),
		translatedSystem: join(copiesRoot, "other/System_trans.txt"),
		originalTroops: join(copiesRoot, "other/Troops.txt"),
		translatedTroops: join(copiesRoot, "other/Troops_trans.txt"),
		originalWeapons: join(copiesRoot, "other/Weapons.txt"),
		translatedWeapons: join(copiesRoot, "other/Weapons_trans.txt")
	};

	const translationDirs = {
		maps: join(translationRoot, "maps"),
		other: join(translationRoot, "other"),
		copies: join(copiesRoot),
		copiesMaps: join(copiesRoot, "maps"),
		copiesOther: join(copiesRoot, "other")
	};

	copy();

	// TODO: Make variable names better
	const contentContainer = document.getElementById("content-container");
	const leftPanelElements =
		document.getElementsByClassName("left-panel-element");
	const searchButton = document.getElementById("search-button");
	const searchInput = document.getElementById("search-input");
	const replaceButton = document.getElementById("replace-button");
	const replaceInput = document.getElementById("replace-input");
	const menuButton = document.getElementById("menu-button");
	const leftPanel = document.getElementById("left-panel");
	const pageLoadedDisplay = document.getElementById("is-loaded");
	const searchPanel = document.getElementById("search-results");
	const currentState = document.getElementById("current-state");
	const saveButton = document.getElementById("save");
	const compileButton = document.getElementById("compile");
	const optionButton = document.getElementById("options");
	const optionsMenu = document.getElementById("options-menu");
	const searchCaseButton = document.getElementById("case");
	const searchWholeButton = document.getElementById("whole");
	const searchRegexButton = document.getElementById("regex");
	const searchTransButton = document.getElementById("translate");
	const backupCheck = document.getElementById("backup-check");
	const editOrigCheck = document.getElementById("edit-orig-check");
	const backupSettings = document.getElementById("backup-settings");
	const backupPeriodInput = document.getElementById("backup-period-input");
	const backupMaxInput = document.getElementById("backup-max-input");
	const appSettings = JSON.parse(
		readFileSync(join(__dirname, "settings.json"), "utf-8")
	);

	/** @type {boolean} */
	let backupState = appSettings.backup.enabled;
	/** @type {number} */
	let backupPeriod = appSettings.backup.period;
	/** @type {number} */
	let backupMax = appSettings.backup.max;
	/** @type {boolean} */
	let editOrig = appSettings.editOrig;
	/** @type {string} */
	let searchRegex = false;
	let searchWhole = false;
	let searchCase = false;
	let searchTranslate = false;
	let optionsOpened = false;

	let state = "main";

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

	createContent();

	if (backupState) backup(backupPeriod);

	const contentYCoordinates = absolutize();

	function absolutize() {
		const childYCoordinates = new Map();

		window.scrollTo(0, 0);

		requestAnimationFrame(() => {
			for (const child of contentContainer.childNodes) {
				child.classList.remove("hidden");
				child.classList.add("flex", "flex-col");
				const nodeYCoordinates = new Map();
				const nodeWidths = new Map();

				let margin = 0;
				for (const node of child.childNodes) {
					const nodeYCoordinate =
						node.getBoundingClientRect().y + margin;
					const nodeWidth = node.getBoundingClientRect().width;
					nodeYCoordinates.set(node.id, nodeYCoordinate);
					nodeWidths.set(node.id, nodeWidth);
					margin += 8;
				}

				for (const node of child.childNodes) {
					node.classList.add("hidden");
					node.classList.add("absolute");
					node.style.top = `${nodeYCoordinates.get(node.id)}px`;
					node.style.width = `${nodeWidths.get(node.id)}px`;
				}

				childYCoordinates.set(child.id, nodeYCoordinates);
				child.style.height = `${
					nodeYCoordinates.get(
						Array.from(child.childNodes).at(-1).id
					) - 64
				}px`;
				child.classList.remove("flex", "flex-col");
				child.classList.add("hidden");
			}
		});

		document.body.classList.remove("invisible");
		return childYCoordinates;
	}

	function determineLastBackupNumber() {
		const backupDir = join(__dirname, "../backups");

		ensureDirSync(backupDir);

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

	function createRegularExpression(text) {
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

		return regex;
	}

	/**
	 * @param {Map<HTMLElement, string>} map
	 * @param {string} text
	 * @param {HTMLElement} node
	 * @returns {void}
	 */
	function setMatches(map, text, node) {
		const regex = createRegularExpression(text);

		const expr = new RegExp(regex.text, regex.attr);
		const result = node.value.search(expr);

		if (result !== -1) {
			const before = node.value.substring(0, result);
			const after = node.value.substring(result + text.length);

			const output = [
				`<div class="inline">${before}</div>`,
				`<div class="inline bg-gray-500">${text}</div>`,
				`<div class="inline">${after}</a>`
			];

			map.set(node, output.join(""));
		}
	}

	/**
	 * @param {string} text
	 * @returns {Map<HTMLElement, string>}
	 */
	function searchText(text) {
		/** @type { Map<HTMLElement, string> } */
		const matches = new Map();

		for (const child of contentContainer.childNodes) {
			for (const grandChild of child.childNodes) {
				const grandChildNodes = Array.from(grandChild.childNodes)[0]
					.childNodes;

				if (searchTranslate) {
					setMatches(matches, text, grandChildNodes[2]);
				} else {
					for (let i = 1; i < grandChildNodes.length; i++) {
						setMatches(matches, text, grandChildNodes[i]);
					}
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

				/** @type {HTMLElement} */
				const grandGrandParent =
					element.parentNode.parentNode.parentNode;

				resultElement.addEventListener("click", () => {
					const currentState = grandGrandParent.id.replace(
						"-content",
						""
					);

					changeState(currentState, false);

					window.scrollTo({
						top:
							contentYCoordinates
								.get(grandGrandParent.id)
								.get(element.parentNode.parentNode.id) -
							window.innerHeight / 2,
						behavior: "smooth"
					});
				});

				const counterpart = findCounterpart(element.id);

				/**
				 * @param {HTMLElement} element
				 * @returns {[parentId: string, id: string]}
				 */
				function extractInfo(element) {
					const parts = element.id.split("-");
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

		const regex = createRegularExpression(text);

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
		ensureDirSync(paths.copies);
		ensureDirSync(paths.copiesMaps);
		ensureDirSync(paths.copiesOther);

		const copiesMapsLength = readdirSync(paths.copiesMaps).length;
		const mapsLength = readdirSync(paths.maps).length;
		const copiesOtherLength = readdirSync(paths.copiesOther).length;
		const otherLength = readdirSync(paths.other).length;

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
		if (isCopied(translationDirs)) {
			console.log("Files are already copied.");
			return;
		}
		console.log("Copying files...");

		for (const file of readdirSync(translationDirs.maps)) {
			copyFileSync(
				join(translationDirs.maps, file),
				join(translationDirs.copiesMaps, file)
			);
		}

		for (const file of readdirSync(translationDirs.other)) {
			copyFileSync(
				join(translationDirs.other, file),
				join(translationDirs.copiesOther, file)
			);
		}

		return;
	}

	// ? Shorten and make more readable?
	function save(backup = false) {
		saveButton.classList.add("animate-spin");

		requestAnimationFrame(() => {
			let dirName = copiesRoot;

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

				dirName = join(backupRoot, backupFolderName);

				ensureDirSync(join(dirName, "maps"), {
					recursive: true
				});

				ensureDirSync(join(dirName, "other"), {
					recursive: true
				});
			}

			for (const child of contentContainer.childNodes) {
				const outputArray = [];

				for (const grandChild of child.childNodes) {
					for (const grandGrandChild of grandChild.childNodes) {
						for (const node of grandGrandChild.childNodes) {
							if (!node.id.includes("translated")) continue;
							else {
								outputArray.push(
									node.value.replaceAll("\n", "\\n")
								);
							}
						}
					}
				}

				const filePath = fileMappings[child.id];

				if (filePath) {
					const dir = join(dirName, filePath);

					writeFileSync(dir, outputArray.join("\n"), "utf-8");
				}
			}
			setTimeout(() => {
				saveButton.classList.remove("animate-spin");
			}, 1000);
		});
		return;
	}

	function backup(s) {
		if (backupState) {
			setTimeout(() => {
				save(true);
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
		content.classList.add("hidden");

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
	 * @param {Map<string, number>} map
	 * @returns {void}
	 */
	function handleElementRendering(map) {
		for (const [node, y] of map) {
			const element = document.getElementById(node);

			if (
				y >= window.scrollY &&
				y < window.scrollY + window.innerHeight
			) {
				element.classList.remove("hidden");
			} else {
				element.classList.add("hidden");
			}
		}
		return;
	}

	/**
	 * @param {string} newState
	 * @param {string} contentId
	 * @param {boolean} slide
	 * @returns {void}
	 */
	function updateStateCallback(newState, contentId, slide) {
		const contentParent = document.getElementById(contentId);
		contentParent.classList.remove("hidden");
		contentParent.classList.add("flex", "flex-col");

		for (const child of contentContainer.childNodes) {
			function handleScroll() {
				handleElementRendering(contentYCoordinates.get(contentId));
			}

			if (child.id !== contentId) {
				child.classList.remove("flex", "flex-col");
				child.classList.add("hidden");
				window.removeEventListener("scroll", handleScroll);
			} else {
				handleElementRendering(contentYCoordinates.get(contentId));
				window.addEventListener("scroll", handleScroll);
			}
		}

		if (slide) {
			leftPanel.classList.toggle("translate-x-0");
			leftPanel.classList.toggle("-translate-x-full");
		}

		pageLoadedDisplay.innerHTML = "done";
		pageLoadedDisplay.classList.toggle("animate-spin");
		console.log(`Current state is ${newState}`);
		return;
	}

	/**
	 * @param {string} newState
	 * @param {string} contentId
	 * @param {boolean} slide
	 * @returns {void}
	 */
	async function updateState(newState, contentId, slide = true) {
		pageLoadedDisplay.innerHTML = "refresh";
		pageLoadedDisplay.classList.toggle("animate-spin");

		currentState.innerHTML = newState;

		if (pageLoadedDisplay.classList.contains("animate-spin")) {
			updateStateCallback(newState, contentId, slide);
		} else {
			await sleep(100);
			updateStateCallback(newState, contentId, slide);
		}
		return;
	}

	/**
	 * @param {string} newState
	 * @param {boolean} [slide=true]
	 * @returns {void}
	 */
	function changeState(newState, slide = true) {
		if (state === newState) {
			return;
		}

		switch (newState) {
			case "main":
				state = "main";
				currentState.innerHTML = "";
				pageLoadedDisplay.innerHTML = "check_indeterminate_small";

				for (const node of contentContainer.childNodes) {
					node.classList.remove("flex", "flex-row", "justify-start");
					node.classList.add("hidden");
				}
				break;
			default:
				state = newState;
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
			case "KeyC":
				if (event.altKey) {
					compile();
				}
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
					if (event.ctrlKey) {
						const focusedElement = document.activeElement;
						const idParts = focusedElement.id.split("-");
						const index = parseInt(idParts.pop()) - 1;
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
	 * @returns {void}
	 */
	// ! Single-call function
	function createContent() {
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

		const texts = readFiles(copiesDirs);

		for (const content of contentTypes) {
			createTextAreasChild(
				content.id,
				texts.get(content.original),
				texts.get(content.translated)
			);
		}
	}

	function compile() {
		compileButton.classList.add("animate-spin");

		save();
		const writer = spawn(join(__dirname, "../resources/write.exe"), [], {
			cwd: join(__dirname, "../resources")
		});

		let error = false;

		writer.stderr.on("data", (err) => {
			alert(`Не удалось записать файлы: ${err}`);
			error = true;
		});

		writer.on("close", () => {
			compileButton.classList.remove("animate-spin");
			if (!error) alert("Все файлы записаны успешно.");
			else alert("Файлы не были записаны.");
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
				join(__dirname, "settings.json"),
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

	menuButton.addEventListener("click", () => {
		leftPanel.classList.toggle("translate-x-0");
		leftPanel.classList.toggle("-translate-x-full");
	});

	searchButton.addEventListener("click", () => {
		if (searchInput.value) {
			searchPanel.innerHTML = "";
			displaySearchResults(searchInput.value.trim());
		} else if (document.activeElement === document.body) {
			searchInput.focus();
		} else {
			searchPanel.innerHTML = `<div class="flex justify-center items-center h-full">Результатов нет</div>`;
		}
	});

	replaceButton.addEventListener("click", () => {
		if (searchInput.value && replaceInput.value) {
			replaceText(searchInput.value.trim());
		}
	});

	searchCaseButton.addEventListener("click", () => {
		if (!searchRegex) {
			searchCase = !searchCase;
			searchCaseButton.classList.toggle("bg-gray-500");
		}
	});

	searchWholeButton.addEventListener("click", () => {
		if (!searchRegex) {
			searchWhole = !searchWhole;
			searchWholeButton.classList.toggle("bg-gray-500");
		}
	});

	searchRegexButton.addEventListener("click", () => {
		searchRegex = !searchRegex;
		if (searchCase) {
			searchCase = false;
			searchCaseButton.classList.remove("bg-gray-500");
		}
		if (searchWhole) {
			searchWhole = false;
			searchWholeButton.classList.remove("bg-gray-500");
		}
		searchRegexButton.classList.toggle("bg-gray-500");
	});

	searchTransButton.addEventListener("click", () => {
		searchTranslate = !searchTranslate;
		searchTransButton.classList.toggle("bg-gray-500");
	});

	saveButton.addEventListener("click", () => {
		save();
	});

	compileButton.addEventListener("click", () => {
		compile();
	});

	optionButton.addEventListener("click", showOptions);

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
