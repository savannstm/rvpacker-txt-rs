interface String {
    replaceAllMultiple(replacementObj: { [key: string]: string }): string;
    count(char: string): number;
}

interface HTMLElement {
    toggleMultiple(...classes: string[]): void;
    secondHighestParent(childElement: HTMLElement): HTMLElement;
}

interface HTMLTextAreaElement {
    calculateHeight(): void;
}

interface Backup {
    enabled: boolean;
    period: number;
    max: number;
}

interface Settings {
    lang: Language;
    backup: Backup;
    theme: ThemeName;
    firstLaunch: boolean;
    project: string | null;
}

interface mainTranslation {
    cannotGetSettings: string;
    askCreateSettings: string;
    createdSettings: string;
    unsavedChanges: string;
    originalTextIrreplacable: string;
    invalidRegexp: string;
    textReverted: string;
    reloadButton: string;
    helpButton: string;
    aboutButton: string;
    hotkeysButton: string;
    exit: string;
    fileMenu: string;
    helpMenu: string;
    languageMenu: string;
    menuButtonTitle: string;
    saveButtonTitle: string;
    compileButtonTitle: string;
    optionsButtonTitle: string;
    searchButtonTitle: string;
    searchInputTitle: string;
    replaceButtonTitle: string;
    replaceInputTitle: string;
    caseButtonTitle: string;
    wholeButtonTitle: string;
    regexButtonTitle: string;
    translationButtonTitle: string;
    locationButtonTitle: string;
    noMatches: string;
    currentPage: string;
    separator: string;
    goToRow: string;
    missingTranslationDir: string;
    missingOriginalDir: string;
    missingTranslationSubdirs: string;
    noProjectSelected: string;
    backgroundDark: string;
    backgroundPrimary: string;
    backgroundSecond: string;
    backgroundThird: string;
    outlinePrimary: string;
    outlineSecond: string;
    outlineThird: string;
    outlineFocused: string;
    borderPrimary: string;
    borderSecond: string;
    borderFocused: string;
    backgroundPrimaryHovered: string;
    backgroundSecondHovered: string;
    textPrimary: string;
    textSecond: string;
    textThird: string;
    createTheme: string;
    allowedThemeNameCharacters: string;
    invalidThemeName: string;
    themeName: string;
}

interface optionsTranslation {
    backupPeriodLabel: string;
    backupPeriodNote: string;
    backupMaxLabel: string;
    backupMaxNote: string;
    backup: string;
}

interface aboutTranslation {
    version: string;
    about: string;
    socials: string;
    vkLink: string;
    tgLink: string;
    githubLink: string;
    license: string;
}

interface hotkeysTranslation {
    hotkeysTitle: string;
    hotkeys: string;
}

interface helpTranslation {
    helpTitle: string;
    help: string;
}

interface Translation {
    main: mainTranslation;
    options: optionsTranslation;
    about: aboutTranslation;
    hotkeys: hotkeysTranslation;
    help: helpTranslation;
}

interface ThemeObject {
    [name: string]: Theme;
}

interface Theme {
    name: string;
    backgroundDark: string;
    backgroundPrimary: string;
    backgroundSecond: string;
    backgroundThird: string;
    outlinePrimary: string;
    outlineSecond: string;
    outlineThird: string;
    outlineFocused: string;
    borderPrimary: string;
    borderSecond: string;
    borderFocused: string;
    backgroundPrimaryHovered: string;
    backgroundSecondHovered: string;
    textPrimary: string;
    textSecond: string;
    textThird: string;
}

type Language = "en" | "ru";

type State =
    | null
    | "maps"
    | "names"
    | "actors"
    | "armors"
    | "classes"
    | "commonevents"
    | "enemies"
    | "items"
    | "skills"
    | "system"
    | "troops"
    | "weapons"
    | "plugins";
