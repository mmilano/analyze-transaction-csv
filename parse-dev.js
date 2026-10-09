/// need functions for
// reading in fileContent// processing file data
// writing out file

import readline from "node:readline/promises";
import process from "node:process";
import path from "node:path";
import { parseArgs } from "node:util";

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";

import PapaParse from "papaparse";
import papaParseConfig from "./papaParseConfig.js";

import actionCategoryMap from "./action-categories-data.js";
import { indexSymbols, indexSymbolsBase, indexSymbolsBaseSet } from "./index-symbols-data.js";

const keyToCategorization = "Action"; // the column header label to use for categorization
const emptyColumnCell = ","; // Define an empty cell that will be used for making empty csv column cells (in array)

/**
 * simple lookup map for transaction type abbreviation
 */
const optionTypeMap = new Map([
    ["P", "PUT"],
    ["C", "CALL"],
]);

// define value used in the processing for when the "Action" is not known
const categoryFallback = "unknown";

/**
 * help menu text
 */
const helpMenu = `
Usage: node parse.js [options] [ filename.csv ]

Options:
  -h, --help       show this help message and exit
  -p, --preview    do not write out any files
  -d, --debug      include debug/verbose information

Examples:
  node script.js -d file-options.csv
`;

const config = {
    preview: false,
    debug: false,
};

/**
 * methods for coloring/formatting terminal/console output
 * usage:
 * console.log(colorize.green("Success"));
 *
 * @param {string} text - the text string to colorize
 * @return {string} text - the text wrapped in formatting codes
 */
