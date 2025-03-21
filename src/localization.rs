use color_print::cstr;

pub enum Language {
    English,
    Russian,
}

pub struct Localization<'a> {
    // About message and templates
    pub about_msg: &'a str,
    pub help_template: &'a str,
    pub subcommand_help_template: &'a str,
    pub json_help_template: &'a str,

    // Command descriptions
    pub read_command_desc: &'a str,
    pub write_command_desc: &'a str,
    pub purge_command_desc: &'a str,
    pub json_command_desc: &'a str,

    // Argument descriptions
    pub input_dir_arg_desc: &'a str,
    pub output_dir_arg_desc: &'a str,

    pub disable_processing_arg_desc: &'a str,

    pub romanize_desc: &'a str,

    pub disable_custom_processing_desc: &'a str,

    pub language_arg_desc: &'a str,

    pub log_arg_desc: &'a str,
    pub help_arg_desc: &'a str,

    pub processing_mode_arg_desc: &'a str,
    pub maps_processing_mode_arg_desc: &'a str,

    pub stat_arg_desc: &'a str,
    pub leave_filled_flag_desc: &'a str,
    pub purge_empty_flag_desc: &'a str,
    pub create_ignore_flag_desc: &'a str,

    pub generate_json_command_desc: &'a str,
    pub write_json_command_desc: &'a str,

    pub version_flag_desc: &'a str,
    pub ignore_flag_desc: &'a str,

    pub trim_flag_desc: &'a str,
    pub sort_flag_desc: &'a str,

    // Argument types
    pub mode_arg_type: &'a str,
    pub input_path_arg_type: &'a str,
    pub output_path_arg_type: &'a str,
    pub disable_processing_arg_type: &'a str,
    pub language_arg_type: &'a str,

    // Messages and warnings
    pub input_dir_missing: &'a str,
    pub output_dir_missing: &'a str,
    pub translation_dir_missing: &'a str,
    pub elapsed_time_msg: &'a str,
    pub force_mode_warning: &'a str,
    pub custom_processing_enabled_msg: &'a str,
    pub enabling_romanize_metadata_msg: &'a str,
    pub disabling_custom_processing_metadata_msg: &'a str,
    pub enabling_trim_metadata_msg: &'a str,
    pub no_subcommand_specified_msg: &'a str,
    pub could_not_determine_game_engine_msg: &'a str,
    pub game_ini_file_missing_msg: &'a str,
    pub enabling_maps_processing_mode_metadata_msg: &'a str,
    pub purge_args_incompatible_with_preserve_mode_msg: &'a str,
    pub ignore_file_does_not_exist_msg: &'a str,
    pub could_not_decrypt_ini_file_msg: &'a str,

    // Misc
    pub possible_values: &'a str,
    pub example: &'a str,
    pub default_value: &'a str,
    pub aliases: &'a str,
}

