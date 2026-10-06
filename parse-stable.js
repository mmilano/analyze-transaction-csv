/// need functions for
// reading in fileContent// processing file data
// writing out file

import process from 'node:process';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';

import PapaParse from 'papaparse';
import papaParseConfig from './papaParseConfig.js';

import actionCategoryMap from "./action-categories-data.js";
import { indexSymbols, indexSymbolsBase, indexSymbolsBaseSet } from "./index-symbols-data.js";


const keyToCategorization = "Action"; // the column header to use for categorization
const emptyColumnCell = ","; // Define an empty cell that will be used for making empty csv column cells (in array)

/**
 * help menu text
 */
const helpMenu = `
Usage: node parse.js [options] [ filename.csv ]

Options:
  -h, --help     Show this help message and exit
  -d, --debug    show debug/verbose information

Examples:
  node script.js -d file-options.csv
`;


const config = {
    debug: false,
};


/**
 * config options for parseArguments
 */
const argumentOptions = {
    options: {
        // file: {
        //     type: "string",
        //     short: "f",
        // },
        help: {
            type: "boolean",
            short: "h",
            default: false,
        },
        debug: {
            type: "boolean",
            short: "d",
            default: false,
        },
    },
    allowPositionals: true,
};


/**
 * parse and act on any passed arguments for script
 */
function parseArguments() {
    const { values, positionals } = parseArgs(argumentOptions);

    if (values.help) {
        // show help text
        process.exit(0);
    };

    // filename to work on
    const filename = positionals[0];

    const modeDebug = values.debug;
    if (modeDebug) {
        console.info ("- debug mode");
        config.debug = true;
    }

    return {
        filename: filename,
    }

}


/**
 * read in a csv file
 *
 * @param {string} inputFilename - the full path of the file to read in
 * @returns {string} fileContent
 */
function getFileContent(inputFilename) {

    if (!inputFilename) {
        console.error('Error: Please provide a CSV filename as an argument.');
        console.error('Usage: node parse.js <filename.csv>');
        process.exit(1);
    }

    const inputPath = path.resolve(inputFilename);

    // read the CSV file
    if (!existsSync(inputPath)) {
        console.error(`Error: File not found at ${inputPath}`);
        process.exit(1);
    }

    let fileContent;

    try {
        fileContent = readFileSync(inputPath, 'utf8');
    } catch (err) {
        console.error('Error: Problem reading file:', err);
        process.exit(1);
    }

    return fileContent;
}
/**
 * write out csv file
 *
 * @param {string} inputFile
 * @param {*} data
 */
async function writeFileContent(inputFile, data) {

    const filePrefix = "parsed";
    const outputFilename = `${filePrefix}_${path.basename(inputFile)}`;
    const inputPath = path.resolve(inputFile);
    const outputPath = path.join(path.dirname(inputPath), outputFilename);

    try {
        await writeFile(outputPath, data, "utf8");
        console.log(`Reorganized file saved to: ${outputPath}`);
        console.log("Success! Reorganized CSV saved.");
    } catch (error) {
        console.error("Error writing file:", error);
    }
}

async function writeJSON(filename, data) {

    filename = filename + ".json";
    const fileData = JSON.stringify(data, null, 2);
    const filePath = path.join(__dirname, filename);

    try {
        await writeFile(filePath, fileData, "utf8");
    } catch (error) {
        console.error("Error writing file:", error);
    }
}

/**
 * parse the csv file content
 *
 * @param {string} filedata - the raw file content
 * @returns {object} parsedData - the parsed PapaParse object
 */
function parseCSVFile (filedata) {

    const parsedData = PapaParse.parse(filedata, papaParseConfig);
    if (parsedData.errors.length > 0) {
        console.warn('Parsing warnings/errors detected:', parsedData.errors);
    }
    console.log(`Parsed ${parsedData["data"].length} rows from the CSV file.`);
    return parsedData;
}

/**
 * "Unparse" the sorted JSON array back into CSV format
 *
 * @param {*} data
 * @returns
 */
function unparseCSVFile (data) {
    const outputCsv = PapaParse.unparse(data);
    return outputCsv;
}

/**
 *
 * @param {object} row - a parsed row from the csv file
 * @returns {object} obj - simplified object with just the column headers as keys
 */
