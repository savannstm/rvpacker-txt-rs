import chalk from "chalk";

export class ProgramLocalization {
    programDesc: string;
    languageArgDesc: string;
    inputDirArgType: string;
    outputDirArgType: string;
    readInputDirDesc: string;
    readOutputDirDesc: string;
    writeInputDirDesc: string;
    writeOutputDirDesc: string;
    helpArgDesc: string;
    helpCommandDesc: string;
    helpCommandType: string;
    usage: string;
    arguments: string;
    commands: string;
    options: string;
    error: string;
    optionsType: string;
    commandType: string;
    readCommandDesc: string;
    writeCommandDesc: string;
    default: string;
    choices: string;
    false: string;
    true: string;
    logArgDesc: string;
    languageType: string;
    shuffleArgType: string;
    shuffleArgDesc: string;
    readLogMessage: string;
    writeLogMessage: string;
    timeElapsed: string;
    systemFileMissing: string;
    scriptsFileMissing: string;
    noArgDesc: string;
    noType: string;
    originalDirMissing: string;
    translationDirsMissing: string;
    disableCustomParsingDesc: string;

    constructor(language: string) {
        switch (language) {
            default:
            case "en":
                this.programDesc =
                    "A tool, that parses .rxdata/.rvdata/.rvdata2 files of RPG Maker XP/VX/VXAce games into .txt files and vice versa.";
                this.languageArgDesc = "Sets tool language to specified.";
                this.inputDirArgType = "INPUT_PATH";
                this.outputDirArgType = "OUTPUT_PATH";
                this.readInputDirDesc =
                    'Path to the input directory, containing an "original" or "data" folder with game files.';
                this.readOutputDirDesc =
                    'Path to the output directory, where the "translation" folder with .txt files with text from the parsed files will be created.';
                this.writeInputDirDesc =
                    'Path to the input directory, containing directories "original" or "data" with original game files, and "translation/maps" with "translation/other" directories containing .txt game files.';
                this.writeOutputDirDesc =
                    'Path to the output directory, where the "output" folder with files will be created out of .txt translation files.';
                this.helpArgDesc = "Prints this help message.";
                this.helpCommandDesc = "Prints a help message for specified command.";
                this.helpCommandType = "COMMAND_NAME";
                this.usage = "Usage:";
                this.arguments = "Arguments;";
                this.commands = "Commands:";
                this.options = "Options:";
                this.error = "error:";
                this.optionsType = "OPTIONS";
                this.commandType = "COMMAND";
                this.readCommandDesc =
                    'Parses files from the "original" or "data" folder of input directory to the "translation" folder of output directory.';
                this.writeCommandDesc =
                    'Writes translated files using original files from the "original" or "data" folder of input directory, replacing their text with the files from "translation" folder and outputting results to the "output" folder.';
                this.default = "default:";
                this.choices = "choices:";
                this.false = "false";
                this.true = "true";
                this.logArgDesc = "Enables logging.";
                this.languageType = "LANGUAGE";
                this.shuffleArgType = "NUMBER";
                this.shuffleArgDesc =
                    "At value 1: shuffles all translation lines. At value 2: shuffles all words in translation lines.";
                this.readLogMessage = "Parsed file";
                this.writeLogMessage = "Written file";
                this.timeElapsed = "Time elapsed (in seconds):";
                this.systemFileMissing = "The system file does not exist.";
                this.scriptsFileMissing = "The scripts file does not exist.";
                this.noArgDesc =
                    "Disables parsing/writing specified files.\nPossible values: maps, other, system, scripts.\nExample: --no=maps,other,system,scripts";
                this.noType = "FILES";
                this.originalDirMissing = "The path to 'original' or 'data' directories does not exist.";
                this.translationDirsMissing =
                    "The path to 'translation/maps' or/and 'translation/other' directories does not exist.";
                this.disableCustomParsingDesc =
                    "Disables custom parsing of specific game, where it's implemented, and parses whole raw game text.";
                break;
            case "ru":
                this.programDesc =
                    "Инструмент, позволяющий парсить .rxdata/.rvdata/rvdata2 файлы RPG Maker XP/VX/VXAce игр в .txt файлы, а затем записывать их обратно.";
                this.languageArgDesc = "Устанавливает язык инструмента на введённый.";
                this.inputDirArgType = "ВХОДНОЙ_ПУТЬ";
                this.outputDirArgType = "ВЫХОДНОЙ_ПУТЬ";
                this.readInputDirDesc = 'Путь к директории входа, содержащей папку "original" с файлами игры.';
                this.readOutputDirDesc =
                    'Путь к директории выхода, в которой будет создана папка "translation" с .txt файлами из распарсенных файлов.';
                this.writeInputDirDesc =
                    'Путь к директории входа, содержащей папки "original" или "data" с оригинальными файлами игры, и папки "translation/maps" и "translation/other" с .txt файлами игры.';
                this.writeOutputDirDesc =
                    'Путь к директории выхода, в которой будет создана папка "output" с файлами, созданными из .txt файлов с переводом.';
                this.helpArgDesc = "Выводит эту справку.";
                this.helpCommandDesc = "Выводит справку для указанной команды.";
                this.helpCommandType = "ИМЯ_КОМАНДЫ";
                this.usage = "Использование:";
                this.arguments = "Аргументы:";
                this.commands = "Команды:";
                this.options = "Опции:";
                this.error = "ошибка:";
                this.optionsType = "ОПЦИИ";
                this.commandType = "КОМАНДА";
                this.readCommandDesc =
                    'Парсит файлы из папки "original" или "data" входной директории в папку "translation" выходной директории.';
                this.writeCommandDesc = "";
                this.default = "по умолчанию:";
                this.choices = "варианты:";
                this.false = "нет";
                this.true = "да";
                this.logArgDesc = "Включает логирование.";
                this.languageType = "ЯЗЫК";
                this.shuffleArgType = "ЧИСЛО";
                this.writeCommandDesc =
                    'Записывает переведенные файлы, используя исходные файлы из папки "original" или "data" входной директории, заменяя текст файлами из папки "translation" и выводя результаты в папку "output".';
                this.shuffleArgDesc =
                    "При значении 1: перемешивает все строки перевода. При значении 2: перемешивает все слова в строках перевода.";
                this.readLogMessage = "Распарсен файл";
                this.writeLogMessage = "Записан файл";
                this.timeElapsed = "Время выполнения (в секундах):";
                this.systemFileMissing = "Файл System не существует.";
                this.scriptsFileMissing = "Файл Scripts не существует.";
                this.noArgDesc =
                    "Отключает обработку указанных файлов.\nВозможные значения: maps, other, system, scripts.\nПример: --no=maps,other,system,scripts";
                this.noType = "ФАЙЛЫ";
                this.originalDirMissing = 'Путь к директориям "original" или "data" не существует.';
                this.translationDirsMissing =
                    'Путь к директориям "translation/maps" и/или "translation/other" не существует.';
                this.disableCustomParsingDesc =
                    "Отключает использование индивидуальных способов парсинга файлов игр, для которых это имплементировано, парся игровой текст целиком и сырым.";
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
