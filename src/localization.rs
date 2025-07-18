use color_print::cstr;

pub enum Language {
    English,
    Russian,
}

pub struct Localization {
    // About message and templates
    pub about_msg: &'static str,
    pub help_template: &'static str,
    pub subcommand_help_template: &'static str,
    pub json_help_template: &'static str,

    // Command descriptions
    pub read_command_desc: &'static str,
    pub write_command_desc: &'static str,
    pub purge_command_desc: &'static str,

    pub json_command_desc: &'static str,
    pub generate_json_command_desc: &'static str,
    pub write_json_command_desc: &'static str,

    pub asset_command_desc: &'static str,
    pub decrypt_command_desc: &'static str,
    pub encrypt_command_desc: &'static str,
    pub extract_key_command_desc: &'static str,

    // Argument descriptions
    pub input_dir_arg_desc: &'static str,
    pub output_dir_arg_desc: &'static str,
    pub progress_arg_desc: &'static str,
    pub language_arg_desc: &'static str,
    pub help_arg_desc: &'static str,
    pub version_flag_desc: &'static str,
    pub verbose_arg_desc: &'static str,

    pub disable_processing_arg_desc: &'static str,
    pub romanize_desc: &'static str,
    pub disable_custom_processing_desc: &'static str,
    pub duplicate_mode_arg_desc: &'static str,
    pub read_mode_arg_desc: &'static str,
    pub create_ignore_flag_desc: &'static str,
    pub ignore_flag_desc: &'static str,
    pub trim_flag_desc: &'static str,

    pub key_arg_desc: &'static str,
    pub file_arg_desc: &'static str,
    pub engine_arg_desc: &'static str,

    // Argument types
    pub mode_arg_type: &'static str,
    pub input_path_arg_type: &'static str,
    pub output_path_arg_type: &'static str,
    pub disable_processing_arg_type: &'static str,
    pub language_arg_type: &'static str,
    pub key_arg_type: &'static str,
    pub file_arg_type: &'static str,
    pub engine_arg_type: &'static str,

    // Messages and warnings
    pub input_dir_missing: &'static str,
    pub output_dir_missing: &'static str,
    pub translation_dir_missing: &'static str,
    pub elapsed_time_msg: &'static str,
    pub custom_processing_enabled_msg: &'static str,
    pub enabling_romanize_metadata_msg: &'static str,
    pub disabling_custom_processing_metadata_msg: &'static str,
    pub enabling_trim_metadata_msg: &'static str,
    pub setting_duplicate_mode_metadata_msg: &'static str,
    pub no_subcommand_specified_msg: &'static str,
    pub could_not_determine_game_engine_msg: &'static str,
    pub game_ini_file_missing_msg: &'static str,
    pub ignore_file_does_not_exist_msg: &'static str,
    pub could_not_decrypt_ini_file_msg: &'static str,
    pub engine_argument_required_msg: &'static str,
    pub translation_already_exist_msg: &'static str,
    pub map_is_unused_msg: &'static str,
    pub generated_json_msg: &'static str,
    pub json_already_exist_msg: &'static str,
    pub mvmz_already_json_msg: &'static str,
    pub no_translation_for_entry_msg: &'static str,
    pub purged_file_msg: &'static str,
    pub read_file_msg: &'static str,
    pub skipped_file_msg: &'static str,
    pub written_file_msg: &'static str,
    pub written_json_msg: &'static str,
    pub read_dir_failed_msg: &'static str,
    pub append_mode_not_supported_msg: &'static str,
    pub create_dir_failed_msg: &'static str,
    pub json_parse_failed_msg: &'static str,
    pub load_failed_msg: &'static str,
    pub plugins_file_missing_msg: &'static str,
    pub read_file_failed_msg: &'static str,
    pub write_file_failed_msg: &'static str,

    pub force_mode_warning: &'static str,
    pub file_argument_missing_msg: &'static str,
    pub file_argument_is_not_file_msg: &'static str,

    // Misc
    pub allowed_values: &'static str,
    pub example: &'static str,
    pub default_value: &'static str,
    pub aliases: &'static str,
}

impl Localization {
    pub const fn new(language: Language) -> Self {
        match language {
            Language::English => Self::init_en(),
            Language::Russian => Self::init_ru(),
        }
    }

