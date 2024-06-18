# RU

# Строение репозитория и использование программы

## Директория cli

В данной директории хранится бинарный файл `json-writer`, позволяющий парсить текст игр на движках RPG Maker MV/MZ,
а затем записывать его обратно в рабочие игровые .json файлы.

Получить справку по его использованию можно с помощью `json-writer -h`.

В директории `ruby-writer` хранятся TypeScript файлы утилиты `ruby-writer`, позволяющей парсить текст игр на движках RPG Maker XP/VX/VX Ace, а затем записывать его обратно в рабочие игровые .rxdata, .rvdata или .rvdata2 файлы.

Тип движка игры, текст которой парсится и записывается, утилита определяет автоматически.

Для использования, вам необходим [Bun](https://bun.sh/). После его установки, вам необходимо выполнить команду `bun i` для установки зависимостей утилиты, а затем вы можете получить справку по ней, используя `bun run ruby-writer.ts -h`.

## Директория gui

В этой директории хранится исходный код новой версии программы, написанной на Tauri.

Сообщения об ошибках и коммиты приветствуются.

**Скачать последнюю версию можно из вкладки Releases.**

### Билдинг приложения

Клонируйте репозиторий с помощью\
`git clone https://github.com/savannstm/rpg-maker-translation-tools.git`.

Перейдите в директорию `gui` и установите все необходимые Node.js библиотеки с помощью\
`npm install`.

Запустите\
`npm run tauri dev`,\
чтобы запустить приложение в девелопер режиме, либо\
`npm run tauri build`,\
чтобы забилдить приложение под вашу текущую ОС.

Если вы хотите внести какие-то изменения в код проекта - вносите его в фронтенд файлы из директории `src`, либо бэкенд файлы из директории `src-tauri/src`.

После билдинга в директории `gui/src-tauri` появится директория `target`, содержащая бинарный файл с билдом программы и распространяемые пакеты в директории `target/bundle`.

# EN

# Repository order and program usage

## cli Directory

This directory contains a binary file `json-writer`, which allows you to parse the text of games on the RPG Maker MV/MZ engine,
and then write it back to the working game.json files.

You can get help using it using `json-writer -h'.

The `ruby-writer` directory stores TypeScript files of the `ruby-writer` utility, which allows you to parse the text of games on RPG Maker XP/VX/VX Ace engines, and then write it back to working game .rxdata, .rvdata or .rvdata2 files.

The utility automatically determines the type of the game engine, the text of which is parsed and written.

To use it, you need [Bun](https://bun.sh/). After installing it, you need to run the `bun i` command to install the utility's dependencies, and then you can get help on it using `bun run ruby-writer.ts -h`.

## gui Directory

This directory contains the source code of new program version, written with Tauri.

Issues and commits are welcome.

### Program manual building

Clone the repository with\
`git clone https://github.com/savannstm/rpg-maker-translation-tools.git`.

cd to the `gui` directory and install all needed node.js dependencies with\
`npm install`.

Run\
`npm run tauri dev`,\
to run the program in dev mode, or\
`npm run tauri build`,\
to build the program for your current OS.

If you want to make some edits to the source code - edit frontend files in `src` directory, or backend files in `src-tauri/src` directory.

After the build, `target` directory will be created in the `gui/src-tauri` path, containing binary file with program build and distributable bundled packages in the `target/bundle` directory.