const getDataHeaders = (row) => {

    const obj = {};
    for (let header of Object.keys(row)) {
        obj[header] = "";
    }
    return obj;
};


/**
 * determine if the transaction has some value for "amount"
 * if transaction.amount is empty or "0", then return false
 *
 * @param {*} transaction
 * @returns {boolean}
 */
const transactionHasAmount = (transaction) => {
    const amount = transaction["Amount"] ? transaction["Amount"].trim() : "";
    return !!amount;
}

/**
 *
 */
// original regex = /[A-Za-z]+\s\d\d\/\d\d\/\d\d\d\d\s[0-9]*\.[0-9]+\s[A-Z]/i;
const OptionTransactionSymbolRegex = /[A-Za-z]+\s\d\d\/\d\d\/\d\d\d\d\s[0-9]*\.[0-9]+\s[PC]/i;
// const OptionTransactionSymbolRegexShort = /[A-Za-z]+\s\d\d\/\d\d\/\d\d\d\d\s/i;

/**
 * given a transaction symbol string/phrase,
 * determine if it is an option transaction of the format:
 * [symbol] [space] [date] [space] [underlying price] [space] [type]
 * @param {*} optionSymbol
 * @returns
 */
const isOptionTransaction = (optionSymbol) => {
    return OptionTransactionSymbolRegex.test(optionSymbol);
}

/**
 * given a stock/equity symbol,
 * is it an index - as defined by the Set list of indexes?
 *
 * @param {string} stockSymbol
 * @returns {boolean}
 */
const isIndexTransaction = (stockSymbol) => {
    return indexSymbols.has(stockSymbol);
}




const transactionTypeMap = new Map([
    ["P", "PUT"],
    ["C", "CALL"],
]);


// given a type from an option symbol - P or C -
// is it a PUT or a CALL?
const getTransactionType = (type) => transactionTypeMap.get(type);


// given the index symbol from the option,
// lookup the base symbol for that index
// ie. the 3-letter index
const getIndexBaseSymbol = (symbol) => indexSymbolsBase.get(symbol);


// convert a date string into a Date object
// existing format of the dates in SCHWAB CSV are:
// simple: MM/DD/YYYY
// not simple: "10/16/2025 as of 10/15/2025"?
// which date to use for the non-simple? first...

const newDateFromDateString = (dateString) => {
    const [month, day, year] = dateString.split('/');
    return new Date(year, month - 1, day);
}

// given a transaction object,
// get the date object for the transaction date,
// and add it into the object
const determineTransactionDate = (transaction) => {
    let theDateString = transaction["Date"];

    if (theDateString.includes(" ")) {
        // split by the spaces,
        // and take the first/more recent date
        // (avoiding the 'as of mm/dd/yyyy' portion)
        theDateString = theDateString.split(" ")[0];
    }
    return newDateFromDateString(theDateString);
}



function flattenObjToValues(obj) {
  let result = [];

  // Object.keys preserves the insertion order for string keys
  for (const key of Object.keys(obj)) {
    const value = obj[key];

    // Check if the value is a nested object (and not null or an array)
    // if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    //   result.push(...flattenObjToValues(value)); // Recursively flatten and spread
    // } else {
    //   result.push(value); // Push the primitive value
    // }

    result.push(value); // Push the primitive value
  }

  return result;
}


// If row is an option, then symbol structure will be:
// [root-symbol] [space] [expiration-date] [space] [strike-price] [space] [type]
const symbolKeys = ["root", "expiration", "strikePrice", "type"];
const symbolDelimiter = " ";

/**
 * with an option's "SYMBOL" string from the CSV, parse out the constituent elements
 *
 * @param {object} transaction
 * @returns {object} symbolObject - object with symbolPhraseKeys as keys
 */
function parseTransactionSymbolPhrase(transaction) {

    const transactionSymbol = transaction["Symbol"];
    // Split the input string into individual strings
    const symbolStrings = transactionSymbol.split(symbolDelimiter);

    // If row is not an option, then symbol cell could be just a symbol, or other things
    // besides the option symbol value
    // if so, return the simple element
    // const isOption = isOptionTransaction(transactionSymbol);
    if (!isOptionTransaction(transactionSymbol)) return transactionSymbol;

    // if it is an option transaction,
    // Loop through subtring array and associate the value to the key
    // assumes fixed sequence of the keys & substrings
    const symbolElements = Object.fromEntries(
        symbolKeys.map((key, index) => [key, symbolStrings[index]])
    );

    return symbolElements;
}