    const fn init_en() -> Self {
        Self {
            // About message and templates
            about_msg: cstr!(
                r#"<bold>This tool allows to parse RPG Maker XP/VX/VXAce/MV/MZ games text to .txt files and write them back to their initial form. The program uses "original" or "data" directories for source files, and "translation" directory to operate with translation files. It will also decrypt any .rgss archive if it's present.</>"#
            ),
            help_template: cstr!(
                "{about}\n\n<underline,bold>Usage:</> rvpacker-txt-rs COMMAND [OPTIONS]\n\n<underline,bold>Commands:</>\n{subcommands}\n\n<underline,bold>Options:</>\n{options}"
            ),
            subcommand_help_template: cstr!(
                "{about}\n\n<underline,bold>Usage:</> {usage}\n\n<underline,bold>Options:</>\n{options}"
            ),
            json_help_template: cstr!(
                "{about}\n\n<underline,bold>Commands:</>\n{subcommands}\n\n<underline,bold>Options:</>\n{options}"
            ),

            // Command descriptions
            read_command_desc: cstr!(
                r#"<bold>Parses game files to .txt format, and decrypts any .rgss archive if it's present.</>"#
            ),
            write_command_desc: cstr!(
                r#"<bold>Writes translated game files to the "output" directory.</>"#
            ),
            purge_command_desc: cstr!(
                r#"<bold>Purges lines without translation from ".txt" translation files.</>"#
            ),

            asset_command_desc: cstr!(
                "<bold>Decrypt/encrypt RPG Maker MV/MZ audio and image assets."
            ),
            decrypt_command_desc: cstr!(
                "<bold>Decrypts encrypted assets.\n\
                                    .rpgmvo/.ogg_ => .ogg\n\
                                    .rpgmvp/.png_ => .png\n\
                                    .rpgmvm/.m4a_ => .m4a"
            ),
            encrypt_command_desc: cstr!(
                "<bold>Encrypts .png/.ogg/m4a assets.\n\
                                    .ogg => .rpgmvo/.ogg_\n\
                                    .png => .rpgmvp/.png_\n\
                                    .m4a => .rpgmvm/.m4a_"
            ),
            extract_key_command_desc: cstr!(
                "<bold>Extracts key from the file, specified in --file argument."
            ),

            json_command_desc: cstr!(
                r#"<bold>Provides the commands for JSON generation and writing.</>"#
            ),
            generate_json_command_desc: cstr!(
                r#"<bold>Generates JSON representations of older engines' files in "json" directory.</>"#
            ),
            write_json_command_desc: cstr!(
                r#"<bold>Writes JSON representations of older engines' files from "json" directory back to original files.</>"#
            ),

            input_dir_arg_desc: r#"Input directory, containing game files."#,
            output_dir_arg_desc: r#"Output directory to output files to."#,
            progress_arg_desc: "Enables real-time progress logging.",
            help_arg_desc: "Prints the program help message or for the entered subcommand.",
            language_arg_desc: "Sets the localization of the tool to the selected language.",
            version_flag_desc: "Show program version.",
            verbose_arg_desc: "Outputs full informating about processed files.",

            disable_processing_arg_desc: "Skips processing specified files. plugins can be used interchangeably with scripts.",
            romanize_desc: "If you parsing text from a Japanese game, that contains symbols like 「」, which are just the Japanese quotation marks, it automatically replaces these symbols by their western equivalents (in this case, '').\n\
            Will be automatically set if it was used in read.",
            disable_custom_processing_desc: "Disables built-in custom processing, implemented for some games.\n\
            Right now, implemented for the following titles: LISA: The Painful and its derivatives, Fear & Hunger 2: Termina.\n\
            Will be automatically set if it was used in read.",
            duplicate_mode_arg_desc: "Controls how to handle duplicates in text.",
            read_mode_arg_desc: "Defines how to read files.\n\
            default - If encounters existing translation files, aborts read.\n\
            append - Appends any new text from the game to the translation files, if the text is not already present. Unused lines are removed from translation files, and the lines order is sorted.\n\
            force - Force rewrites existing translation files.",
            trim_flag_desc: "Remove the leading and trailing whitespace from extracted strings. Don't use this option unless you know that trimming the text won't cause any incorrect behavior.",
            create_ignore_flag_desc: "Create an ignore file from purged lines, to prevent their further appearance when reading with append mode.",
            ignore_flag_desc: "Ignore entries from .rvpacker-ignore file. Use with append mode.",
            key_arg_desc: "Encryption key for encrypt/decrypt operations.",
            file_arg_desc: "File path (for single file processing or key extraction).",
            engine_arg_desc: r#"Game engine ("mv" or "mz")."#,

            // Argument types
            mode_arg_type: "MODE",
            input_path_arg_type: "INPUT_PATH",
            output_path_arg_type: "OUTPUT_PATH",
            disable_processing_arg_type: "FILES",
            language_arg_type: "LANGUAGE",
            key_arg_type: "KEY",
            file_arg_type: "INPUT_FILE",
            engine_arg_type: "ENGINE",

            // Messages and warnings
            input_dir_missing: "Input directory does not exist.",
            output_dir_missing: "Output directory does not exist.",
            translation_dir_missing: r#""translation" directory in the input directory does not exist."#,

            elapsed_time_msg: "Elapsed:",
            custom_processing_enabled_msg: "Custom processing for this game will be used. Use --disable-custom-processing to disable it.",
            enabling_romanize_metadata_msg: "Enabling romanize according to the metadata from previous read.",
            disabling_custom_processing_metadata_msg: "Disabling custom processing according to the metadata from previous read.",
            enabling_trim_metadata_msg: "Enabling trimming according to the metadata from previous read.",
            setting_duplicate_mode_metadata_msg: "Setting duplicate mode according to the metadata from previous read.",
            no_subcommand_specified_msg: "No command was specified. Call rvpacker-txt-rs -h for help.",
            could_not_determine_game_engine_msg: "Couldn't determine game engine. Check the existence of System file inside data/original directory.",
            game_ini_file_missing_msg: "Game.ini file not found.",
            ignore_file_does_not_exist_msg: ".rvpacker-ignore file does not exist. Aborting execution.",
            could_not_decrypt_ini_file_msg: "Couldn't decrypt Game.ini file. You can try to turn it UTF-8 yourself, after that everything will work.",
            engine_argument_required_msg: "`--engine` argument is required.",
            file_argument_missing_msg: "`--file` argument is missing. It's required in `extract_key` command.",
            file_argument_is_not_file_msg: "`--file` argument expects a file.",
            read_file_msg: "Successfully read file.",
            written_file_msg: "Successfully written file.",
            purged_file_msg: "Successfully purged file.",
            skipped_file_msg: "Skipped file, as its processing is disabled.",
            generated_json_msg: "Successfully generated json.",
            map_is_unused_msg: "Map is unused in-game, and is skipped.",
            json_already_exist_msg: "JSON representation of the file already exists.",
            mvmz_already_json_msg: "MV/MZ engines are already JSON, aborting.",
            no_translation_for_entry_msg: "No translation exists for the entry, skipping.",
            translation_already_exist_msg: "Translation file already exists. Use `--mode force` to overwrite.",
            written_json_msg: "Successfully created JSON.",
            read_dir_failed_msg: "Reading directory failed.",
            append_mode_not_supported_msg: "Append mode (`--mode append`) is not supported.",
            create_dir_failed_msg: "Creating directory failed.",
            json_parse_failed_msg: "Parsing JSON failed.",
            load_failed_msg: "Loading RPG Maker file failed.",
            plugins_file_missing_msg: "`js/plugins.js` path does not exist in the parent directory of input directory.",
            read_file_failed_msg: "Reading file failed.",
            write_file_failed_msg: "Writing file failed.",

            force_mode_warning: "WARNING! Force mode will forcefully rewrite all your translation files. Input 'Y' to continue.",

            // Misc
            allowed_values: "Allowed values:",
            example: "Example:",
            default_value: "Default value:",
            aliases: "Aliases:",
        }
    }

