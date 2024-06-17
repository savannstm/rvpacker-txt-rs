export function getValueBySymbolDesc(collection: { [key: symbol]: any }, description: string): any {
    const symbols = Object.getOwnPropertySymbols(collection);

    const symbol = symbols.find((symbol) => symbol.description === description);
    return collection[symbol!];
}

export function setValueBySymbolDesc(collection: { [key: symbol]: any }, description: string, newValue: any): void {
    const symbols = Object.getOwnPropertySymbols(collection);

    const symbol = symbols.find((symbol) => symbol.description === description);
    collection[symbol!] = newValue;
}
