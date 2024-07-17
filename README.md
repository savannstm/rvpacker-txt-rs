# rvpacker-json-txt

[README на русском](https://github.com/savannstm/rpg-maker-translation-tools/blob/main/README-ru.md)

## General

This tool is designed to read RPG Maker game files into .txt files and write them back to .json.

This tool inherits its name from the original rvpacker tool, which was created for those versions of RPG Maker that did not use .json files.

This tool for RPG Maker XP, VX and VX Ace engines that don't use .json files can be found in [this repository](https://github.com/savannstm/rvpacker-txt).

[A GUI](https://github.com/savannstm/rpgm-translation-gui) that allows comfortably edit parsed files (and it also automatically parses unparsed games when you select their folder) (and you also can easily write files back to .json with a single button click) (and it also supports RPG Maker XP, VX and VX Ace!)

## Installation

You can download binary files in the Releases section.

Files with the .exe extension are designed for Windows x64, while files without an extension are designed for Linux x64.

## Usage

You can get help on usage by calling `json-writer -h.`

```
A tool that parses .json files of RPG Maker MV/MZ games into .txt files and vice versa.

Usage: rvpacker-json-txt.exe [OPTIONS] [COMMAND]

Commands:
  read   Parses files from "original" or "data" folders of input directory to "translation" folder of output
             directory.
  write  Writes translated files using original files from "original" or "data" folders of input directory and
             writes results to "output" folder of output directory.

Options:
  -i, --input-dir <INPUT_PATH>    Input directory, containing folders "original" or "data" and "translation", with
                                  original game text and .txt files with translation respectively.
  -o, --output-dir <OUTPUT_PATH>  Output directory, containing an "output" folder with folders "data" and "js",
                                  containing compiled .txt files with translation.
  -l, --language <LANGUAGE>       Sets the localization of the tool to the selected language. Example: --language en.
                                  [Allowed values: ru, en]
      --log                       Enables logging.
      --disable-custom-parsing    Disables built-in custom parsing for some games.
  -h, --help                      Prints the program's help message or for the entered subcommand.
```

Examples:

`rvpacker-json-txt read --input-dir "E:/Documents/RPGMakerGame"` parses the text of the game into the `translation` folder of the specified directory.

`rvpacker-json-txt write --input-dir E:/Documents/RPGMakerGame"` will write the translation from the \_trans files of the `translation` folder to .the json files to the `output` folder.

The tool does not parse text from a plugins.js file since it is very difficult to isolate the text displayed in the game from the plugins.

## License

The repository is licensed under [WTFPL](http://www.wtfpl.net/).
This means that you can use and modify the program in any way. You can do what the fuck you want to.
