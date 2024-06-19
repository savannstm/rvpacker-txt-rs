use fancy_regex::{Captures, Match, Regex};
use rand::{rngs::ThreadRng, seq::SliceRandom, thread_rng};

pub fn shuffle_words(string: &str) -> String {
    let re: Regex = Regex::new(r"\S+").unwrap();
    let mut words: Vec<&str> = re
        .find_iter(string)
        .map(|m: Result<Match, fancy_regex::Error>| m.unwrap().as_str())
        .collect();

    let mut rng: ThreadRng = thread_rng();
    words.shuffle(&mut rng);

    let mut word_index: i32 = 0;
    let result = re.replace_all(string, |_: &Captures| {
        let replacement: &str = words[word_index as usize];
        word_index += 1;
        replacement
    });

    result.to_string()
}
