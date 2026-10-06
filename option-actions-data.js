/**
 * data
 * mapping of possible action types in OPTION transactions
 * to a base action,
 * either BUY or SELL
 */
const optionActionMap = new Map([
	["buy to close", "buy"],
	["buy to open", "buy"],
	["sell to close", "sell"],
	["sell to open", "sell"],
]);

export default optionActionMap;
