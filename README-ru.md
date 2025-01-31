# rvpacker-txt-rs

## Основная информация

Этот инструмент предназначен для чтения файлов RPG Maker игр в .txt файлы и записывания их обратно в изначальную форму.

Своё имя этот инструмент наследует от оригинального инструмента `rvpacker`, который был создан ещё для тех версий RPG Maker, что не использовали .json файлы, и который парсил файлы в YAML. В данный момент, репозиторий rvpacker удалён либо скрыт, а страница его автора также удалена.

Устаревший инструмент с тем же функционалом, написанный на Ruby, можно найти в [репозитории rvpacker-txt](https://github.com/savannstm/rvpacker-txt).

[Графический интерфейс](https://github.com/savannstm/rpgmtranslate), позволяющий удобно редактировать обработанные файлы (а также автоматически парсящий нераспарсенные игры, когда вы выбираете их папку) (и вы также можете легко записывать файлы обратно в изначальный вид одним нажатием кнопки).

Библиотека, лежащая в основе этого интерфейса может быть найдена [здесь](https://github.com/savannstm/rvpacker-txt-rs-lib);

## Формат выходных файлов

`rvpacker-txt-rs` парсит весь оригинальный текст из файлов игры, и помещает его на каждую линию текстового файла. Все переносы линий (переносы строк, новые линии, `\n`) заменяются на символы `\#`.
В конце каждой оригинальной строки, программа вставляет символы `<#>`. Это - разделитель, после которого должен начинаться переведённый текст. Удаление этого разделителя или нарушение его символов может привести к ошибкам, или хуже, неопределённому поведению программы. **Помните: ваш переведённый текст всегда должен начинаться после разделителя `<#>`.**

Для примера, как правильно переводить .txt файлы, обратитесь к моему [Русскому переводу на Fear & Hunger 2: Termina](https://github.com/savannstm/fh2-termina-translation).

## Установка

Скачать бинарные файлы можно в разделе Releases.

Файлы с расширением .exe предназначены для Windows x64, в то время как файлы без расширения предназначены для Linux x64.

## Использование

Получить справку по использованию можно, вызвав `rvpacker-txt-rs -h`.

```text
Инструмент, позволяющий парсить текст из файлов RPG Maker XP/VX/VXAce/MV/MZ игр в .txt файлы, а затем записывать их
обратно в совместимые файлы.

Использование: rvpacker-txt-rs КОМАНДА [ОПЦИИ]

Команды:
  read
          Парсит файлы из папки "original" или "data" ("Data") входной директории в папку "translation" выходной
          директории. Если папка "Data" не существует, а во входной директории есть архив .rgss, программа автоматически
          расшифровывает его.
  write
          Записывает переведенные файлы, используя исходные файлы из папки "original" или "data" ("Data") входной
          директории, применяя текст из .txt файлов папки "translation", выводя результаты в папку "output" выходной
          директории.
  migrate
          Переносит проекты версий v1/v2 в формат v3. Примечание: названия карт в версии 3 реализованы по-другому,
          поэтому вам следует выполнить read --append после переноса, а затем вставить переведенные названия карт рядом
          с комментариями Mapxxx.json, которые содержат оригинальное название карты.

Опции:
  -i, --input-dir <ВХОДНОЙ_ПУТЬ>
          При чтении: Входная директория, содержащая папку "original" или "data" ("Data") с оригинальными файлами игры.
          При записи: Входная директория, содержащая папку "original" или "data" ("Data") с оригинальными файлами игры,
          а также папку "translation" с .txt файлами перевода.
  -o, --output-dir <ВЫХОДНОЙ_ПУТЬ>
          При чтении: Выходная директория, где будет создана папка "translation" с .txt файлами перевода.
          При записи: Выходная директория, где будет создана папка "output" с подпапками "data" ("Data") и/или "js",
          содержащими игровые файлы с переведённым текстом из .txt файлов.
      --disable-processing <ИМЕНА_ФАЙЛОВ>
          Не обрабатывает указанные файлы.
          Пример: --disable-processing=maps,other,system
          [Разрешённые значения: maps, other, system, plugins]
          [Также: no]
  -r, --romanize
          Если вы парсите текст из японской игры, содержащей символы вроде 「」, являющимися обычными японскими кавычками,
          программа автоматически заменяет эти символы на их европейские эквиваленты. (в данном случае, '')
      --maps-processing-mode <РЕЖИМ>
          Как обрабатывать карты.
          default - Игнорировать дубликаты всего ранее встреченного текста.
          separate - Для каждой новой карты, обновлять список ранее встреченного текста.
          preserve - Разрешить все дубликаты текста.
          [Разрешённые значения: default, separate, preserve]
          [Значение по умолчанию: default]
          [Также: maps-mode]
      --disable-custom-processing
          Отключает использование индивидуальных способов обработки текста, имплементированных для некоторых игр. Этот
          флаг будет автоматически применён при записи, если текст игры был прочитан с его использованием.
          [Также:
          no-custom]
  -l, --language <ЯЗЫК>
          Устанавливает локализацию инструмента на выбранный язык.
          Пример: --language en
          [Разрешённые значения: en, ru]
      --log
          Включает логирование.
  -h, --help
          Выводит справочную информацию по программе либо по введёной команде.
```

Например:

`rvpacker-txt-rs read --input-dir "E:/Documents/RPGMakerGame"` распарсит текст игры в папку `translation` указанной директории.

`rvpacker-txt-rs write --input-dir "E:/Documents/RPGMakerGame"` запишет перевод из \_trans файлов папки `translation` в совместимые файлы в папке `output`.

Инструмент не парсит текст из файла plugins.js, так как является очень затруднительным вычленить отображаемый в игре текст из плагинов.

## Лицензия

Репозиторий лицензирован под [WTFPL](http://www.wtfpl.net/).
Это означает, что вы можете безнаказанно использовать и модифицировать программу в каком угодно виде. Вы можете делать всё, что захотите.
