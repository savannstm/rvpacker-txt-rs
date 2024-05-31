String.prototype.replaceAllMultiple = function (replacementObj: { [key: string]: string }): string {
    return this.replaceAll(Object.keys(replacementObj).join("|"), (match: string): string => replacementObj[match]);
};

String.prototype.count = function (char: string): number {
    let occurrences: number = 0;

    for (let i = 0; i < this.length; i++) {
        if (char === this[i]) {
            occurrences++;
        }
    }

    return occurrences;
};
