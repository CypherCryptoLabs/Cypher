const fs = require("fs");

class blockchain {
    generateBlock(sortedQueue) {
       sortedQueue.forEach(object => {
          delete object["queryID"];
       })
 
       var previousBlock = this.getNewestBlock();
 
       var block = {
          id : JSON.parse(previousBlock).id + 1,
          timestamp : Date.now(),
          previousBlockHash : crypto.createHash('sha256').update(previousBlock).digest('hex'),
          rewardAddress : "a564f649810816d55065b3680f37c149e9d892358a7b0ec88253df2154d60be5",
          rewardAmount : 10,
          payloadHash : crypto.createHash('sha256').update(JSON.stringify(sortedQueue)).digest('hex'),
          payload : sortedQueue,
       }
 
       /*var block = {
          id : 0,
          timestamp : Date.now(),
          previousBlockHash : "0000000000000000000000000000000000000000000000000000000000000000",
          payloadHash : crypto.createHash('sha256').update(JSON.stringify(sortedQueue)).digest('hex'),
          payload : sortedQueue,
       }*/
 
       return block;
    }
 
    appendBlockToBlockchain(block) {
       var blockchainFilePath = "blockchain.json";
       var blockchainFileSize = fs.statSync(blockchainFilePath).size;
 
       fs.truncate(blockchainFilePath, blockchainFileSize - 2, function(){})
       fs.promises.truncate(blockchainFilePath, blockchainFileSize - 2, function(){}).then(() => {
          fs.appendFileSync(blockchainFilePath, "," + JSON.stringify(block) + "]}");
       })
    }
 
    getNewestBlock() {
       var blockchainFd = fs.openSync("blockchain.json", "r");
       var blockchainFileSize = fs.statSync("blockchain.json").size;
       var stringNotFound = true;
       var buffer1 = Buffer.alloc(10000);
       var buffer2 = Buffer.alloc(10000);
       
       var i = 1;
       var index = 0;
       while(stringNotFound) {
          buffer1.copy(buffer2);
          fs.readSync(blockchainFd, buffer1, 0, buffer1.length, (blockchainFileSize - (buffer1.length * i) < 0) ? 0 : blockchainFileSize - (buffer1.length * i));
 
          var bufferConCatString = Buffer.concat([buffer1, buffer2]);
          index = bufferConCatString.toString("utf-8").lastIndexOf("{\"id\":");
 
          if(index != -1) {
             stringNotFound = false;
             //console.log(index);
          }
 
       }
 
       var lastBlockBuffer = Buffer.alloc(i * 10000 - index - 2 -((blockchainFileSize < 10000 ? 10000 - blockchainFileSize : 0)));
       fs.readSync(blockchainFd, lastBlockBuffer, 0, lastBlockBuffer.length, blockchainFileSize - lastBlockBuffer.length - 2);
       lastBlockBuffer = lastBlockBuffer.toString("utf-8");
       
       return lastBlockBuffer;
 
    }
 
    getBalanceForAddress(blockchainAddress) {
       var balance = 0;
       var blockchain = JSON.parse(fs.readFileSync('blockchain.json', 'utf8'));
 
       for(var i = 0; i < blockchain.blockchain.length; i++) {
 
          if(blockchain.blockchain[i].rewardAddress == blockchainAddress) {
             balance += blockchain.blockchain[i].rewardAmount;
          }
 
          for(var j = 0; j < blockchain.blockchain[i].payload.length; j++) {
             if(blockchain.blockchain[i].payload[j].blockchainSenderAddress == blockchainAddress) {
                balance -= blockchain.blockchain[i].payload[j].payload.unitsToTransfer + blockchain.blockchain[i].payload[j].payload.networkFee;
             }
 
             if(blockchain.blockchain[i].payload[j].payload.blockchainReceiverAddress == blockchainAddress) {
                balance += blockchain.blockchain[i].payload[j].payload.unitsToTransfer;
             }
          }
 
       }
       return balance;
    }
 
}

module.exports = blockchain;