impl Localization<'_> {
    pub const fn new(language: Language) -> Self {
        match language {
            Language::English => Self::init_en(),
            Language::Russian => Self::init_ru(),
        }
    }

    const fn init_en() -> Self {
        Localization {
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

            processing_mode_arg_desc: "How to process files. default - Aborts processing if encounters already existing translation .txt files.\nappend - For example, if game you're translating updates, you can use this flag to append any new text to your existing files preserving lines order.\nforce - Force rewrites existing translation .txt files.",
            maps_processing_mode_arg_desc: cstr!("How to process maps.\ndefault - Ignore all previously encountered text duplicates\nseparate - For each new map, reset the set of previously encountered text duplicates <bold>RECOMMENDED!</>\npreserve - Allow all text duplicates. <bold>NOT RECOMMENDED!</>\nThis argument will automatically be set on write/read with --mode append/purge commands if you parsed game text with it."),

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

            // Argument types
            mode_arg_type: "MODE",
            input_path_arg_type: "INPUT_PATH",
            output_path_arg_type: "OUTPUT_PATH",
            disable_processing_arg_type: "FILES",
            language_arg_type: "LANGUAGE",

            // Messages and warnings
            input_dir_missing: "Input directory does not exist.",
            output_dir_missing: "Output directory does not exist.",
            translation_dir_missing: r#"The "translation" folder in the input directory does not exist."#,

            elapsed_time_msg: "Elapsed time:",
            force_mode_warning: "WARNING! Force mode will forcefully rewrite all your translation files in the folder, including _trans. Input 'Y' to continue.",
            custom_processing_enabled_msg: "Custom processing for this game will be used. Use --disable-custom-processing to disable it.",
            enabling_romanize_metadata_msg: "Enabling romanize according to the metadata from previous read.",
            disabling_custom_processing_metadata_msg: "Disabling custom processing according to the metadata from previous read.",
            enabling_trim_metadata_msg: "Enabling trimming according to the metadata from previous read.",
            no_subcommand_specified_msg: "No command was specified. Call rvpacker-txt-rs -h for help.",
            could_not_determine_game_engine_msg: "Couldn't determine game engine. Check the existence of System file inside your data/original directory.",
            game_ini_file_missing_msg: "Game.ini file not found.",
            enabling_maps_processing_mode_metadata_msg: "Setting maps_processing_mode value to  according to the metadata from previous read.",
            purge_args_incompatible_with_preserve_mode_msg: "--stat and --create-ignore arguments are incompatble with preserve maps processing mode.",
            ignore_file_does_not_exist_msg: ".rvpacker-ignore file does not exist. Aborting execution.",
            could_not_decrypt_ini_file_msg: "Couldn't decrypt Game.ini file. You can try to turn it UTF-8 yourself, after that everything will work.",

            // Misc
            possible_values: "Allowed values:",
            example: "Example:",
            default_value: "Default value:",
            aliases: "Aliases:"
        }
    }

    const fn init_ru() -> Self {
        Localization {
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

            processing_mode_arg_desc: "Как обрабатывать файлы.\ndefault - Стандартный режим. Прекращает обработку, если .txt файлы перевода уже существуют.\nappend - Режим добавления. Например, если переводимая вами игра обновится, вы можете использовать этот аргумент чтобы добавить любой новый текст в существующие файлы, сохраняя порядок линий.\nforce - Принудительный режим. Принудительный режим перезаписывает существующие .txt файлы.",
            maps_processing_mode_arg_desc: "Как обрабатывать карты.\ndefault - Игнорировать дубликаты всего ранее встреченного текста.\nseparate - Для каждой новой карты, сбрасывать список ранее встреченного текста. <bold>РЕКОМЕНДУЕТСЯ!</>\npreserve - Разрешить все дубликаты текста. <bold>НЕ РЕКОМЕНДУЕТСЯ!</>\nЭтот аргумент будет автоматически установлен при командах write/read вместе с --mode append/purge, если текст игры был прочитан с его использованием.",

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

            mode_arg_type: "РЕЖИМ",
            input_path_arg_type: "ВХОДНОЙ_ПУТЬ",
            output_path_arg_type: "ВЫХОДНОЙ_ПУТЬ",
            disable_processing_arg_type: "ИМЕНА_ФАЙЛОВ",
            language_arg_type: "ЯЗЫК",

            input_dir_missing: "Входная директория не существует.",
            output_dir_missing: "Выходная директория не существует.",

            translation_dir_missing: r#"Папка "translation" входной директории не существует."#,

            elapsed_time_msg: "Затраченное время:",
            force_mode_warning: "ПРЕДУПРЕЖДЕНИЕ! Принудительный режим полностью перепишет все ваши файлы перевода, включая _trans-файлы. Введите Y, чтобы продолжить.",
            custom_processing_enabled_msg: "Индивидуальная обработка текста будет использована для этой игры. Используйте --disable-custom-processing, чтобы отключить её.",
            enabling_romanize_metadata_msg: "В соответствии с метаданными из прошлого чтения, романизация текста будет использована.",
            disabling_custom_processing_metadata_msg: "В соответсвии с метаданными из прошлого чтения, индивидуальная обработка текста будет выключена.",
            enabling_trim_metadata_msg: "В соответствии с метаданными из прошлого чтения, удаление лишних пробелов будет включено.",
            no_subcommand_specified_msg: "Команда не была указана. Вызовите rvpacker-txt-rs -h для помощи.",
            could_not_determine_game_engine_msg: "Не удалось определить движок игры. Убедитесь, что файл System существует.",
            game_ini_file_missing_msg: "Файл Game.ini не был обнаружен.",
            enabling_maps_processing_mode_metadata_msg: "Значение аргумента maps_processing_mode установлено на  в соответствии с метаданными из прошлого чтения.",
            purge_args_incompatible_with_preserve_mode_msg: "Аргументы --stat и --create-ignore несовместимы с режимом обработки карт preserve.",
            ignore_file_does_not_exist_msg: "Файл .rvpacker-ignore не существует. Прерываем выполнение.",
            could_not_decrypt_ini_file_msg: "Не удалось расшифровать файл Game.ini. Вы можете вручную конвертировать его в UTF-8, после этого всё заработает.",

            possible_values: "Разрешённые значения:",
            example: "Пример:",
            default_value: "Значение по умолчанию:",
            aliases: "Также:"
        }
    }
}
