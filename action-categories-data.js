// data
// for the actions...

// one comprehensive list of all possible action keys
// and the 'group' for what category that activity is
// format: [action, category]
//
// category possibilities:
// discard: discard this transaction
// other:   a transaction that is a tranaction that affects the account balance, but isnt an option transaction
// option:  an option transaction

// note
// keys are all lowercase.
// need to convert value from file in order to check

const actionCategoryMap = new Map([

	["expired", "discard"],
	["journaled shares", "discard"],

    ["assigned", "other"],
    ["bank interest", "other"],
    ["bond interest", "other"],
    ["buy", "other"],
    ["cd deposit adj", "other"],
    ["cd deposit funds", "other"],
    ["cd interest", "other"],
    ["cancel buy", "other"],
    ["cash dividend", "other"],
    ["cash in lieu", "other"],
    ["cash liquidation", "other"],
    ["credit interest", "other"],
    ["cxl redemption adj", "other"],
    ["div adjustment", "other"],
    ["final cash liquid", "other"],
    ["final cash liquid adj", "other"],
    ["full redemption", "other"],
    ["full redemption adj", "other"],
    ["funds received", "other"],
    ["interest adj", "other"],
    ["internal transfer", "other"],

    ["journal", "other"],
    ["long term cap gain", "other"],
    ["long term cap gain reinvest", "other"],
    ["margin interest", "other"],
    ["misc cash entry", "other"],
    ["moneylink transfer", "other"],
    ["non-qualified div", "other"],
    ["other", "other"],
    ["payments", "other"],
    ["pr yr cash div", "other"],
    ["pr yr div reinvest", "other"],
    ["pr yr non qual div", "other"],
    ["pr yr non-qual div", "other"],
    ["qual div reinvest", "other"],
    ["qualified dividend", "other"],
    ["reinvest dividend", "other"],
    ["reinvest shares", "other"],
    ["reinvestment adj", "other"],
    ["reverse split", "other"],
    ["security transfer", "other"],
    ["sell", "other"],
    ["service fee", "other"],
    ["short term cap gain", "other"],
    ["short term cap gain reinvest", "other"],
    ["stock split", "other"],
    ["tax withholding", "other"],
    ["wire sent", "other"],

	["buy to close", "option"],
	["buy to open", "option"],
	["sell to close", "option"],
	["sell to open", "option"],
    ["cancel buy to close", "option"],

    ["unknown", "unknown"],  // fallback
]);

export default actionCategoryMap;