    const fn init_ru() -> Self {
        Self {
            about_msg: cstr!(
                r#"<bold>Инструмент, позволяющий парсить текст из файлов RPG Maker XP/VX/VXAce/MV/MZ игр в .txt файлы, а затем записывать их обратно в совместимые файлы. Программа всегда будет использовать директории "original" или "data" для хранения исходных файлов, а также директорию "translation" для работы с файлами перевода. Программа также расшифрует любой зашифрованный архив .rgss, если он присутствует.</>"#
            ),
            help_template: cstr!(
                "{about}\n\n<underline,bold>Использование:</> rvpacker-txt-rs КОМАНДА [ОПЦИИ]\n\n<underline,bold>Команды:</>\n{subcommands}\n\n<underline,bold>Опции:</>\n{options}"
            ),
            subcommand_help_template: cstr!(
                "{about}\n\n<underline,bold>Использование:</> {usage}\n\n<underline,bold>Опции:</>\n{options}"
            ),
            json_help_template: cstr!(
                "{about}\n\n<underline,bold>Использование:</> {usage}\n\n<underline,bold>Команды:</>\n{subcommands}\n\n<underline,bold>Опции:</>\n{options}"
            ),

            read_command_desc: cstr!(
                r#"<bold>Парсит файлы из папки "original" или "data" ("Data") входной директории в папку "translation" выходной директории. Если папка "Data" не существует, а во входной директории есть архив .rgss, программа автоматически расшифровывает его.</>"#
            ),
            write_command_desc: cstr!(
                r#"<bold>Записывает переведенные файлы, используя исходные файлы из папки "original" или "data" ("Data") входной директории, применяя текст из .txt файлов папки "translation", выводя результаты в папку "output" выходной директории.</>"#
            ),
            purge_command_desc: cstr!(
                r#"<bold>Удаляет строки без перевода из текстовых файлов перевода.</>"#
            ),

            asset_command_desc: cstr!(
                "<bold>Расшифровывает/зашифровывает ассеты движков RPG Maker MV/MZ."
            ),
            decrypt_command_desc: cstr!(
                "<bold>Расшифровывает зашифрованные ассеты.\n\
            .rpgmvo/.ogg_ => .ogg\n\
            .rpgmvp/.png_ => .png\n\
            .rpgmvm/.m4a_ => .m4a"
            ),
            encrypt_command_desc: cstr!(
                "<bold>Зашифровывает ассеты .png/.ogg/m4a.\n\
            .ogg => .rpgmvo/.ogg_\n\
            .png => .rpgmvp/.png_\n\
            .m4a => .rpgmvm/.m4a_"
            ),
            extract_key_command_desc: cstr!(
                "<bold>Достаёт ключ из файла, указанного в аргументе --file."
            ),

            json_command_desc: cstr!(
                r#"<bold>Предоставляет команды для генерации JSON файлов и их записи."#
            ),
            generate_json_command_desc: cstr!(
                r#"<bold>Генерирует JSON-репрезентации файлов старых движков в директории "json"."#
            ),
            write_json_command_desc: cstr!(
                r#"<bold>Записывает JSON-репрезентации файлов старых движков из директории "json" обратно в исходные файлы."#
            ),

            input_dir_arg_desc: r#"Входная директория, содержащая файлы игры."#,
            output_dir_arg_desc: r#"Выходная директория, в которую будут помещены выходные файлы."#,
            progress_arg_desc: "Включает логирование в реальном времени.",
            help_arg_desc: "Выводит справочную информацию по программе либо по введёной команде.",
            language_arg_desc: "Устанавливает локализацию инструмента на выбранный язык.",
            version_flag_desc: "Отобразить версию программы.",
            verbose_arg_desc: "Выводит подробную информацию о результатах обработки.",

            disable_processing_arg_desc: "Не обрабатывает указанные файлы. plugins может применяться взаимозаменяемо со scripts.",
            romanize_desc: "Если вы парсите текст из японской игры, содержащей символы вроде 「」, являющимися обычными японскими кавычками, программа автоматически заменяет эти символы на их западные эквиваленты. (в данном случае, '').\n\
            Этот аргумент будет автоматически установлен, если был использован в чтении.",
            disable_custom_processing_desc: "Выключает встроенную индивидуальную обработку, имплементированную для некоторых игр.\n\
            Сейчас, она имплементирована для следующих игр: LISA: The Painful и на её базе, Fear & Hunger 2: Termina.\n\
            Этот аргумент будет автоматически установлен, если был использован в чтении.",
            duplicate_mode_arg_desc: "Контролирует, что делать с дубликатами текста.",
            read_mode_arg_desc: "Определяет способ чтения файлов.\n\
            default - при обнаружении существующих файлов перевода прерывает чтение.\n\
            append - добавляет любой новый текст из игры к файлам перевода, если текст еще не присутствует. Неиспользуемые строки удаляются из файлов перевода, а порядок строк сортируется.\n\
            force - принудительно переписываются существующие файлы перевода.",
            create_ignore_flag_desc: "Создать файл игнорирования удалённых строк, чтобы они не появились при последующих чтениях с аргументом --mode append.",
            ignore_flag_desc: cstr!(
                "Игнорировать строки из файла .rvpacker-ignore. Работает только с аргументом --mode append."
            ),
            trim_flag_desc: cstr!(
                "Удалить лишние начальные и конечные пробелы из распарсенного текста. Убедитесь, что этот аргумент не удалит пробелы, которые задуманы для отображения в игре перед применением."
            ),

            key_arg_desc: "Ключ шифрования для команд encrypt/decrypt.",
            file_arg_desc: "Путь к файлу (для обработки одного файла или доставания ключа).",
            engine_arg_desc: r#"Движок игры ("mv" или "mz")"#,

            mode_arg_type: "РЕЖИМ",
            input_path_arg_type: "ВХОДНОЙ_ПУТЬ",
            output_path_arg_type: "ВЫХОДНОЙ_ПУТЬ",
            disable_processing_arg_type: "ИМЕНА_ФАЙЛОВ",
            language_arg_type: "ЯЗЫК",
            key_arg_type: "КЛЮЧ",
            file_arg_type: "ВХОДНОЙ_ФАЙЛ",
            engine_arg_type: "ДВИЖОК",

            input_dir_missing: "Входная директория не существует.",
            output_dir_missing: "Выходная директория не существует.",
            translation_dir_missing: r#"Папка "translation" входной директории не существует."#,

            elapsed_time_msg: "Затрачено:",
            custom_processing_enabled_msg: "Индивидуальная обработка текста будет использована для этой игры. Используйте `--disable-custom-processing`, чтобы отключить её.",
            enabling_romanize_metadata_msg: "Включаем романизацию текста в соответствии с метаданными из прошлого чтения.",
            disabling_custom_processing_metadata_msg: "Выключаем индивидуальную обработку текста в соответствии с метаданными из прошлого чтения.",
            enabling_trim_metadata_msg: "Включаем удаление лишних пробелов в соответствии с метаданными из прошлого чтения.",
            setting_duplicate_mode_metadata_msg: "Устанавливаем режим дубликатов в соответствии с метаданными из прошлого чтения.",
            no_subcommand_specified_msg: "Команда не была указана. Вызовите `rvpacker-txt-rs -h` для помощи.",
            could_not_determine_game_engine_msg: "Не удалось определить движок игры. Убедитесь, что файл System существует.",
            game_ini_file_missing_msg: "Файл Game.ini не был обнаружен.",
            ignore_file_does_not_exist_msg: "Файл .rvpacker-ignore не существует. Прерываем выполнение.",
            could_not_decrypt_ini_file_msg: "Не удалось расшифровать файл Game.ini. Вы можете вручную конвертировать его в UTF-8, после этого всё заработает.",
            engine_argument_required_msg: "Аргумент `--engine` необходим.",
            file_argument_missing_msg: "Аргумент `--file` отсутствует. Он необходим в команде `extract_key`.",
            file_argument_is_not_file_msg: "Аргумент `--file` ожидает файл.",
            read_file_msg: "Файл успешно прочитан.",
            written_file_msg: "Файл успешно записан.",
            purged_file_msg: "Файл успешно очищен.",
            skipped_file_msg: "Пропускаем файл, так как его обработка выключена.",
            generated_json_msg: "JSON успешно сгенерирован.",
            map_is_unused_msg: "Пропускаем карту, так как она не используется в игре.",
            json_already_exist_msg: "JSON репрезентация файла уже существует. Используйте `--mode force`, чтобы переписать.",
            mvmz_already_json_msg: "Движки MV/MZ уже JSON, пропускаем.",
            no_translation_for_entry_msg: "Для этой записи нет перевода, пропускаем.",
            translation_already_exist_msg: "Файл перевода уже существует. Используйте `--mode force`, чтобы переписать.",
            written_json_msg: "JSON успешно записан.",
            read_dir_failed_msg: "Не удалось прочитать директорию.",
            append_mode_not_supported_msg: "Режим добавления (`--mode append`) не поддерживается.",
            create_dir_failed_msg: "Не удалось создать директорию.",
            json_parse_failed_msg: "Не удалось запарсить JSON.",
            load_failed_msg: "Не удалось загрузить файл RPG Maker.",
            plugins_file_missing_msg: "Не удалось найти путь `js/plugins.js` в корневой директории входной директории.",
            read_file_failed_msg: "Не удалось прочитать файл.",
            write_file_failed_msg: "Не удалось записать файл.",

            force_mode_warning: "ПРЕДУПРЕЖДЕНИЕ! Принудительный режим полностью перепишет все ваши файлы перевода. Введите Y, чтобы продолжить.",

            allowed_values: "Разрешённые значения:",
            example: "Пример:",
            default_value: "Значение по умолчанию:",
            aliases: "Также:",
        }
    }
}
