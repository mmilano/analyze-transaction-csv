// data
// collection of which symbols
// are INDEX OPTION SYMBOLS
// and
// a lookup map for possible symbol variants

// SPX: S&P 500 Index
// NDX: Nasdaq 100 Index
// DJX: Dow Jones Industrial Average (1/100th value)
// RUT: Russell 2000 Index
// VIX: cboe Volatility Index

const indexSymbols = new Set([
    "DJXW",
    "DJX",
    "NDXP",
    "NDX",
    "RUTW",
    "RUT",
    "SPXW",
    "SPX",
    "VIXW",
    "VIX",
]);

const indexSymbolsBaseSet = new Set([
    "DJX",
    "NDX",
    "RUT",
    "SPX",
    "VIX",
]);

const indexSymbolsBase = new Map([
    ["DJXW", "DJX"],
    ["DJX", "DJX"],

    ["NDXP", "NDX"],
    ["NDX", "NDX"],

    ["RUTW", "RUT"],
    ["RUT", "RUT"],

    ["SPXW", "SPX"],
    ["SPX", "SPX"],

    ["VIXW", "VIX"],
    ["VIX", "VIX"],
]);

export { indexSymbols, indexSymbolsBaseSet, indexSymbolsBase };
