const blockchain = require(__dirname + "/blockchain.js");
const transactionQueue = require(__dirname + "/transactionQueue.js");
const bcrypto = require(__dirname + "/bcrypto.js");
const networking = require(__dirname + "/networking.js");
const fs = require("fs");
const execSync = require('child_process').execSync;

const output = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' });

if(output != "master") {
    if(fs.existsSync("cache.json"))
        fs.rmSync("cache.json")
    if(fs.existsSync("network_cache.json"))
        fs.rmSync("network_cache.json")

    if(fs.existsSync("docker/blockchain.json")) 
        fs.copyFileSync("docker/blockchain.json", "blockchain.json")
}
let config = JSON.parse(fs.readFileSync("config.json", "utf-8"));
var BCrypto = new bcrypto();
var blockchainInstance = new blockchain(BCrypto);
const TransactionQueue = new transactionQueue(BCrypto,blockchainInstance);
let netInstance = new networking(config.host, config.port, BCrypto, TransactionQueue, config.stableNode, config.stableNodePort, blockchainInstance, config.stableNodePubKey);
netInstance.connectionHandler();

netInstance.registerToNetwork().then(() => {
    TransactionQueue.worker(netInstance);
})