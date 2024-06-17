# RU

# Строение репозитория и использование программы

## Директория cli

В данной директории хранится версия с командным интерфейсом программы. Это - ваш выбор, если вы хотите отредактировать .txt файлы и быстро записать их используя .exe (или бинарный файл без расширения на Linux).

После того, как вы внесли изменения в файлы \_trans.txt в директории `translation` - **запустите бинарный файл json-writer с командой write**.

Вы также можете использовать команду `read`, чтобы извлечь текст из .json файлов, находящихся в директории `original`. Проще говоря, это значит что вы можете переместить .json файлы любой игры, сделанной с помощью RPG Maker MV в директорию `original`, а затем извлечь их используя **json-writer read**.
Извлеченный текст в формате .txt файлов будет находится по пути `cli/translation`.

json-writer поддерживает различные команды и аргументы - чтобы получить сводку, вызовите `json-writer -h` или `json-writer --help`.

**Через несколько секунд, он создаст конечные файлы в директориях `data` и `js`, которые вы можете скопировать в директорию `www`, находящуюся в корне игры `(C:\Program Files (x86)\Steam\steamapps\common\Fear & Hunger 2 Termina\www)` с заменой.**

## Директория gui

В этой директории хранится исходный код новой версии программы, написанной на Tauri.

Сообщения об ошибках и коммиты приветствуются.

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

This directory contains program's CLI verison. This is your choice, if you want to quickly edit .txt files and quickly compile them using .exe (or binary without extension on linux).

After you edited the \_trans.txt files in `translation` directory - **run json-writer binary with write command**.

You can also use the `read` command to extract the text from .json files located in the `original` directory. Simply put, it means that you can move .json files of any game made with RPG Maker MV to the `original` directory, and then extract them using **json-writer read**.
The extracted text in the .txt files format will be located in the `cli/translation` path.

json-writer supports different commands and arguments - to receive help, use `json-writer -h` or `json-writer --help`.

**After a few seconds, it'll create compiled files in `data` and `js` directories, which you can copy and replace to the `www` directory which in the game's root directory (C:\Program Files (x86)\Steam\steamapps\common\Fear & Hunger 2 Termina\www).**

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
