const fs = require('fs');
var crypto = require('crypto');

let startTimestamp = Date.now();
var blockchainToWriteToFile = {blockchain:[]};
var previousBlock = "";

for(var i = 0; i < 512; i++) {
    var newBlock = {id:i, timestamp: startTimestamp + i * 60000, previousBlockHash: crypto.createHash('sha256').update(previousBlock).digest('hex'), rewardAddress: "01b364f173998197db2d4924d00ea41c38c0693245826502c78b5493e2e46936", rewardAmount: 25000000, payload:[], networkDiff: {registered:[], left:[]}}
    previousBlock = JSON.stringify(newBlock);

    blockchainToWriteToFile.blockchain.push(newBlock);
}

fs.writeFileSync("blockchain.json", JSON.stringify(blockchainToWriteToFile));