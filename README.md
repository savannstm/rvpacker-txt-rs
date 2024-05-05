# RU

# Строение репозитория и использование программы

## Директория cli

В данной директории хранится версия с командным интерфейсом программы. Это - ваш выбор, если вы хотите отредактировать .txt файлы и быстро записать их используя .exe (или бинарный файл без расширения на Linux).

После того, как вы внесли изменения в файлы \_trans.txt в директории `translation` - **запустите бинарный файл json-writer**.

json-writer поддерживает аргументы - чтобы получить сводку, вызовите `json-writer -h` или `json-writer --help`.

**Через несколько секунд, он создаст конечные файлы в директориях `data` и `js`, которые вы можете скопировать в директорию `www`, находящуюся в корне игры `(C:\Program Files (x86)\Steam\steamapps\common\Fear & Hunger 2 Termina\www)` с заменой.**

## Директория gui-tauri

В этой директории хранится исходный код новой версии программы, написанной на Tauri.

Сообщения об ошибках и коммиты приветствуются.

### Билдинг приложения

Клонируйте репозиторий с помощью\
`git clone https://github.com/savannstm/fh-termina-json-writer.git`.

Перейдите в директорию `gui-tauri` и установите все необходимые Node.js библиотеки с помощью\
`npm install`.

Запустите\
`npm run tauri dev`,\
чтобы запустить приложения в девелопер режиме, либо\
`npm run tauri build`,\
чтобы забилдить приложение под вашу текущую ОС.

Если вы хотите внести какие-то изменения в код проекта - вносите его в фронтенд файлы из директории `src-dev`, либо бэкенд файлы из директории `src-tauri/src`.

После билдинга в директории `gui-tauri/src-tauri` появится директория `target`, содержащая бинарный файл с билдом программы и распространяемые пакеты в директории `target/bundle`.

## Директория translation

В этой директории хранятся файлы локализации в формате .txt. Если вы хотите что-то изменить - вы должны отредактировать именно их, а затем записать используя бинарные CLI файлы, либо скомпилировать используя программу с графическим интерфейсом.

### Директория maps

В этой директории хранится игровой текст из файлов Maps.json.
В файлах без префикса \_trans находится оригинальный текст игры (его лучше не редактировать), а в файлах C этим префиксом лежит переведенный текст, который вы можете отредактировать.

### Директория other

В этой директории хранится игровой текст НЕ из файлов Maps.json.
В файлах без префикса \_trans находится оригинальный текст игры (его лучше не редактировать), а в файлах C этим префиксом лежит переведенный текст, который вы можете отредактировать.

### Директория plugins

В этой директории хранится игровой текст из файла plugins.js.
В файлах без префикса \_trans находится оригинальный текст игры (его лучше не редактировать), а в файлах C этим префиксом лежит переведенный текст, который вы можете отредактировать.

# EN

# Repository order and program usage

## cli Directory

This directory contains program's CLI verison. This is your choice, if you want to quickly edit .txt files and quickly compile them using .exe (or binary without extension on linux).

After you edited the \_trans.txt files in `translation` directory - **run json-writer binary**.

json-writer supports arguments - to receive help, use `json-writer -h` or `json-writer --help`.

**After a few seconds, it'll create compiled files in `data` and `js` directories, which you can copy and replace to the `www` directory which in the game's root directory (C:\Program Files (x86)\Steam\steamapps\common\Fear & Hunger 2 Termina\www).**

## gui-tauri Directory

This directory contains the source code of new program version, written with Tauri.

Issues and commits are welcome.

### Program manual building

Clone the repository with\
`git clone https://github.com/savannstm/fh-termina-json-writer.git`.

cd to the `gui-tauri` directory and install all needed node.js dependencies with\
`npm install`.

Run\
`npm run tauri dev`,\
to run the program in dev mode, or\
`npm run tauri build`,\
to build the program for your current OS.

If you want to make some edits to the source code - edit frontend files in `src-dev` directory, or backend files in `src-tauri/src` directory.

After the build, `target` directory will be created in the `gui-tauri/src-tauri` path, containing binary file with program build and distributable bundled packages in the `target/bundle` directory.

## translation Directory

This directory contains translation files with .txt extension. If you want to edit the translation - you need to edit exactly them, and then compile them using CLI binary, or compile with the GUI.

### maps Directory

This directory contains in-game text from Maps.json files.
Files without \_trans prefix contain original game translation (it's better to not to mess with them), and files WITH that prefix contain translated text, which you can freely edit.

### other Directory

This directory contains in-game text NOT from Maps.json files.
Files without \_trans prefix contain original game translation (it's better to not to mess with them), and files WITH that prefix contain translated text, which you can freely edit.

### plugins Directory

This directory contains in-game text from plugins.js file.
Files without \_trans prefix contain original game translation (it's better to not to mess with them), and files WITH that prefix contain translated text, which you can freely edit.
