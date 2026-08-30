# rvpacker-txt-rs

[README на русском](./README-ru.md)

A command-line tool that extracts the translatable text from RPG Maker 2000/2003/XP/VX/VX Ace/MV/MZ game files into plain `.txt` files, and writes translated `.txt` files back into the game's original format. It also decrypts `.rgss` archives on the fly when it finds one.

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

RPG Maker 2000/2003 projects don't have a `data`/`Data` directory at all - `RPG_RT.ldb`, `RPG_RT.lmt` and every `MapNNNN.lmu` sit directly in the input directory, and that's what's checked for first. There's no `Scripts`/plugin equivalent for it, and no `.rgss` archive to decrypt.

`read` writes `.txt` files into `<output-dir>/translation`; `write` reads them back and writes the game's files into `<output-dir>/output`. `--output-dir` (`-o`) defaults to the input directory, so translation and output both live alongside the game unless you say otherwise.

### Text encoding

Reading the game's own text and writing a translation back are two independent decisions, controlled by two separate flags - `--read-encoding` and `--write-encoding`. Reusing one codepage for both (or assuming UTF-8 always works) risks silently corrupting a translation - see below.

**`--read-encoding`.** RPG Maker 2000/2003 files, and XP/VX's `Scripts.*`, carry no encoding of their own at all - left unset, the tool guesses from a fixed list of common codepages (UTF-8, Shift-JIS, GB18030, Windows-1252, Windows-1251), keeping the first one that decodes cleanly. Pass `--read-encoding` if you already know the game's codepage, rather than trusting the guess. VX Ace is different: its data format tags most strings with their real encoding already, so `--read-encoding` there only matters for the rare string that declares one this tool doesn't recognize.

`--use-game-ini`/`--parse-game-ini` can help find that codepage in the first place: `Game.ini`'s (or, if absent, `RPG_RT.ini`'s) title is the one field in that file that can carry non-ASCII bytes, and when it does, RPG Maker's editor wrote them in whatever codepage the original developer's machine used - the same codepage the rest of the game's text is in. Use `--parse-game-ini <ENCODING>` on its own first to try candidates and see which one decodes into sensible text, before committing to it with `--read-encoding` and passing `--use-game-ini` (which decodes the title with `--read-encoding` and writes it into the system file's title field).

**`--write-encoding` defaults to unset, which always writes UTF-8 - leave it that way unless you know you need otherwise.** A translation is not generally representable in the source game's own codepage (Japanese `Shift-JIS` has no Cyrillic to translate a Russian translation into, for instance), and forcing the wrong one doesn't fail loudly - an unmappable character gets silently replaced with a literal `&#1055;`-style numeric reference spliced into the output. Only set `--write-encoding` when the target engine build has no Unicode-aware text renderer to fall back on - true of RPG Maker 2000/2003, XP and VX, which render through the OS's legacy ANSI codepage rather than decoding UTF-8 - _and_ the translation's own script fits inside the codepage you choose. Whoever runs the translated game then also needs their system (or a locale-emulation tool) set to that same codepage; on Windows 10 1903+, checking "Beta: Use Unicode UTF-8 for worldwide language support" under Region settings makes the default UTF-8 output work for these engines too, without any of this. VX Ace is Unicode-native, so its UTF-8 default just works regardless.

Both flags accept the common Windows codepages: `utf-8`, `shift-jis`, `gb18030`, `euc-kr` (UHC/CP949), `big5`, and `windows-1250` through `windows-1258`. Whichever value is used on `read` is recorded in `.rvpacker-metadata`, so later `append`/`write`/`purge` runs pick both back up automatically without repeating the flags.

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

Converts XP/VX/VX Ace's binary data files to and from JSON, independent of the translation workflow above. Not available for RPG Maker 2000/2003 or MV/MZ.

```bash
rvpacker-txt-rs json generate -i "C:/Game"   # writes C:/Game/json/*.json (and Scripts.rb)
rvpacker-txt-rs json write -i "C:/Game"      # reads C:/Game/json back into C:/Game/json-output
```

### Global options

These apply to every command:

- `-i, --input-dir <PATH>` - defaults to `./`.
- `-o, --output-dir <PATH>` - defaults to the input directory.
- `--line-separator <SEPARATOR>`, `--line-break <BREAK>`, `--comment-prefix <PREFIX>` - override the library's translation-file format defaults (`<#>`, `\#`, `<!>`). See [`.rvpacker-metadata` and `.rvpacker-ignore`](#rvpacker-metadata-and-rvpacker-ignore) for how these interact with later runs.
- `--read-encoding <ENCODING>` - forces decoding of the game's own text to a specific codepage instead of guessing it. See [Text encoding](#text-encoding).
- `--write-encoding <ENCODING>` - forces encoding of translated text to a specific codepage instead of always writing UTF-8. Independent of `--read-encoding` - see [Text encoding](#text-encoding).
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
