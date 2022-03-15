const transactionQueue = require(__dirname + "/transactionQueue.js");
const bcrypto = require(__dirname + "/bcrypto.js");
const networking = require(__dirname + "/networking.js");
const fs = require("fs");

let config = JSON.parse(fs.readFileSync("config.json", "utf-8"));
var BCrypto = new bcrypto();
const TransactionQueue = new transactionQueue(BCrypto);
let netInstance = new networking(config.host, config.port, BCrypto, config.stableNode);

TransactionQueue.worker(netInstance);
netInstance.connectionHandler();