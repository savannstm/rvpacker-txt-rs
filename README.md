# rvpacker-txt-rs

[README на русском](./README-ru.md)

## General

This tool is designed to read RPG Maker game files into `.txt` files and write them back to their initial form.

This tool inherits its name from the original `rvpacker` tool, which was created for those versions of RPG Maker that did not use .json files, and parsed files into YAML. Now, `rvpacker`'s repository is deleted.

The same deprecated tool, written in Ruby, can be found in [rvpacker-txt repository](https://github.com/savannstm/rvpacker-txt).

There's [a GUI](https://github.com/savannstm/rpgmtranslate), that allows you comfortably edit files.
An underlying library for this CLI can be found [here](https://github.com/savannstm/rvpacker-txt-rs-lib).

## The format of output files

`rvpacker-txt-rs` parses all the original text from the game's files, and inserts it on each new line of a text file. All line breaks (new lines, `\n`) are replaced by `\#` symbols.
At the end of each original line, `<#>` is inserted. This is a delimiter after which translated text should start. Removing it or erasing one of its symbols will lead to crashes, or worse, undefined behavior. **So remember: your translated text goes after the `<#>` delimiter.**

For an example on how to properly translate the .txt files, refer to [My Fear & Hunger 2: Termina Russian translation](https://github.com/savannstm/fh2-termina-translation).
Translation is Russian, but the point is to get how to properly translate this program's translation files.

## Installation

You can download binary files in the Releases section.

Files with the `.exe` extension are designed for Windows x64, while files without an extension are designed for Linux x64.

## Usage

You can get help on usage by calling `rvpacker-txt-rs -h.`

```text
This tool allows to parse RPG Maker XP/VX/VXAce/MV/MZ games text to .txt files and write them back to their initial
form. The program uses "original" or "data" directories for source files, and "translation" directory to operate with
translation files. It will also decrypt any .rgss archive if it's present.

Usage: rvpacker-txt-rs COMMAND [OPTIONS]

Commands:
  read
          Parses game files to .txt format, and decrypts any .rgss archive if it's present.
  write
          Writes translated game files to the "output" directory.
  purge
          Purges lines without translation from ".txt" translation files.
  json
          Provides the commands for JSON generation and writing.
  asset
          Decrypt/encrypt RPG Maker MV/MZ audio and image assets.

Options:
  -i, --input-dir <INPUT_PATH>
          Input directory, containing game files.
  -o, --output-dir <OUTPUT_PATH>
          Output directory to output files to.
  -l, --language <LANGUAGE>
          Sets the localization of the tool to the selected language.
          Example: --language en
          [Allowed values: en, ru]
  -v, --verbose
          Outputs full informating about processed files.
  -P, --progress
          Enables real-time progress logging.
  -V, --version
          Show program version.
  -h, --help
          Prints the program help message or for the entered subcommand.
```

Examples:

`rvpacker-txt-rs read -i "E:/Documents/RPGMakerGame"` parses the text of the game into the `translation` folder of the specified directory.

`rvpacker-txt-rs write -i "E:/Documents/RPGMakerGame"` writes the translation from `.txt` files of the `translation` folder to RPG Maker files in the `output` folder.

## License

The repository is licensed under [WTFPL](http://www.wtfpl.net/).
