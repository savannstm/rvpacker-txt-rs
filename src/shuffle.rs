use fancy_regex::{Captures, Error, Match, Regex};
use rand::{rngs::ThreadRng, seq::SliceRandom, thread_rng};

pub fn shuffle_words(string: &str) -> String {
    let re: Regex = Regex::new(r"\S+").unwrap();
    let mut words: Vec<_> = re
        .find_iter(string)
        .filter_map(|m: Result<Match, Error>| m.ok().map(|m: Match| m.as_str()))
        .collect();

    let mut rng: ThreadRng = thread_rng();
    words.shuffle(&mut rng);

    re.replace_all(string, |_: &Captures| words.pop().unwrap_or(""))
        .into_owned()
}