/**
 * make an array with of N number of empty cells
 * that will translate into N empty rows
 *
 * @param {integer} n - number of rows wanted
 * @returns {array} array with N number of blank rows
 */
const makeEmptyRows = (n=1) => {
    return Array(n).fill(emptyColumnCell);
}

// make a special empty row where the last element is filled with spaces
// this is to make the "amount" row wider on import,
// which makes it easier to read
// const makeEmptyWideRow = (number=1) => {
//     const widerRow = makeEmptyRows(number);
//     widerRow[widerRow.length - 1] = wideRowCSV;
//     return widerRow;
// }


/**
 * make an object that has blank space for each column
 * using the extracted headers list.
 * this is a little different from the emptyColumnCell.
 * used when reaasembling the transactions to insert a row between other rows
 * @param {object} headers
 * @returns
 */
const constructBlankRow = (headers) => {
    const blankRow = {};
    for (const key of Object.keys(headers)) {
        blankRow[key] = "";
    }
    return blankRow;
}

/**
 * make an array with of N number of empty transaction objects
 * that will translate into N empty rows
 *
 * @param {integer} n - number of rows wanted
 * @returns {array} array with N number of blank rows
 */
const makeBlankRows = (n=1) => {
    return Array(n).fill({row: blankRow});
}


/**
 * determine if the transaction in given row is a BUY or a SELL
 *
 * @param {object} row
 * @returns {string}
 */
const isTransactionBuyOrSell = (row) => {
    const action = row["Action"].toLowerCase();

    const isBuy = action.includes("buy");
    const isSell = action.includes("sell");
    if (isBuy) {
        return "buy";
    } else if (isSell) {
        return "sell";
    } else {
        return "unknown";
    }
}

/**
 * determine if the transaction is a BUY TO CLOSE
 *
 * @param {object} row - the row value for a transaction
 * @returns {boolean}
 */
const isTransactionBuyToClose = (row) => {
    const action = row["Action"].toLowerCase();
    return (action === "buy to close");
}

/**
 * evaluate if the transaction is part of a pair: ie. has pairID
 *
 * @param {object} transaction - the entire transaction object, row & metadata
 * @returns boolean;
 */
const isTransactionAPair = (transaction) => {
    return !!transaction.metadata.pairID;
}



/**
 * categorizes, and groups a CSV file by the 'action' column.
 *
 * @param {object} parsedData - all of the parsed data from the input file
 */
