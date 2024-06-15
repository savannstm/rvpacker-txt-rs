export function getValueBySymbolDesc(collection: object, description: string): any {
    const symbols = Object.getOwnPropertySymbols(collection);

    const symbol = symbols.find((symbol) => symbol.description === description);
    return collection[symbol!];
}

export function setValueBySymbolDesc(collection: object, description: string, newValue: any): void {
    const symbols = Object.getOwnPropertySymbols(collection);

    const symbol = symbols.find((symbol) => symbol.description === description);
    collection[symbol!] = newValue;
}
