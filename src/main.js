// CONFIG //
var port = 0; 
var host = ''; 
const fs = require("fs");

const transactionQueue = require(__dirname + "/transactionQueue.js");
const bcrypto = require(__dirname + "/bcrypto.js");
const networking = require(__dirname + "/networking.js");

var configFile = fs.readFileSync("config.json", "utf-8");
host = JSON.parse(configFile).host;
port = JSON.parse(configFile).port;
stableNode = JSON.parse(configFile).stableNode;

var BCrypto = new bcrypto();
const TransactionQueue = new transactionQueue(1235, BCrypto);

let netInstance = new networking(host, port, BCrypto,stableNode);
TransactionQueue.worker(netInstance);
netInstance.connectionHandler();