use rand::{rngs::ThreadRng, seq::SliceRandom, thread_rng};
use regex::{Captures, Match, Regex};

pub fn shuffle_words(string: &str) -> String {
    let re: Regex = Regex::new(r"\S+").unwrap();
    let mut words: Vec<&str> = re
        .find_iter(string)
        .map(|mat: Match| mat.as_str())
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