const colorize = {
  // Reset
  reset: (text) => `\x1b[0m${text}\x1b[0m`,

  // Text Colors
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  magenta: (text) => `\x1b[35m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,

  // Formatting
  bold: (text) => `\x1b[1m${text}\x1b[0m`,
//   dim: (text) => `\x1b[2m${text}\x1b[0m`,
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
        preview: {
            type: "boolean",
            short: "p",
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
        console.log ("help.");
        process.exit(0);
    };

    // filename to work on
    const filename = positionals[0];

    // const modePreview = values.preview;
    if (values.preview) {
        console.info ("- preview mode");
        config.preview = true;
    }

    // const modeDebug = values.debug;
    if (values.debug) {
        console.info ("- debug mode");
        config.debug = true;
    }

    return {
        filename: filename,
    }

}

/**
 * if no filename is passed as argument,
 * prompt for entry
 *
 * @param {string} filename
 * @returns {string} filename
 */
async function getName(filename) {

    if (!filename) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        console.info("No filename provided as argument.");
        const inputName = await rl.question ("Please enter a filename: ");

        if (!inputName) {
            console.error("Error: No CSV filename provided.");
            process.exit(1);
        }
        filename = inputName.trim();
        rl.close();

        rl.question("Please enter the input filename:", (answer) => {
            filename = answer.trim();
            rl.close();

            if (!filename) {
                console.error("Error: No filename provided.");
                process.exit(1);
            }
        });
    }
    return filename;
}

/**
 * read in a csv file
 *
 * @param {string} filename - the full path of the file to read in
 * @returns {string} fileContent
 */
async function getFileContent(filename) {

    if (!filename) {
        console.error("Error: Please provide a CSV filename as an argument.");
        console.error("Usage: node parse.js <filename.csv>");
        process.exit(1);
    }

    const inputPath = path.resolve(filename);

    // read the CSV file
    if (!existsSync(inputPath)) {
        console.error(`Error: File not found at ${inputPath}`);
        process.exit(1);
    }

    let fileContent;

    try {
        fileContent = readFileSync(inputPath, "utf8");
    } catch (err) {
        console.error("Error: Problem reading file:", err);
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
    if (config.preview) {
        return;
    }

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
    if (config.preview) {
        return;
    }

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
        console.error("Parsing warnings/errors detected:", parsedData.errors);
    }
    console.info(`Parsed: ${parsedData["data"].length} rows from the CSV file.`);
    return parsedData;
}

/**
 * "Unparse" the sorted JSON array back into CSV format
 *
 * @param {*} data
 * @returns
 */
function unparseCSVFile (data) {
    if (config.preview) {
        return [];
    }

    return PapaParse.unparse(data);
}

/**
 * define columns to include in csv data with debug mode
 */

const debugColumnPair = "pairID";
const debugColumnFractionalPriceFlag = "fract";
const debugColumnRollFlag = "roll";

const debugColumns = [
    debugColumnPair,
    debugColumnFractionalPriceFlag,
    debugColumnRollFlag,
];


/**
 *
 * @param {object} row - a parsed row from the csv file
 * @returns {object} obj - simplified object with just the column headers as keys
 */
const getColumnHeaders = (row) => {
    const obj = {};
    for (let column of Object.keys(row)) {
        obj[column] = "";
    }
    // if debug mode,
    // add debug columns
    if (config.debug) {
        debugColumns.forEach((column) => {
            obj[column] = "";
        });
    }

    return obj;
};


/**
 * use intl.numberformat to set display format of transaction amounts
 * so that they have 2 ecimal places, even when they are .00
 */
const amountFormat = new Intl.NumberFormat("en", {
    minimumFractionDigits: 2,
    trailingZeroDisplay: "auto",
});

/**
 * format numbers as amounts
 * @param {number} n
 * @returns {number}
 */
const transactionAmountFormat = (n) => amountFormat.format(n);

/**
 * format numbers as quantities
 * @param {number} n
 * @returns {number}
 */
const transactionQuantityFormat = (n) => {}


/**
 * does the number passed in have any decimals?
 * @param {number} num
 * @returns {boolean}
 */
const hasDecimal = (num) => !Number.isInteger(num);

/**
 * determine if the transaction has some value for "amount"
 * if transaction.amount is empty or "0", return false
 *
 * @param {object} transaction
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
const isOptionTransaction = (optionSymbol) => OptionTransactionSymbolRegex.test(optionSymbol);

/**
 * given a stock/equity symbol,
 * is it an index - as defined by the Set list of indexes?
 *
 * @param {string} stockSymbol
 * @returns {boolean}
 */
const isIndexTransaction = (stockSymbol) => indexSymbols.has(stockSymbol);

/**
 * given a type from an option symbol - P or C -
 * is it a PUT or a CALL?
 * @param {string} type
 * @returns {string}
 */
const getOptionType = (type) => optionTypeMap.get(type);

/**
 * given the symbol from the option,
 * lookup the base symbol for that index
 * ie. the 3-letter index
 * @param {string} symbol
 * @returns {string}
 */
const getIndexBaseSymbol = (symbol) => indexSymbolsBase.get(symbol);

/**
 * convert a date string into a Date object.
 * existing format of the dates in SCHWAB CSV are:
 * simple:     MM/DD/YYYY
 * not simple: "10/16/2025 as of 10/15/2025"
 * which date to use for the non-simple? first
 * @param {string} dateString
 * @returns {Date}
 */
const dateFromDateString = (dateString) => {
    if (dateString.includes(" ")) {
        // split by the spaces,
        // and take the first/more recent date
        // (avoiding any "as of mm/dd/yyyy" portion)
        dateString = dateString.split(" ")[0];
    }
    const [month, day, year] = dateString.split("/");
    return new Date(year, month - 1, day);
}

/**
 *
 * @param {object} row
 * @returns {date} date - the transaction date; when the transaction was made
 */
const getTransactionDate = (row) => {
    const theDate = row["Date"];
    return dateFromDateString(theDate);
}

/**
 *
 * @param {object} row
 * @returns {date} date - the option EXPIRATION date
 */
const getExpirationDate = (row) => {
    const theDate = row["expiration"];
    return dateFromDateString(theDate);
}

/**
 * regex pattern to detect any characters OTHER than digits and negative sign in a string
 * mostly about removing "$"
 * used when converting price string into number
 */
const regexPrice = /[^\d.-]/g;

/**
 * regex pattern to determine if string has decimal place 3 or more
 * used when converting price string into number
 */
const regexThreeDecimalPlaces = /\.\d{3,}/;

/**
 * given a numerical input (eg. a sum of currency values), return a fixed decimal
 * @param {number} n - a floating point number
 * @returns {number} fixed decimal
 */
const sumRounded = (n) => n.toFixed(2);

/**
 * check if the number string has more than 2 decimal places
 * note: cannot use float value because some values get very very small rounding errors
 * in the 10 or 15th decimal place when converting to float
 * e.g. 2.45 = 2.4500000000003
 * this is an internal javascript problem
 *
 * @param {string} numberString - a number as string
 * @returns {boolean}
 */
const hasMoreThanTwoDecimals = (numberString) => regexThreeDecimalPlaces.test(numberString);

/**
 * check if the transaction price has fractional cents,
 * i.e. more than 2 digits after the decimal
 * @param {object} row - a transaction row (direct from parsing, now as internal object)
 * @returns {boolean}
 */
const isTransactionPriceFractional = (row) => hasMoreThanTwoDecimals(row["Price"]);


function flattenObjToValues(obj) {
  let result = [];

  // Object.keys preserves the insertion order for string keys
  for (const key of Object.keys(obj)) {
    const value = obj[key];

    // Check if the value is a nested object (and not null or an array)
    // if (typeof value === "object" && value !== null && !Array.isArray(value)) {
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
const symbolDelimiter = " ";  // [space]

/**
 * with an option's "SYMBOL" string from the CSV, parse out the constituent elements
 *
 * @param {object} transaction
 * @returns {object} symbolElements - object with symbolPhraseKeys as keys
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
const makeBlankRows = (n=1) => Array(n).fill({row: blankRow});

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
 * calculate sum of "amount" column for array of transactions passed in
 *
 * @param {array} transactions
 * @returns {integer} sum - total sum of all the transactions passed in
 */
const calculateTransactionsSum = (transactions) => {
    let sum = 0;
    for (const transaction of transactions) {
        if (transaction.row["Amount"]) {
            sum = sum + Number(transaction.row["Amount"].replace(regexPrice, ""));
        }
    }
    return sum;
}

/**
 * replace/remove any nno-number characters in a number
 * @param {string} amount
 * @returns {number} the amount as a number
 */
const convertAmountStringToNumber = (amount) => {
    return Number(amount.replace(regexPrice, ""));
}

const getFormattedDate = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0'); // Months are 0-11
    const dd = String(d.getDate()).padStart(2, '0');
    const formattedDateString = `${mm}-${dd}-${yyyy}`;

    return formattedDateString;
};

/**
 * displaying a formatted label + number to console
 * with layout=
 * [LABEL]:  [NUMBER]
 * @param {string} date - formatted date
 * @param {number} sum - a sum value
 * @param {string} color - optional. one of the available text colors supported by colorize{}
 */
const displayFormattedSum = ({label, num, color="green"}) => {
    const displayNum = hasDecimal(num) ? (num > 0 ? " " : "") + sumRounded(num) : num;
    console.log (colorize[color](label + ": " + "\t" + displayNum));
}


/**
 * display a tabulated label and quantity
 * @param {string} label
 * @param {number} num
 * @param {string} color - optional. one of the available text colors supported by colorize{}
 */
const displayFormattedQuantity = ({label, num, color="green"}) => {
    const displayNum = hasDecimal(num) ? (num > 0 ? " " : "") + sumRounded(num) : num;
    const displayString = label + ": " + "\t" + displayNum;
    console.log (colorize[color](displayString));
}

/**
 * display a tabulated label and amount
 * @param {string} label
 * @param {number} num
 * @param {string} color - optional. one of the available text colors supported by colorize{}
 */
const displayLabeledAmount = ({label, num, color="green"}) => {
    const formattedNum = transactionAmountFormat(num);
    // const displayNum = hasDecimal(num) ? (num > 0 ? " " : "") + num : num;
    const displayNum = num > 0 ? " " + formattedNum : formattedNum;
    const displayString = label + ": " + "\t" + displayNum;
    console.log (colorize[color](displayString))
}

/**
 * go thru each transaction,
 * group by expiration date,
 * then calculate each expiration date's total
 *
 * @param {array of object} transactions
 */
function calculateDailySums (transactions) {

    // const expirationDateSums = {};
    const expirationDateSums = new Map();

    // organize by exp date
    for (const transaction of transactions) {
        const amount = transaction.row["Amount"];
        if (!amount) {
            continue;
        }
        const expDate = transaction.metadata["expirationDate"];
        // const yyyy = expDate.getFullYear();
        // const mm = String(expDate.getMonth() + 1).padStart(2, '0'); // Months are 0-11
        // const dd = String(expDate.getDate()).padStart(2, '0');
        // const formattedDate = `${mm}-${dd}-${yyyy}`;
        const formattedDate = getFormattedDate(expDate);

        // if (!expirationDateSums[formattedDate]) {
        //     expirationDateSums[formattedDate] = 0;
        // }
        if (!expirationDateSums.get(formattedDate)) {
            expirationDateSums.set(formattedDate, 0);
        }
        // expirationDateSums[formattedDate] += convertAmountStringToNumber(amount);
        expirationDateSums.set(formattedDate, expirationDateSums.get(formattedDate) + convertAmountStringToNumber(amount));
    }

    // round off the amounts
    // for (const [date, sum] of Object.entries(expirationDateSums)) {
    //     expirationDateSums[date] = Number(sumRounded(expirationDateSums[date]));
    // }
    for (const [date, value] of expirationDateSums) {
        const n = Number(sumRounded(value));
        expirationDateSums.set(date, n);
    }

    // sort the sums by date
    // const sortedExpirationDates = Object.fromEntries(
    //     Object.entries(expirationDateSums).sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    // );
    const sortedDateSums = new Map([...expirationDateSums].sort((a, b) => a[0].localeCompare(b[0])));

    // display results
    console.log ();
    console.log ("amounts:");
    console.log ("by EXPIRATION DATE of the option:");
    for (const [date, value] of sortedDateSums) {
        displayLabeledAmount({
            label: date,
            num: value
        });
    }
    console.log ();
}


/**
 * go through all the transactions
 * and group them by transaction date
 * @param {array} rows - all the transactions
 * @returns {Map} transactionDatesGroups - a map where keys= transaction dates, and values are [array] of transactions
 */
function organizeTransactionsbyDate (rows) {

    // const transactionDatesGroups = {};
    const transactionDatesGroups = new Map();

    rows.forEach((row) => {
        // determine transaction date as date object
        const transactionDate = getTransactionDate(row);

        // *****
        // case: multiple transaction dates in one file?
        // if that is the case,
        // then group transaction by transaction date for later processing
        // as if each date was its own file
        const formattedDate = getFormattedDate(transactionDate);

        // if (!transactionDatesGroups[formattedDate]) {
            // transactionDatesGroups[formattedDate] = [];
        // }
        // transactionDatesGroups[formattedDate].push(row);

        if (!transactionDatesGroups.has(formattedDate)) {
            transactionDatesGroups.set(formattedDate, []);
        }
        transactionDatesGroups.get(formattedDate).push(row);

    });

    // display results
    console.log ();
    console.log ("quantities:");
    console.log ("by TRANSACTION DATE:");
    for (const [date, rows] of transactionDatesGroups) {
        displayFormattedQuantity({
            label: date,
            num: rows.length,
            color: "cyan"
        });
    }
    console.log ();

    return transactionDatesGroups;
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
            const eDateTime = dateFromDateString(eDateString).getTime();

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



/**
 * categorizes, and groups a file of transactions (from the CSV)
 * by the "action" column
 *
 * @param {object} parsedData - all of the raw parsed data from the file
 * @returns {array} sortedRows - all the transactions of interest
 */
export function processTransactions(rows) {

    // holding object organized by categories
    // pre-defined structure - prevents errors if there are no rows for that category
    const groupedRows = {
        [categoryFallback]: [],
        other: [],
        option: [],
        discard: [],
    };

    // make a reference of actions for two rows that might be a pair
    const actionDefiningPair = ["buy", "sell"].sort().join(",");

    // process each row
    rows.forEach((row) => {

        // what category is the transaction?
        // fallback if the "Action" field is missing or empty
        const action = row[keyToCategorization] ? row[keyToCategorization].trim().toLowerCase() : categoryFallback;
        const actionCategory = actionCategoryMap.get(action) || categoryFallback;

        // if it is a discard category,
        // dont do anything and just move on
        // essentially tossing the row out
        if (actionCategory === "discard") {
            return;
        }

        const metadata = {};

        // determine transaction date as date object
        // const transactionDate = getTransactionDate(row);

        // METADATA
        // define some metadata about each row
        // only do this for the "option" transactions
        if (actionCategory === "option") {
            // add transaction date     as date object
            metadata["transactionDate"] = getTransactionDate(row);
            // metadata["transactionDate"] = transactionDate;

            // process transaction Symbol string into object
            metadata["transactionSymbol"] = parseTransactionSymbolPhrase(row);

            // add option expiration date (as date object)
            metadata["expirationDate"] = getExpirationDate(metadata["transactionSymbol"]);

            // determine transaction type: PUT or CALL
            metadata["optionType"] = getOptionType(metadata["transactionSymbol"]["type"]);

            // determine if transaction is on an INDEX: T or F
            const isIndex = isIndexTransaction(metadata["transactionSymbol"]["root"]);
            metadata["isIndex"] = isIndex;

            // if it is an index option,
            // then determine the BASE INDEX symbol
            if (isIndex) {
                metadata["baseSymbol"] = getIndexBaseSymbol(metadata["transactionSymbol"]["root"]);
            }

            // determine the BASE ACTION for transaction
            // BUY: buy to open, buy to close, ...
            // SELL: sell to open, sell to close, ...
            metadata["baseAction"] = isTransactionBuyOrSell(row);
            // metadata["buyToClose"] = isTransactionBuyToClose(row);
        }

        if (actionCategory === categoryFallback) {
            console.log ("-unknown");
            // stick a flag into the data so it is more obvious
            // use "Fees & Comm" because that is otherwise unneeded data
            row["Fees & Comm"] = categoryFallback;
        }

        // if DEBUG
        // flag if the price has fractional value
        if (config.debug) {
            if (row["Price"]) {
                // const fr = isTransactionPriceFractional(row);
                if (isTransactionPriceFractional(row)) {
                    row[debugColumnFractionalPriceFlag] = " FR ";
                }
            }
        }

        // return an object that keeps the metadata separate.
        // this makes it easier to un-parse the transaction later without the metadata
        groupedRows[actionCategory].push({
            row: row,
            metadata: metadata,
        });
    });

    console.info(`Grouped: ${Object.keys(groupedRows).length} action categories.`);

    // REORGANIZE

    // OTHERs
    // handle all the "other" ROWS
    // they should all be at the top of the reorganized CSV file
    // doing this BEFORE DISCARD because some JOURNAL rows can be discarded = those without an amount


    // handle the JOURNAL transactions:
    // when action is journal (of some form)
    // if amount is empty, then put into "discard"
    // if amount <> empty, it is in "other"

    console.info ("checking for 'other' transactions to move into 'discard' group...");

    // need to build a new array of the keepers as iterating
    const transactionsToKeep = [];
    let howMany = 0;
    groupedRows["other"].forEach((rowObject, index) => {
        // isolate the "row" content of the row object
        const row = rowObject.row;

        if (transactionHasAmount(row)) {
            transactionsToKeep.push(rowObject);
        } else {
            groupedRows["discard"].push(rowObject);
            howMany++;
        }
    });

    console.info ("moved:", howMany, "'other' transactions");

    // sort the "other" rows - alphabetically
    // first sort/group by Symbol,
    // if there is no symbol, then by the description field
    groupedRows["other"] = transactionsToKeep.sort((a, b) => {
        if (a.row.Symbol.localeCompare(b.row.Symbol) != 0) {
            return a.row.Symbol.localeCompare(b.row.Symbol);
        }
        return a.row.Description.localeCompare(b.row.Description);
    });

    // DISCARDs
    // discard rows that are discard category
    const dataKeyToDelete = "discard";
    console.log ("discard:", groupedRows[dataKeyToDelete].length, "transactions");
    delete groupedRows[dataKeyToDelete];


    // UNKNOWNS
    // message if there are any unknown/fallback rows
    if (groupedRows[categoryFallback].length) {
        console.log (categoryFallback, ":", groupedRows[categoryFallback].length, "transactions");
    }

    // OPTIONs
    // handle all the OPTIONS...

    // for all individual not-an-index stock-based options (eg. covered calls),
    // put those at the top of the list

    // next find
    // all pairs of stock-based options (eg. spread on a stock)

    // next work through all the index options

    const stockOptions = [];
    const indexOptions = [];

    // ID# used to identify pairs
    let pairID = 1;

    const optionRows = groupedRows["option"];


    // go thru all the rows and group pairs
    for (let i = 0; i < optionRows.length; i++) {

        // this row
        const transaction = optionRows[i];
        const rowSymbol = transaction.metadata.transactionSymbol.root;
        // and the next row
        const nextTransaction = optionRows[i+1];
        const nextRowSymbol = nextTransaction?.metadata.transactionSymbol.root;

        // CASE: end of list
        // if nextRow is undefined, then probably at end of list
        if (!nextTransaction) {
            // if thisRow is the last line, and it is hasnt been paired with the line before,
            // then it seems this must be a singleton.
            // so categorize it in either the stock group or the index group
            if (!transaction.metadata.isIndex) {
                stockOptions.push(transaction);
            } else {
                indexOptions.push(transaction);
            }

            continue;
        }

        // CASE: symbol NOT EQUAL next.symbol
        // if the root symbol of this row is != the root symbol of the next row,
        // then this row is probably a singleton.
        // so categorize it in either the stock group or the index group
        if (rowSymbol != nextRowSymbol) {

            // is it an index or a stock?
            if (!transaction.metadata.isIndex) {
                stockOptions.push(transaction);
                // add a blank row
                stockOptions.push(...makeBlankRows(1));
            } else {
                indexOptions.push(transaction);
            }

            // and move along to the next
            continue;
        }

        // if root symbol of this row === the root symbol of the next row,
        // then this could be a pair.
        if (rowSymbol === nextRowSymbol) {

            const baseActionCurrentRow = transaction.metadata.baseAction;
            const baseActionNextRow = nextTransaction.metadata.baseAction;

            // are both actions the same base action?
            if (baseActionCurrentRow === baseActionNextRow) {
                // not a pair because both base actions are the same
                // so...
                // put it in a group as a single transaction

                // is it an index or a stock?
                if (!transaction.metadata.isIndex) {
                    stockOptions.push(transaction);
                } else {
                    indexOptions.push(transaction);
                }

                // and move along to the next
                continue;
            };

            // since we checked if they are equal already,
            // then to get here they must not be equal

            // CHECK: if actions are BUY + SELL
            //
            // if actions are BUY and SELL, then we may have a pair...
            // if (baseActionRow != baseActionNextRow) {
                // a pair = one buy and one sell

                // if (config.debug) {
                //     console.dir(transaction);
                //     console.dir(nextTransaction);
                // }
                // check if actions match the actions-pair
                const currentPair = [baseActionCurrentRow, baseActionNextRow].sort().join(",");

                if (currentPair != actionDefiningPair) {
                    // console.log ("not sure what we have here...");
                    // debugger;

                    // store the transaction and move on
                    // is it an index or a stock?
                    if (!transaction.metadata.isIndex ) {
                        stockOptions.push(transaction);
                    } else {
                        indexOptions.push(transaction);
                    }

                    continue;
                }

                // if (currentPair === actionsForPair) {

                // CHECK: if both types are the same:
                // both should be P or C

                if (transaction.metadata.optionType != nextTransaction.metadata.optionType) {
                    // if (config.debug) {
                    //     console.info (" not a pair: TYPE does not match");
                    // }

                    // store the transaction and move on
                    if (!transaction.metadata.isIndex ) {
                        stockOptions.push(transaction);
                    } else {
                        indexOptions.push(transaction);
                    }
                    continue;
                }

                // CHECK: if both QUANTITY are the same
                // note: need to coerce the quantity to number, not string
                if (+transaction.row["Quantity"] != +nextTransaction.row["Quantity"]) {
                    // if (config.debug) {
                    //     console.info (" not a pair: QUANTITY does not match");
                    // }

                    // debugger;
                    // store the transaction and move on
                    if (!transaction.metadata.isIndex ) {
                        stockOptions.push(transaction);
                    } else {
                        indexOptions.push(transaction);
                    }
                    continue;
                }


                    // identify: a spread
                    // = a pair,
                    // - same symbol
                    // - same expiration date
                    // - different strike
                    // - one of each action: Buy + Sell

                    // WHOOO!
                    // console.log("PAIR found!");
                    // add pairID value
                    transaction.metadata["pairID"] = pairID;
                    nextTransaction.metadata["pairID"] = pairID;

                    // if DEBUG
                    // put the pair ID value into the csv data
                    if (config.debug) {
                        transaction.row["pairID"] = pairID;
                        nextTransaction.row["pairID"] = pairID;
                    }

                    // increment the pairID for next pair
                    pairID++;

                    // could it be a ROLL?
                    // identify: a roll
                    // - same symbol
                    // - different expiration
                    // - same quantity
                    // - one of each action: Buy to close + Sell (to open)

                    const action0 = transaction.row["Action"].toLowerCase();
                    const action1 = nextTransaction.row["Action"].toLowerCase();
                    if (action0 === "buy to close" || action1 === "buy to close") {
                        if (action0 === "sell to open" || action1 === "sell to open") {

                            transaction.metadata["roll"] = "roll?";
                            nextTransaction.metadata["roll"] = "roll?";

                            if (config.debug) {
                                transaction.row["roll"] = " R? ";
                                nextTransaction.row["roll"] = " R? ";
                            }
                        }
                    }


                    // are they in the right order: BUY-SELL?
                    // push into list in order:
                    // 1. buy
                    // 2. sell
                    const pair = [];
                    if (baseActionCurrentRow === "sell" && baseActionNextRow === "buy") {
                        pair[0] = nextTransaction;
                        pair[1] = transaction;
                    } else {
                        pair[0] = transaction;
                        pair[1] = nextTransaction;
                    }
                    // so hopefully the BUY is first now...


                    // is it an index or a stock?
                    // stick them both in the right group
                    if (!transaction.metadata.isIndex ) {
                        stockOptions.push(pair[0]);
                        stockOptions.push(pair[1]);
                        stockOptions.push(...makeBlankRows(1));
                    } else {
                        indexOptions.push(pair[0]);
                        indexOptions.push(pair[1]);
                    }

                    // because this is a pair,
                    // increment the index to skip what would be the next row
                    i++;
                    // and move along...
                    continue;
                // }
            // }
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
                const type = transaction.metadata.optionType;
                if (type === "PUT") {
                    puts.push(transaction);
                } else {
                    calls.push(transaction);
                }
            }

            groupedRows = puts;
            // add blank separation rows
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


    // put all the index options back together
    const sortedIndexOptions = [];
    Object.keys(indexGroups).forEach((indexSymbol) => {
        // const group = indexGroups[indexSymbol];
        sortedIndexOptions.push(...makeBlankRows(3));
        sortedIndexOptions.push(...indexGroups[indexSymbol]);
    });

    // reassemble
    // the new groupings should be
    // - stockOptions
    // - empty row(s)
    // - indexOptions
    stockOptions.push(...makeBlankRows(3));
    groupedRows["option"] = stockOptions.concat(sortedIndexOptions);


    // for dev testing
    // writeJSON("stocks", stockOptions);
    // writeJSON("indexes", indexOptions);


    // now all the "option" transactions are processed and grouped
    // calculate the sum of the amounts
    const sumByDay = calculateDailySums(groupedRows["option"]);

    const sum = calculateTransactionsSum(groupedRows["option"]);
    displayFormattedSum( {label: "SUM - OPTIONS", num: sum});

    const sortedRows = [];

    if (config.preview) {
        return sortedRows;
    }

    // ASSEMBLE FOR OUTPUT
    // 1. stock-based individual transaction group
    // 2. stock-based pair transaction group
    // 3. index-based transaction groupss

    // unpack all the arrays from the data objects
    // NOTE: extract ONLY the transaction rows, not the metadata
    //
    // first put the header as an explicit object
    sortedRows.push(dataColumnHeaders);
    // ...add some empty rows as white space...
    sortedRows.push(...makeEmptyRows(1));
    // ...list out the "unknown" rows...
    sortedRows.push(...groupedRows["unknown"].map(({row}) => row) );
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
const {filename} = parseArguments();

// get the file contents
const csvFileContents = await getFileContent(filename);
// parse the raw file data
const parsedCSV = parseCSVFile(csvFileContents);

// just the data please
const csvData = parsedCSV.data;

// the usual transaction file is in reverse chronological order -
// (top: newest, bottom: oldest)
// so reverse them all so they are in chronological order top to bottom
const csvDataChronological = csvData.toReversed();

// extract the headers for later use
const dataColumnHeaders = getColumnHeaders(csvData[0]);
const blankRow = constructBlankRow(dataColumnHeaders);

// organize/group transactions by transaction date
const transactionByDate = organizeTransactionsbyDate(csvDataChronological);

// process the transactions, add necessary metadata, and group them,
// polish them up.
// only pass the data portion
const reorganizedData = processTransactions(csvDataChronological);

// output
// un-parse the modified data back into a csv format
const outputCSV = unparseCSVFile(reorganizedData);

// Save the new output to a (new) file
writeFileContent(filename, outputCSV);

// console.log ("finished.");
