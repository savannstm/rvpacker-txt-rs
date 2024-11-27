use once_cell::sync::Lazy;
use regex::Regex;

pub static STRING_IS_ONLY_SYMBOLS_RE: Lazy<Regex> = Lazy::new(|| unsafe {
    Regex::new(r#"^[.()+\-:;\[\]^~%&!№$@`*\/→×？?ｘ％▼|♥♪！：〜『』「」〽。…‥＝゠、，【】［］｛｝（）〔〕｟｠〘〙〈〉《》・\\#<>=_ー※▶ⅠⅰⅡⅱⅢⅲⅣⅳⅤⅴⅥⅵⅦⅶⅧⅷⅨⅸⅩⅹⅪⅺⅫⅻⅬⅼⅭⅽⅮⅾⅯⅿ\s0-9]+$"#).unwrap_unchecked()
});
pub static ENDS_WITH_IF_RE: Lazy<Regex> = Lazy::new(|| unsafe { Regex::new(r" if\(.*\)$").unwrap_unchecked() });
pub static LISA_PREFIX_RE: Lazy<Regex> =
    Lazy::new(|| unsafe { Regex::new(r"^(\\et\[[0-9]+\]|\\nbt)").unwrap_unchecked() });
pub static INVALID_MULTILINE_VARIABLE_RE: Lazy<Regex> =
    Lazy::new(|| unsafe { Regex::new(r"^#? ?<.*>.?$|^[a-z][0-9]$").unwrap_unchecked() });
pub static INVALID_VARIABLE_RE: Lazy<Regex> =
    Lazy::new(|| unsafe { Regex::new(r"^[+-]?[0-9]+$|^///|---|restrict eval").unwrap_unchecked() });
pub static _SELECT_WORDS_RE: Lazy<Regex> = Lazy::new(|| unsafe { Regex::new(r"\S+").unwrap_unchecked() });

pub static NEW_LINE: &str = r"\#";
pub static LINES_SEPARATOR: &str = "<#>";
pub static mut EXTENSION: &str = "";
