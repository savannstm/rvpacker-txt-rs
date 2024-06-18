import chalk from "chalk";

export class ProgramLocalization {
    programDesc: string;
    languageDesc: string;
    inputDirType: string;
    outputDirType: string;
    readInputDirDesc: string;
    readOutputDirDesc: string;
    writeInputDirDesc: string;
    writeOutputDirDesc: string;
    helpOptionDesc: string;
    helpCommandDesc: string;
    helpCommandType: string;
    usage: string;
    arguments: string;
    commands: string;
    options: string;
    error: string;
    optionsType: string;
    commandType: string;
    readDesc: string;
    writeDesc: string;
    default: string;
    choices: string;
    false: string;
    true: string;
    logOptionDesc: string;
    languageType: string;
    drunkType: string;
    drunkDesc: string;
    readLogString: string;
    writeLogString: string;
    timeElapsed: string;
    noSystemFile: string;
    noScriptsFile: string;
    noOptionDesc: string;
    noType: string;

    constructor(language: string) {
        switch (language) {
            default:
            case "en":
                this.programDesc = "A tool, that parses .rxdata/.rvdata/.rvdata2 files into text and writes them back.";
                this.languageDesc = "Sets tool language to specified.";
                this.inputDirType = "INPUT_PATH";
                this.outputDirType = "OUTPUT_PATH";
                this.readInputDirDesc = 'Path to the input directory, containing a "original" folder with files.';
                this.readOutputDirDesc =
                    'Path to the output directory, where the "translation" folder with .txt files with text from the parsed files will be created.';
                this.writeInputDirDesc =
                    'Path to the input directory, containing folders "original" with original game files, and "translation" with "maps" and "other" folders with .txt game files.';
                this.writeOutputDirDesc =
                    'Path to the output directory, where the "output" folder with files will be created out of .txt translation files.';
                this.helpOptionDesc = "Prints this help message.";
                this.helpCommandDesc = "Prints a help message for specified command.";
                this.helpCommandType = "COMMAND_NAME";
                this.usage = "Usage:";
                this.arguments = "Arguments;";
                this.commands = "Commands:";
                this.options = "Options:";
                this.error = "error:";
                this.optionsType = "OPTIONS";
                this.commandType = "COMMAND";
                this.readDesc =
                    'Parses files from the "original" folder of input directory to the "translation" folder of output directory.';
                this.writeDesc =
                    'Writes translated files using original files from the "original" folder of input directory, replacing their text with the files from "translation" folder and outputting results to the "output" folder.';
                this.default = "default:";
                this.choices = "choices:";
                this.false = "false";
                this.true = "true";
                this.logOptionDesc = "Enables logging.";
                this.languageType = "LANGUAGE";
                this.drunkType = "NUMBER";
                this.drunkDesc =
                    "At value 1: shuffles all translation lines. At value 2: shuffles all words in translation lines.";
                this.readLogString = "Parsed file";
                this.writeLogString = "Written file";
                this.timeElapsed = "Time elapsed (in seconds):";
                this.noSystemFile = "The system file does not exist.";
                this.noScriptsFile = "The scripts file does not exist.";
                this.noOptionDesc =
                    "Disables parsing/writing specified files.\nPossible values: maps, other, system, scripts.\nExample: --no=maps,other,system,scripts";
                this.noType = "FILES";
                break;
            case "ru":
                this.programDesc =
                    "Инструмент, который парсит .rxdata/.rvdata/rvdata2 файлы в текст и записывает их обратно.";
                this.languageDesc = "Устанавливает язык инструмента на введённый.";
                this.inputDirType = "ВХОДНОЙ_ПУТЬ";
                this.outputDirType = "ВЫХОДНОЙ_ПУТЬ";
                this.readInputDirDesc = 'Путь к директории входа, содержащей папку "original" с файлами игры.';
                this.readOutputDirDesc =
                    'Путь к директории выхода, в которой будет создана папка "translation" с .txt файлами из распарсенных файлов.';
                this.writeInputDirDesc =
                    'Путь к директории входа, содержащей папки "original" с оригинальными файлами игры, и "translation" с папками "maps" и "other" с .txt файлами игры.';
                this.writeOutputDirDesc =
                    'Путь к директории выхода, в которой будет создана папка "output" с файлами, созданными из .txt файлов с переводом.';
                this.helpOptionDesc = "Выводит эту справку.";
                this.helpCommandDesc = "Выводит справку для указанной команды.";
                this.helpCommandType = "ИМЯ_КОМАНДЫ";
                this.usage = "Использование:";
                this.arguments = "Аргументы:";
                this.commands = "Команды:";
                this.options = "Опции:";
                this.error = "ошибка:";
                this.optionsType = "ОПЦИИ";
                this.commandType = "КОМАНДА";
                this.readDesc =
                    'Парсит файлы из папки "original" входной директории в папку "translation" выходной директории.';
                this.writeDesc = "";
                this.default = "по умолчанию:";
                this.choices = "варианты:";
                this.false = "нет";
                this.true = "да";
                this.logOptionDesc = "Включает логирование.";
                this.languageType = "ЯЗЫК";
                this.drunkType = "ЧИСЛО";
                this.writeDesc =
                    'Записывает переведенные файлы, используя исходные файлы из папки "original" входной директории, заменяя текст файлами из папки "translation" и выводя результаты в папку "output".';
                this.drunkDesc =
                    "При значении 1: перемешивает все строки перевода. При значении 2: перемешивает все слова в строках перевода.";
                this.readLogString = "Распарсен файл";
                this.writeLogString = "Записан файл";
                this.timeElapsed = "Время выполнения (в секундах):";
                this.noSystemFile = "Файл System не существует.";
                this.noScriptsFile = "Файл Scripts не существует.";
                this.noOptionDesc =
                    "Отключает обработку указанных файлов.\nВозможные значения: maps, other, system, scripts.\nПример: --no=maps,other,system,scripts";
                this.noType = "ФАЙЛЫ";
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
