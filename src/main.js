const blockchain = require(__dirname + "/blockchain.js");
const transactionQueue = require(__dirname + "/transactionQueue.js");
const bcrypto = require(__dirname + "/bcrypto.js");
const networking = require(__dirname + "/networking");
const fs = require("fs");
const execSync = require('child_process').execSync;

const orig_consoleLog = console.log;
console.log = (...args) => {
    let e = new Error();
    let frame = e.stack.split("\n")[2];
    let functionName = frame.split(" ")[5];

    orig_consoleLog(`[${Date.now()}]`, `[${functionName}]`, ...args)
}

try { 
    const output = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' });

    if(output != "master") {
        if(fs.existsSync("cache.json"))
            fs.rmSync("cache.json")
        if(fs.existsSync("network_cache.json"))
            fs.rmSync("network_cache.json")
        if(fs.existsSync("message_store")) 
            fs.rmdirSync("message_store")

        /*if(fs.existsSync("docker/blockchain.json")) 
            fs.copyFileSync("docker/blockchain.json", "blockchain.json")*/
    }
} catch(error) {
    console.log("Could not determine git branch, presuming \"master\"...")
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