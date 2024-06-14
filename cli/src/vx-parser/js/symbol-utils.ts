export function getValueBySymbolDesc(collection: any, description: string): any {
    const symbols: symbol[] = Object.getOwnPropertySymbols(collection);

    const symbol = symbols.find((symbol: symbol) => symbol.description === description);
    return collection[symbol!];
}

export function setValueBySymbolDesc(collection: any, description: string, newValue: any): void {
    const symbols: symbol[] = Object.getOwnPropertySymbols(collection);

    const symbol = symbols.find((symbol: symbol) => symbol.description === description);
    collection[symbol!] = newValue;
}
