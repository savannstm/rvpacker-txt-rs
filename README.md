# rvpacker-txt-rs

[README на русском](./README-ru.md)

A command-line tool that extracts the translatable text from RPG Maker XP/VX/VX Ace/MV/MZ game files into plain `.txt` files, and writes translated `.txt` files back into the game's original format. It also decrypts `.rgss` archives on the fly when it finds one.

It's built on top of [rvpacker-txt-rs-lib](https://github.com/RPG-Maker-Translation-Tools/rvpacker-txt-rs-lib) - reach for that crate instead if you're building your own tool rather than using this CLI directly.

## Related tools

- [rpgmtranslate-qt](https://github.com/RPG-Maker-Translation-Tools/rpgmtranslate-qt) - a GUI for comfortably editing the translation files this tool produces, if you'd rather not hand-edit `.txt` files.
- [rpgm-asset-decrypter-rs](https://github.com/rpg-maker-translation-tools/rpgm-asset-decrypter-rs) and [rpgm-archive-decrypter](https://github.com/RPG-Maker-Translation-Tools/rpgm-archive-decrypter) - CLIs for decrypting/encrypting assets and `.rgss` archives on their own.
- [rpgmdec](https://github.com/RPG-Maker-Translation-Tools/rpgmdec) - a GUI combining both decrypters, if you're not a fan of CLIs.

This tool inherits its name from the original `rvpacker`, written for the pre-JSON RPG Maker versions and parsing files into YAML; its repository no longer exists. The Ruby tool it was renamed from lives on at [rvpacker-txt](https://github.com/savannstm/rvpacker-txt).

## Installation

Download a prebuilt executable for your platform from the [Releases](https://github.com/RPG-Maker-Translation-Tools/rvpacker-txt-rs/releases) section, or build from source:

```bash
cargo install --path .
```

## How it works

### Directory layout

Point `--input-dir` (`-i`, defaults to `./`) at a folder containing either a `data`/`Data` directory (XP/VX/VX Ace) or the MV/MZ equivalent, plus `Game.ini` and any `.rgss` archive for the older engines. The engine is detected automatically from whichever `System.*`/archive combination is present - there's nothing to select manually.

`read` writes `.txt` files into `<output-dir>/translation`; `write` reads them back and writes the game's files into `<output-dir>/output`. `--output-dir` (`-o`) defaults to the input directory, so translation and output both live alongside the game unless you say otherwise.

### Translation file format

Each `.txt` file has one entry per line: source text, a `<#>` separator, then the translation. Line breaks in the source are normalized to `\#` so they don't get confused with real newlines in the file - translations should use `\#` the same way.

```txt
<!>ID<#>2
<!>NAME<#>City
<!>ORDER<#>157
<!>IN-GAME DISPLAYED NAME: City<#>Translated City
This is sample text<#>This is translated sample text
This is sample\#multiline text<#>This is translated sample\#multiline text
```

`<#>`, `\#` and `<!>` (the comment prefix) can all be changed per-project with `--line-separator`, `--line-break` and `--comment-prefix` respectively - see [Global options](#global-options). The full format, including comment lines and duplicate handling, is documented in the [library's README](https://github.com/RPG-Maker-Translation-Tools/rvpacker-txt-rs-lib#translation-file-format).

### `.rvpacker-metadata` and `.rvpacker-ignore`

Every `read` writes `.rvpacker-metadata` into the `translation` directory, recording the duplicate mode, format settings (separator/break/prefix) and content hashes used for that run. Later `append`/`write`/`purge` runs load it back automatically.

`.rvpacker-ignore` lets you exclude specific lines from being extracted at all - handy for unused or duplicate content the game never actually shows. Pass `--ignore` on `read` to apply one, or `--create-ignore` on `purge` to generate one from whatever gets purged. See the [library's README](https://github.com/RPG-Maker-Translation-Tools/rvpacker-txt-rs-lib#rvpacker-ignore) for the file's syntax, and [`examples/.rvpacker-ignore`](https://github.com/RPG-Maker-Translation-Tools/rvpacker-txt-rs-lib/blob/main/examples/.rvpacker-ignore) for a working example.

## Usage

Run `rvpacker-txt-rs -h` for the general help, or `rvpacker-txt-rs <command> -h` for a command's own options.

### `read`

Extracts text from the game's files into `translation/*.txt`.

```bash
rvpacker-txt-rs read -i "C:/Game"
```

### `write`

Writes translated `.txt` files back into the game's original format, under `<output-dir>/output`.

```bash
rvpacker-txt-rs write -i "C:/Game"
```

### `purge`

Drops translation entries that were never filled in.

```bash
rvpacker-txt-rs purge -i "C:/Game"
```

### `json`

Converts XP/VX/VX Ace's binary data files to and from JSON, independent of the translation workflow above.

```bash
rvpacker-txt-rs json generate -i "C:/Game"   # writes C:/Game/json/*.json (and Scripts.rb)
rvpacker-txt-rs json write -i "C:/Game"      # reads C:/Game/json back into C:/Game/json-output
```

### Global options

These apply to every command:

- `-i, --input-dir <PATH>` - defaults to `./`.
- `-o, --output-dir <PATH>` - defaults to the input directory.
- `--line-separator <SEPARATOR>`, `--line-break <BREAK>`, `--comment-prefix <PREFIX>` - override the library's translation-file format defaults (`<#>`, `\#`, `<!>`). See [`.rvpacker-metadata` and `.rvpacker-ignore`](#rvpacker-metadata-and-rvpacker-ignore) for how these interact with later runs.
- `-v`/`-q` - increase/decrease log verbosity.

## Support

[Me](https://github.com/savannstm), the maintainer of this project, is a poor college student from Eastern Europe.

If you could, please consider supporting us through:

- [Ko-fi](https://ko-fi.com/savannstm)
- [Patreon](https://www.patreon.com/cw/savannstm)
- [Boosty](https://boosty.to/mcdeimos)

Even if you don't, it's fine. We'll continue to do as we right now.

## License

Project is licensed under [WTFPL](https://www.wtfpl.net/).