export function processCSV(rows) {

    // const rows = data;

    // define some values used in the processing
    const categoryFallback = "unknown";

    // holding object organized by categories
    // pre-defined structure - prevents errors if there are no rows for that category
    const groupedRows = {
        discard: [],
        other: [],
        option: []
    };


    // process each row
    rows.forEach((row) => {

        // what category is the transaction?
        // Fallback to 'Uncategorized' if the "Action" field is missing or empty
        const action = row[keyToCategorization] ? row[keyToCategorization].trim().toLowerCase() : categoryFallback;
        const actionCategory = actionCategoryMap.get(action) || categoryFallback;

        const metadata = {};

        // define some metadata about each row before grouping
        // only need to do this for the 'option' transactions
        if (actionCategory === "option") {
            // process transaction date into date object
            // row["transactionDate"] = determineTransactionDate(row);
            metadata["transactionDate"] = determineTransactionDate(row);

            // process transaction Symbol string into object
            // row["transactionSymbol"] = parseTransactionSymbolPhrase(row);
            metadata["transactionSymbol"] = parseTransactionSymbolPhrase(row);

            // determine transaction type: PUT or CALL
            // row["transactionType"] = getTransactionType(row["transactionSymbol"]["type"]);
            // const rowTransactionType = getTransactionType(row["transactionSymbol"]["type"]);
            metadata["transactionType"] = getTransactionType(metadata["transactionSymbol"]["type"]);

            // determine if transaction is with an INDEX: T or F
            // const rowtransactionIsIndex = getTransactionType(row["transactionSymbol"]["type"]);
            metadata["transactionIsIndex"] = isIndexTransaction(metadata["transactionSymbol"]["root"]);

            // if it is an index option,
            // then determine the BASE INDEX symbol
            if (metadata["transactionIsIndex"]) {
                metadata["baseSymbol"] = getIndexBaseSymbol(metadata["transactionSymbol"]["root"]);
            }

            // determine the BASE ACTION for transaction
            // BUY: buy to open, buy to close, ...
            // SELL: sell to open, sell to close, ...
            metadata["baseAction"] = isTransactionBuyOrSell(row);
            metadata["buyToClose"] = isTransactionBuyToClose(row);
        }

        // assemble a meta-object that keeps the metadata separate.
        // this makes it easier to un-parse the transaction later without the metadata
        const aggregateRow = {
            row: row,
            metadata: metadata,
        };

        // if groupedRows structure is pre-defined, then this check is not necessary
        // if (!groupedRows[actionCategory]) {
            // groupedRows[actionCategory] = [];
        // }
        groupedRows[actionCategory].push(aggregateRow);
    });

    console.info(`Grouped into: ${Object.keys(groupedRows).length} action categories.`);


    // REORGANIZE

    // OTHERs
    // handle all the 'other' ROWS
    // they should all be at the top of the reorganized CSV file
    // doing this BEFORE DISCARD because some JOURNAL rows can be discarded = those without an amount


    // handle the JOURNAL transactions:
    // when action is journal (of some form)
    // if amount is empty, then put into "discard"
    // if amount <> empty, it is in "other"

    console.info ("checking for 'other' transactions to move into 'discard' group...");
    let i = 0;

    // need to build a new array of the keepers as iterating
    const transactionsToKeep = [];

    groupedRows["other"].forEach((rowObject, index) => {
        // isolate the "row" content of the row object
        const row = rowObject.row;

        if (transactionHasAmount(row)) {
            transactionsToKeep.push(rowObject);
        } else {
            groupedRows["discard"].push(rowObject);
            i++;
        }
    });

    console.info ("moved:", i, "transactions");

    // sort the "other" rows
    // first sort (and thereby group) by Symbol,
    // if there is no symbol, then by the description field
    groupedRows["other"] = transactionsToKeep.sort((a, b) => {
        if (a.row.Symbol.localeCompare(b.row.Symbol) != 0) {
            return a.row.Symbol.localeCompare(b.row.Symbol);
        }
        return a.row.Description.localeCompare(b.row.Description);
    });

    // DISCARDs
    // discard all the rows that are discard categories
    const dataKeyToDelete = "discard";
    console.log ("discarding:", groupedRows[dataKeyToDelete].length, "transactions");
    delete groupedRows[dataKeyToDelete];


// identify: a spread
// = a pair,
// - same symbol
// - same expiration date
// - different strike
// - one of each action: Buy + Sell

// identify: a roll
// - same symbol
// - different expiration
// - one of each action: Buy + Sell


    // OPTIONs
    // handle all the OPTIONS...

    // for all individual not-an-index stock-based options (eg. covered calls),
    // put those at the top of the list

    // next find
    // all pairs of stock-based options (eg. spread on a stock)

    // next work through all the index options

    // need to build a new array of the keepers as iterating
    // const options = {
    //     StockSingle: [],
    //     StockPairs: [],
    //     indexPairs: [],
    // }

    const stockOptions = [];
    const indexOptions = [];

    // used to identify pairs
    let pairID = 1;

    // get a transaction row
    // get the metadata.symbol for the transaction
    // compare to the next row
    // if symbol is different?
        // then push that row onto the stock-based group
    // if symbol is the same
        // check if the action is different
        // if action is different
            // then that is probably a transaction pair
                // organize them:
                    // buy
                    // sell
                // is it a pair of stock-based or index-based?
                    // if stock-based, push onthe stock-based pair group


    // make a reference of actions for two rows that might be a pair
    const actionsForPair = ["buy", "sell"].sort().join(',');

    const optionRows = groupedRows["option"];

    for (let i = 0; i < optionRows.length; i++) {

        // get a row
        const row = optionRows[i];
        const rowSymbol = row.metadata.transactionSymbol.root;
        // then get the next row
        const nextRow = optionRows[i+1];
        const nextRowSymbol = nextRow?.metadata.transactionSymbol.root;

        // if nextRow is undefined, then probbaly at end of list
        if (!nextRow) {
            // if thisRow is the last line, and it is hasnt been paired with the line before,
            // then it seems this must be a singleton.
            // so categorize it in either the stock group or the index group
            if (!row.metadata.transactionIsIndex ) {
                stockOptions.push(row);
            } else {
                indexOptions.push(row);
            }
            continue;
        }

        // CASE: symbol !+ next symbol
        // if the root symbol of this row is != the root symbol of the next row,
        // then this row is probably on its own.
        // so categorize it in either the stock group or the index group
        if (rowSymbol != nextRowSymbol) {

            // is it an index or a stock?
            if (!row.metadata.transactionIsIndex ) {
                stockOptions.push(row);
                // add a blank row
                stockOptions.push(...makeBlankRows(1));
            } else {
                indexOptions.push(row);
            }

            // and move along to the next
            continue;
        }

        // if root symbol of this row === the root symbol of the next row,
        // then this could be a pair.
        if (rowSymbol === nextRowSymbol) {

            const baseActionRow = row.metadata.baseAction;
            const baseActionNextRow = nextRow.metadata.baseAction;

            // are both actions the same base action?
            if (baseActionRow === baseActionNextRow) {
                // not a pair because both base actions are the same
                // so...
                // put it in a group as a single transaction

                // is it an index or a stock?
                if (!row.metadata.transactionIsIndex ) {
                    stockOptions.push(row);
                } else {
                    indexOptions.push(row);
                }

                // and move along to the next
                continue;
            };

            // if actions are BUY and SELL, then we may have a pair...
            if (baseActionRow != baseActionNextRow) {
                // a pair = one buy and one sell

                const currentPair = [baseActionRow, baseActionNextRow].sort().join(",");
                if (currentPair === actionsForPair) {

                    // WHOOO!
                    // console.log("PAIR found!");
                    // add pairID values to metadata
                    row.metadata["pairID"] = pairID;
                    nextRow.metadata["pairID"] = pairID;
                    // increment the pairID for next pair
                    pairID++;


                    // what kind of pair might it be?
                    // could it be a spread?
                    // could it be a roll?


                    // are they in the right order: BUY-SELL?
                    const pair = [];
                    if (baseActionRow === "sell" && baseActionNextRow === "buy") {
                        pair[0] = nextRow;
                        pair[1] = row;
                    } else {
                        pair[0] = row;
                        pair[1] = nextRow;
                    }

                    // is it an index or a stock?
                    // stick them both in the right group
                    if (!row.metadata.transactionIsIndex ) {
                        stockOptions.push(pair[0]);
                        stockOptions.push(pair[1]);
                        stockOptions.push(...makeBlankRows(1));
                    } else {
                        indexOptions.push(pair[0]);
                        indexOptions.push(pair[1]);
                    }

                    // because this is a pair, increment the index to skip what would be the next row
                    i++;
                    // and move along to the next
                    continue;
                }
            }
        }
    }

    // done sorting/grouping the transactions out


    // group the index options BY SYMBOL
    // use the index symbols set ordering for group sequence

    // iterate through the entire list of index options
    // and group them out

    const indexGroups = {};

    // iterate through indexSymbolsBaseSet
    // in order to arrange the transactions according to the order in the indexSymbolsBaseSet
    for (const indexSymbol of indexSymbolsBaseSet) {

        // filter out the transactions that match the indexSymbol
        let groupedRows = indexOptions.filter(row => row.metadata.baseSymbol === indexSymbol);

        // now also organize BY TYPE: P or C
        if (groupedRows.length) {

            const puts = [];
            const calls = [];

            for (const transaction of groupedRows) {
                const type = transaction.metadata.transactionType;
                if (type === "PUT") {
                    puts.push(transaction);
                } else {
                    calls.push(transaction);
                }
            }

            groupedRows = puts;
            if (calls.length) {
                groupedRows.push(...makeBlankRows(2));
            }
            groupedRows.push(...calls);
        }

        if (!indexGroups[indexSymbol]) {
            indexGroups[indexSymbol] = [];
        }
        indexGroups[indexSymbol].push(...groupedRows);
    }

    // within a group of options,
    // sequence them by expiration date

    function sequenceTransactionsByExpiration () {
        for (const index of Object.keys(indexGroups)) {

            console.log(index,"...");
            // console.log(indexGroups[index]);
            const groupDateCollection = {};

            const expirationDates = new Set();

            const group = indexGroups[index];
            if (group.length === 0) {
                continue;
            }

            for (const transaction of group) {
                const eDateString = transaction.metadata?.transactionSymbol.expirationDate;
                const eDateTime = newDateFromDateString(eDateString).getTime();

                // groupDateCollection will be an object breaking down group
                // by keys that
                // are the expirationDates of the transactions in group
                if (eDateTime) {
                    if (!groupDateCollection[eDateTime]) {
                        groupDateCollection[eDateTime] = [];
                    }
                    groupDateCollection[eDateTime].push(transaction);
                    // add to Set; Sets automatically ignore duplicates
                    expirationDates.add(eDateTime);
                }
            }

            // sort the expirationDate keys, oldest to largest
            const sortedDateTimes = new Set([...expirationDates].sort((a, b) => a - b));

            // const reGroup = flattenObjToValues(groupDateCollection);
            const sortedTransactions = [];
            for (const dateTime of sortedDateTimes) {
                sortedTransactions.push(...groupDateCollection[dateTime]);
            }

            // for (const key of Object.keys(groupDateCollection)) {
            //     const value = groupDateCollection[key];

            //     // Check if the value is a nested object (and not null or an array)
            //     // if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            //     //   result.push(...flattenObjToValues(value)); // Recursively flatten and spread
            //     // } else {
            //     //   result.push(value); // Push the primitive value
            //     // }

            //     result.push(...value);
            // }
            // console.log (result);
            // console.log (sortedTransactions);

        }
    }


// how to reorganize the 'stock' (non index) transactions
// go through the rows
//

// get a row
// is it a pair - does it have a pairID?
// no: make a note

// what is the next row?
// empty?
// then this row is the last of the particular synbol,
// so just put it in the stack.




    // put all the index options back together
    const sortedIndexOptions = [];
    Object.keys(indexGroups).forEach((indexSymbol) => {
        // const group = indexGroups[indexSymbol];
        sortedIndexOptions.push(...makeBlankRows(5));
        sortedIndexOptions.push(...indexGroups[indexSymbol]);
    });

    // reassemble
    // the new groupings should be
    // - stockOptions
    // - empty row(s)
    // - indexOptions
    stockOptions.push(...makeBlankRows(5));
    groupedRows["option"] = stockOptions.concat(sortedIndexOptions);


// for dev testing
// writeJSON("stocks", stockOptions);
// writeJSON("indexes", indexOptions);

    // for each group
    // go through and sort by the expiration date

    // assemble:
        // 1. stock-based individual transaction group
        // 2. stock-based pair transaction group
        // 3. index-based transaction groups



    // END REORGANIZATION

    // Flatten the grouped transactions so rows with the same actions are grouped together
    const sortedRows = [];


    // ASSEMBLE FOR OUTPUT

    // unpack all the arrays from the data objects
    // NOTE: extract ONLY the transaction rows, not the metadata
    //
    // first put the header as an explicit object
    sortedRows.push(dataColumnHeaders);
    // ...add some empty rows as white space...
    sortedRows.push(...makeEmptyRows(1));
    // ...list out the "other" rows...
    sortedRows.push(...groupedRows["other"].map(({row}) => row) );
    // ...add some empty rows as white space...
    sortedRows.push(...makeEmptyRows(7));
    // list out the "options" rows...
    sortedRows.push(...groupedRows["option"].map(({row}) => row) );
    // ...add some empty rows as white space at end.
    sortedRows.push(...makeEmptyRows(7));

    return sortedRows;
}


// define some file system values of current script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// get the input filename from command line arguments
// const filename = process.argv[2];
const {filename} = parseArguments();
// get the file contents
const csvFileContents = getFileContent(filename);

// parse the raw file data
const parsedCSV = parseCSVFile(csvFileContents);

// just the data please
const csvData = parsedCSV.data;

// the usual transaction file is in reverse chronological order -
// so reverse them all so they are in chronological order
const csvDataChronological = csvData.toReversed();

// extract the headers for later use
const dataColumnHeaders = getDataHeaders(csvData[0]);
const blankRow = constructBlankRow(dataColumnHeaders);

// process the transactions, add necessary metadata, and group them,
// polish them up.
// only pass the data portion
const reorganizedData = processCSV(csvDataChronological);

// output
// un-parse the modified data back into a csv format
const outputCSV = unparseCSVFile(reorganizedData);

// Save the new output to a (new) file
writeFileContent(filename, outputCSV);

// console.log ("finished.");
