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

    // Argument descriptions
    pub input_dir_arg_desc: &'static str,
    pub output_dir_arg_desc: &'static str,

    pub disable_processing_arg_desc: &'static str,

    pub romanize_desc: &'static str,

    pub disable_custom_processing_desc: &'static str,

    pub language_arg_desc: &'static str,

    pub log_arg_desc: &'static str,
    pub help_arg_desc: &'static str,

    pub read_mode_arg_desc: &'static str,

    pub stat_arg_desc: &'static str,
    pub leave_filled_flag_desc: &'static str,
    pub purge_empty_flag_desc: &'static str,
    pub create_ignore_flag_desc: &'static str,

    pub generate_json_command_desc: &'static str,
    pub write_json_command_desc: &'static str,

    pub version_flag_desc: &'static str,
    pub ignore_flag_desc: &'static str,

    pub trim_flag_desc: &'static str,
    pub sort_flag_desc: &'static str,

    pub decrypt_command_desc: &'static str,
    pub encrypt_command_desc: &'static str,
    pub extract_key_command_desc: &'static str,

    pub key_arg_desc: &'static str,
    pub file_arg_desc: &'static str,
    pub engine_arg_desc: &'static str,

    pub asset_command_desc: &'static str,

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
    pub force_mode_warning: &'static str,
    pub custom_processing_enabled_msg: &'static str,
    pub enabling_romanize_metadata_msg: &'static str,
    pub disabling_custom_processing_metadata_msg: &'static str,
    pub enabling_trim_metadata_msg: &'static str,
    pub no_subcommand_specified_msg: &'static str,
    pub could_not_determine_game_engine_msg: &'static str,
    pub game_ini_file_missing_msg: &'static str,
    pub ignore_file_does_not_exist_msg: &'static str,
    pub could_not_decrypt_ini_file_msg: &'static str,
    pub engine_argument_required_msg: &'static str,

    // Misc
    pub possible_values: &'static str,
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
                r#"<bold>This tool allows to parse RPG Maker XP/VX/VXAce/MV/MZ games text to .txt files and write them back to their initial form. The program will always use "original" or "data" directories for original files, and "translation" directory to operate with translation files. It will also decrypt any .rgss encrypted archive if it's present.</>"#
            ),
            help_template: cstr!(
                "{about}\n\n<underline,bold>Usage:</> rvpacker-txt-rs COMMAND [OPTIONS]\n\n<underline,bold>Commands:</>\n{subcommands}\n\n<underline,bold>Options:</>\n{options}"
            ),
            subcommand_help_template: cstr!(
                "{about}\n\n<underline,bold>Usage:</> {usage}\n\n<underline,bold>Options:</>\n{options}"
            ),

            // Command descriptions
            read_command_desc: cstr!(
                r#"<bold>Parses game files, and decrypts .rgss archive if it's present.</>"#
            ),
            write_command_desc: cstr!(
                r#"<bold>Writes translated game files to the "output" directory.</>"#
            ),
            purge_command_desc: cstr!(r#"<bold>Purges lines from ".txt" translation files.</>"#),

            json_help_template: cstr!("{about}\n\n<underline,bold>Commands:</>\n{subcommands}\n\n<underline,bold>Options:</>\n{options}"),
            json_command_desc: cstr!(r#"<bold>Provides the commands for JSON generation and writing.</>"#),

            input_dir_arg_desc: r#"Input directory, containing game files."#,
            output_dir_arg_desc: r#"Output directory to output files to."#,

            disable_processing_arg_desc: "Skips processing specified files. plugins can be used interchangeably with scripts.",

            romanize_desc: "If you parsing text from a Japanese game, that contains symbols like 「」, which are just the Japanese quotation marks, it automatically replaces these symbols by their roman equivalents (in this case, '').\nThis argument will automatically be set on write/read with --mode append/purge commands if you parsed game text with it.",

            disable_custom_processing_desc: "Disables built-in custom processing, implemented for some games.\nThis argument will automatically be set on write/read with --mode append/purge commands if you parsed game text with it.",
            language_arg_desc: "Sets the localization of the tool to the selected language.",

            log_arg_desc: "Enables logging.",
            help_arg_desc: "Prints the program's help message or for the entered subcommand.",

            read_mode_arg_desc: "How to process files. default - Aborts processing if encounters already existing translation .txt files.\nappend - For example, if game you're translating updates, you can use this flag to append any new text to your existing files preserving lines order.\nforce - Force rewrites existing translation .txt files.",

            stat_arg_desc: "Outputs unused lines to stat.txt file, leaving translation unchanged. Incompatible with preserve maps processing mode.",
            leave_filled_flag_desc: "Doesn't purge the lines, that have translation.",
            purge_empty_flag_desc: "Purge only the lines, that don't have the translation.",
            create_ignore_flag_desc: "Create an ignore file from purged lines, to prevent their further appearance when using --mode append. Incompatible with preserve maps processing mode.",

            generate_json_command_desc: cstr!(r#"<bold>Generates JSON representations of older engines' files in "json" directory.</>"#),
            write_json_command_desc: cstr!(r#"<bold>Writes JSON representations of older engines' files from "json" directory back to original files.</>"#),

            version_flag_desc: "Show program's version.",
            ignore_flag_desc: cstr!("Ignore entries from .rvpacker-ignore file. <bold>WORKS ONLY WITH --mode append!</>"),

            sort_flag_desc: cstr!("Sort the translation entries according to their order in game.\n<bold>WORKS ONLY WITH --mode append!</>"),
            trim_flag_desc: cstr!("Remove the leading and trailing whitespace from extracted strings. <bold>COULD LEAD TO NON-WORKING WRITING OR INCORRECT DISPLAYING OF TEXT!</>"),

            decrypt_command_desc: "Decrypts encrypted assets.\n.rpgmvo/.ogg_ => .ogg\n.rpgmvp/.png_ => .png\n.rpgmvm/.m4a_ => .m4a",
            encrypt_command_desc: "Encrypts .png/.ogg/m4a assets.\n.ogg => .rpgmvo/.ogg_\n.png => .rpgmvp/.png_\n.m4a => .rpgmvm/.m4a_",
            extract_key_command_desc: "Extracts key from file, specified in --file argument.",

            key_arg_desc: "Encryption key for encrypt/decrypt operations.",
            file_arg_desc: "File path (for single file processing or key extraction).",
            engine_arg_desc: r#"Game engine ("mv" or "mz")."#,

            asset_command_desc: "Decrypt/encrypt RPG Maker MV/MZ audio and image assets.",

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
            translation_dir_missing: r#"The "translation" folder in the input directory does not exist."#,

            elapsed_time_msg: "Elapsed:",
            force_mode_warning: "WARNING! Force mode will forcefully rewrite all your translation files in the folder, including _trans. Input 'Y' to continue.",
            custom_processing_enabled_msg: "Custom processing for this game will be used. Use --disable-custom-processing to disable it.",
            enabling_romanize_metadata_msg: "Enabling romanize according to the metadata from previous read.",
            disabling_custom_processing_metadata_msg: "Disabling custom processing according to the metadata from previous read.",
            enabling_trim_metadata_msg: "Enabling trimming according to the metadata from previous read.",
            no_subcommand_specified_msg: "No command was specified. Call rvpacker-txt-rs -h for help.",
            could_not_determine_game_engine_msg: "Couldn't determine game engine. Check the existence of System file inside your data/original directory.",
            game_ini_file_missing_msg: "Game.ini file not found.",
            ignore_file_does_not_exist_msg: ".rvpacker-ignore file does not exist. Aborting execution.",
            could_not_decrypt_ini_file_msg: "Couldn't decrypt Game.ini file. You can try to turn it UTF-8 yourself, after that everything will work.",
            engine_argument_required_msg: "--engine argument is required.",

            // Misc
            possible_values: "Allowed values:",
            example: "Example:",
            default_value: "Default value:",
            aliases: "Aliases:"
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

            read_command_desc: cstr!(
                r#"<bold>Парсит файлы из папки "original" или "data" ("Data") входной директории в папку "translation" выходной директории. Если папка "Data" не существует, а во входной директории есть архив .rgss, программа автоматически расшифровывает его.</>"#
            ),
            write_command_desc: cstr!(
                r#"<bold>Записывает переведенные файлы, используя исходные файлы из папки "original" или "data" ("Data") входной директории, применяя текст из .txt файлов папки "translation", выводя результаты в папку "output" выходной директории.</>"#
            ),
            purge_command_desc: cstr!(r#"<bold>Удаляет неиспользуемые строки из текстовых файлов перевода.</>"#),
            json_help_template: cstr!("{about}\n\n<underline,bold>Использование:</> {usage}\n\n<underline,bold>Команды:</>\n{subcommands}\n\n<underline,bold>Опции:</>\n{options}"),
            json_command_desc: cstr!(r#"Предоставляет команды для генерации JSON файлов и их записи."#),

            input_dir_arg_desc: r#"Входная директория, содержащая файлы игры."#,
            output_dir_arg_desc: r#"Выходная директория, в которую будут помещены выходные файлы."#,
            disable_processing_arg_desc: "Не обрабатывает указанные файлы. plugins может применятся взаимозаменяемо со scripts.",

            romanize_desc: "Если вы парсите текст из японской игры, содержащей символы вроде 「」, являющимися обычными японскими кавычками, программа автоматически заменяет эти символы на их европейские эквиваленты. (в данном случае, '').\nЭтот аргумент будет автоматически установлен при командах write/read вместе с --mode append/purge, если текст игры был прочитан с его использованием.",

            disable_custom_processing_desc: "Отключает использование индивидуальных способов обработки текста, имплементированных для некоторых игр.\nЭтот аргумент будет автоматически установлен при командах write/read вместе с --mode append/purge, если текст игры был прочитан с его использованием.",
            language_arg_desc: "Устанавливает локализацию инструмента на выбранный язык.",

            log_arg_desc: "Включает логирование.",
            help_arg_desc: "Выводит справочную информацию по программе либо по введёной команде.",

            read_mode_arg_desc: "Как обрабатывать файлы.\ndefault - Стандартный режим. Прекращает обработку, если .txt файлы перевода уже существуют.\nappend - Режим добавления. Например, если переводимая вами игра обновится, вы можете использовать этот аргумент чтобы добавить любой новый текст в существующие файлы, сохраняя порядок линий.\nforce - Принудительный режим. Принудительный режим перезаписывает существующие .txt файлы.",

            stat_arg_desc: "Выводит неиспользуемые строки в файл stat.txt, не производя никаких изменений в файлах перевода.",
            leave_filled_flag_desc: "Удаляет только неиспользуемые строки без перевода.",
            purge_empty_flag_desc: "Удалить только те строки, что не имеют перевода.",
            create_ignore_flag_desc: "Создать файл игнорирования удалённых строк, чтобы они не появились при последующих чтениях при помощи --mode append.",

            generate_json_command_desc: r#"Генерирует JSON-репрезентации файлов старых движков в директории "json"."#,
            write_json_command_desc: r#"Записывает JSON-репрезентации файлов старых движков из директории "json" обратно в исходные файлы."#,

            version_flag_desc: "Отобразить версию программы.",
            ignore_flag_desc: cstr!("Игнорировать строки из файла .rvpacker-ignore. <bold>РАБОТАЕТ ТОЛЬКО ПРИ --mode append!</>"),

            sort_flag_desc: cstr!("Отсортировать строки перевода в соответствии с их порядком в игре. <bold>РАБОТАЕТ ТОЛЬКО ПРИ --mode append!</>"),
            trim_flag_desc: cstr!("Удалить лишние начальные и конечные пробелы из распарсенного текста. <bold>МОЖЕТ ПРИВЕСТИ К НЕРАБОЧЕЙ ИЛИ НЕКОРРЕКТНОЙ ЗАПИСИ ТЕКСТА!</>"),

            decrypt_command_desc: "Расшифровывает зашифрованные ассеты.\n.rpgmvo/.ogg_ => .ogg\n.rpgmvp/.png_ => .png\n.rpgmvm/.m4a_ => .m4a",
            encrypt_command_desc: "Зашифровывает ассеты .png/.ogg/m4a.\n.ogg => .rpgmvo/.ogg_\n.png => .rpgmvp/.png_\n.m4a => .rpgmvm/.m4a_",
            extract_key_command_desc: "Достаёт ключ из файла, указанного в аргументе --file.",

            key_arg_desc: "Ключ шифрования для команд encrypt/decrypt.",
            file_arg_desc: "Путь к файлу (для обработки одного файла или доставания ключа).",
            engine_arg_desc: r#"Движок игры ("mv" или "mz")"#,

            asset_command_desc: "Decrypt/encrypt RPG Maker MV/MZ audio and image assets.",

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
            force_mode_warning: "ПРЕДУПРЕЖДЕНИЕ! Принудительный режим полностью перепишет все ваши файлы перевода, включая _trans-файлы. Введите Y, чтобы продолжить.",
            custom_processing_enabled_msg: "Индивидуальная обработка текста будет использована для этой игры. Используйте --disable-custom-processing, чтобы отключить её.",
            enabling_romanize_metadata_msg: "В соответствии с метаданными из прошлого чтения, романизация текста будет использована.",
            disabling_custom_processing_metadata_msg: "В соответсвии с метаданными из прошлого чтения, индивидуальная обработка текста будет выключена.",
            enabling_trim_metadata_msg: "В соответствии с метаданными из прошлого чтения, удаление лишних пробелов будет включено.",
            no_subcommand_specified_msg: "Команда не была указана. Вызовите rvpacker-txt-rs -h для помощи.",
            could_not_determine_game_engine_msg: "Не удалось определить движок игры. Убедитесь, что файл System существует.",
            game_ini_file_missing_msg: "Файл Game.ini не был обнаружен.",
            ignore_file_does_not_exist_msg: "Файл .rvpacker-ignore не существует. Прерываем выполнение.",
            could_not_decrypt_ini_file_msg: "Не удалось расшифровать файл Game.ini. Вы можете вручную конвертировать его в UTF-8, после этого всё заработает.",
            engine_argument_required_msg: "Аргумент --engine необходим.",

            possible_values: "Разрешённые значения:",
            example: "Пример:",
            default_value: "Значение по умолчанию:",
            aliases: "Также:"
        }
    }
}
