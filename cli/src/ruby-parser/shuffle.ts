interface Array<T> {
    shuffle(): T[];
}

Array.prototype.shuffle = function (): any[] {
    const self = this;

    for (let i = self.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [self[i], self[j]] = [self[j], self[i]];
    }

    return self;
};

function shuffleWords(string: string): string | void {
    const words = string.match(/\S+/g);

    if (words) {
        const shuffled = words.shuffle();

        let wordIndex = 0;
        return string.replace(/\S+/g, () => shuffled[wordIndex++]);
    }
}
