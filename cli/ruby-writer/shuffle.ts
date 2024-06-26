interface Array<T> {
    shuffle(): T[];
}

Array.prototype.shuffle = function () {
    const shuffled = this;

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
};

function shuffleWords(string: string): string | void {
    const words = string.match(/\S+/g);

    if (words) {
        const shuffled = words.shuffle();

        let wordIndex = 0;
        return string.replace(/\S+/g, () => shuffled[wordIndex++]);
    }
}
