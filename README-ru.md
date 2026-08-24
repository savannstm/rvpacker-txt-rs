# rvpacker-txt-rs

Инструмент для командной строки, достающий текст для перевода из игр RPG Maker XP/VX/VX Ace/MV/MZ и помещающий их в обычные `.txt` файлы, а также записывающий переведённые `.txt` файлы обратно в исходный формат. Он также расшифровывается `.rgss` архивы если таковые присутствуют.

Он основан на [rvpacker-txt-rs-lib](https://github.com/RPG-Maker-Translation-Tools/rvpacker-txt-rs-lib) - используйте эту библиотеку если хотите построить свой инструмент.

## Связанные инструменты

- [rpgmtranslate-qt](https://github.com/RPG-Maker-Translation-Tools/rpgmtranslate-qt) - графический интерфейс позволяющий комфортно переводить `.txt` файлы.
- [rpgm-asset-decrypter-rs](https://github.com/rpg-maker-translation-tools/rpgm-asset-decrypter-rs) и [rpgm-archive-decrypter](https://github.com/RPG-Maker-Translation-Tools/rpgm-archive-decrypter) - командные инструменты для расшифровки/зашифровки ассетов и `.rgss` архивов.
- [rpgmdec](https://github.com/RPG-Maker-Translation-Tools/rpgmdec) - графический интерфейс объединяющий оба вышеупомянутых инструмента, если вы не фанат командной строки.

Этот инструмент наследует своё имя от оригинального `rvpacker`, написанного для версий RPG Maker не использующих JSON файлы, и парсящий их в YAML; его репозиторий больше не существует. Оригинальный Ruby инструмент лежит здесь - [rvpacker-txt](https://github.com/savannstm/rvpacker-txt).

## Установка

Установите скомпилированный релиз из вкладки [Releases](https://github.com/RPG-Maker-Translation-Tools/rvpacker-txt-rs/releases) или забилдите из исходника:

```bash
cargo install --path .
```

## Как оно работает

### Расположение папок

Передайте папку, содержающую подпапку `data`/`Data` аргументу `--input-dir` (`-i`, defaults to `./`), папка может содержать `Game.ini` или `.rgss` архив у старых движков. Движок автоматически опреедляется из `System.*` файла/архива - не надо ничего выбирать вручную.

`read` записывает `.txt` файлы в `<output-dir>/translation`; `write` читает перевод и записывает игровые файлы в `<output-dir>/output`. `--output-dir` (`-o`) по умолчанию выводит файлы во входную директорию, так что и перевод, и выход находятся в директории игры, если их не менять.

### Формат файлов перевода

Каждый `.txt` файл имеет одну запись на строку: исходный текст, затем разделитель `<#>`, затем перевод. Переносы строк в исходном тексте нормализуются в `\#` чтобы не мешать переносам строк в самом файле перевода - перевод также должен использовать `\#`.

```txt
<!>ID<#>2
<!>NAME<#>Город
<!>ORDER<#>157
<!>IN-GAME DISPLAYED NAME: Город<#>Переведённый город
Это текст<#>Это переведённый текст
Это текст на\#несколько строк<#>Это переведённый текст на\#несколько строк
```

`<#>`, `\#` и `<!>` (префикс для комментариев) могут быть изменены на проект используя `--line-separator`, `--line-break` и `--comment-prefix` - посмотрите [глобальные опции](#global-options). Полный формат, включая комментарии и обработка дубликатов указаны в [README библиотеки](https://github.com/RPG-Maker-Translation-Tools/rvpacker-txt-rs-lib#translation-file-format).

### `.rvpacker-metadata` и `.rvpacker-ignore`

Каждая `read` команда записывает файл `.rvpacker-metadata` в директорию `translation`, запоминая режим дубликатов, настройки особых символов и хэши файлов. Поздние команды `read --read-mode append`/`write`/`purge` автоматически всё подгружают, так что можно установить настройки проекта один раз и забыть.

`.rvpacker-ignore` позволяет вам исключать определённые линии из доставаемого текста - полезно для неиспользуемых или повторяющихся строк, которые никогда не отобразятся в игре. Используйте `--ignore` для команды `read` чтобы применить файл, либо `--create-ignore` для команды `purge` чтобы сгенерировать файл из очищенных строк. Посмотрите [README библиотеки](https://github.com/RPG-Maker-Translation-Tools/rvpacker-txt-rs-lib#rvpacker-ignore) для синтаксиса файла, и [`examples/.rvpacker-ignore`](https://github.com/RPG-Maker-Translation-Tools/rvpacker-txt-rs-lib/blob/main/examples/.rvpacker-ignore) для рабочего примера.

## Использование

Запустите `rvpacker-txt-rs -h` для общего руководства, или `rvpacker-txt-rs <command> -h` для опций на команду.

### `read`

Вытягивает текст из игровых файлов в `translation/*.txt`.

```bash
rvpacker-txt-rs read -i "C:/Game"
```

### `write`

Записывает переведённые `.txt` файлы в оригинальный формат, в `<output-dir>/output`.

```bash
rvpacker-txt-rs write -i "C:/Game"
```

### `purge`

Очищает строки с отсутствующим переводом.

```bash
rvpacker-txt-rs purge -i "C:/Game"
```

### `json`

Конвертирует бинарные данные RPG Maker XP/VX/VX Ace в и из JSON, независимо от файлов перевода.

```bash
rvpacker-txt-rs json generate -i "C:/Game"   # записывает C:/Game/json/*.json (и Scripts.rb)
rvpacker-txt-rs json write -i "C:/Game"      # записывает C:/Game/json обратно в C:/Game/json-output
```

### Глобальные опции

Применяются к каждой команде:

- `-i, --input-dir <PATH>` - по умолчанию `./`.
- `-o, --output-dir <PATH>` - по умолчанию входная директория.
- `--line-separator <SEPARATOR>`, `--line-break <BREAK>`, `--comment-prefix <PREFIX>` - перезаписывают стандартные особые символы (`<#>`, `\#`, `<!>`). Прочтите [`.rvpacker-metadata` и `.rvpacker-ignore`](#rvpacker-metadata-and-rvpacker-ignore) касательно того как всё вяжется.
- `-v`/`-q` - повысить/понизить логирование.

## Поддержка

[Я](https://github.com/savannstm), мейнтейнер данного проекта, бедный студентик из Восточной Европы.

Если можете, поддержите нас через:

- [Ko-fi](https://ko-fi.com/savannstm)
- [Patreon](https://www.patreon.com/cw/savannstm)
- [Boosty](https://boosty.to/mcdeimos)

Даже если не поддержите, чёрт с ним. Я буду дальше ерундой своей заниматься.

## License

Проект лицензирован под [WTFPL](https://www.wtfpl.net/).
