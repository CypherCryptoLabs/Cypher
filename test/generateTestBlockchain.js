const fs = require('fs');
var crypto = require('crypto');

let startTimestamp = Date.now();
var blockchainToWriteToFile = {blockchain:[]};
var previousBlock = "";

for(var i = 0; i < 512; i++) {
    var newBlock = {id:i, timestamp: startTimestamp + i * 60000, previousBlockHash: crypto.createHash('sha256').update(previousBlock).digest('hex'), rewardAddress: "2d11fabcf54c12b4c86e9bb73c03c323b508fbb35b54a97cffb318a80c77e4b9", rewardAmount: 25000000, payload:[]}
    previousBlock = JSON.stringify(newBlock);

    blockchainToWriteToFile.blockchain.push(newBlock);
}

fs.writeFileSync("blockchain.json", JSON.stringify(blockchainToWriteToFile));