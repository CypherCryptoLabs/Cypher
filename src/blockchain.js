const fs = require("fs");
const crypto = require('crypto');

class blockchain {

   constructor(bcrypto) {
      this.bcrypto = bcrypto;
   }

   generateBlock(sortedQueue, validators) {
      if(sortedQueue.length) {
         sortedQueue.forEach(object => {
            delete object["queryID"];
         });
      }

      var previousBlock = this.getNewestBlock();

      var block = {
         id: JSON.parse(previousBlock).id + 1,
         timestamp: Date.now(),
         previousBlockHash: this.bcrypto.hash(previousBlock),
         rewardAddress: this.bcrypto.hash(this.bcrypto.getPubKey(true)),
         rewardAmount: 10,
         payloadHash: this.bcrypto.hash(JSON.stringify(sortedQueue)),
         payload: sortedQueue,
         validators: [],
         forgerSignature: ""
      }
      if(validators) {
         for(var i = 0; i < validators.validators.length; i++) {
            block.validators[validators.validators[i].blockchainAddress] = "";
            console.log(i);
         }
      }

      console.log(block)

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

      fs.truncate(blockchainFilePath, blockchainFileSize - 2, function () { })
      fs.promises.truncate(blockchainFilePath, blockchainFileSize - 2, function () { }).then(() => {
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
      while (stringNotFound) {
         buffer1.copy(buffer2);
         fs.readSync(blockchainFd, buffer1, 0, buffer1.length, (blockchainFileSize - (buffer1.length * i) < 0) ? 0 : blockchainFileSize - (buffer1.length * i));

         var bufferConCatString = Buffer.concat([buffer1, buffer2]);
         index = bufferConCatString.toString("utf-8").lastIndexOf("{\"id\":");

         if (index != -1) {
            stringNotFound = false;
            //console.log(index);
         }

      }

      var lastBlockBuffer = Buffer.alloc(i * 10000 - index - 2 - ((blockchainFileSize < 10000 ? 10000 - blockchainFileSize : 0)));
      fs.readSync(blockchainFd, lastBlockBuffer, 0, lastBlockBuffer.length, blockchainFileSize - lastBlockBuffer.length - 2);
      lastBlockBuffer = lastBlockBuffer.toString("utf-8");

      return lastBlockBuffer;

   }

   getBalanceForAddress(blockchainAddress) {
      var balance = 0;
      var blockchain = JSON.parse(fs.readFileSync('blockchain.json', 'utf8'));

      for (var i = 0; i < blockchain.blockchain.length; i++) {

         if (blockchain.blockchain[i].rewardAddress == blockchainAddress) {
            balance += blockchain.blockchain[i].rewardAmount;
         }

         for (var j = 0; j < blockchain.blockchain[i].payload.length; j++) {
            if (blockchain.blockchain[i].payload[j].blockchainSenderAddress == blockchainAddress) {
               balance -= blockchain.blockchain[i].payload[j].payload.unitsToTransfer + blockchain.blockchain[i].payload[j].payload.networkFee;
            }

            if (blockchain.blockchain[i].payload[j].payload.blockchainReceiverAddress == blockchainAddress) {
               balance += blockchain.blockchain[i].payload[j].payload.unitsToTransfer;
            }
         }

      }
      return balance;
   }

   validateBlock(block, currentVotingSlot, validators, forger, transactionQueue) {
      block = JSON.parse(block);
      var blockIsValid = true;
      
      if(JSON.stringify(Object.getOwnPropertyNames(block)) != JSON.stringify(['id', 'timestamp', 'previousBlockHash', 'rewardAddress', 'rewardAmount', "payloadHash", "payload", "validators", "forgerSignature"]))
         blockIsValid = false;

      if(block.timestamp < currentVotingSlot || block.timestamp > Date.now())
         blockIsValid =false;

      let previousBlock = this.getNewestBlock();
      let previousBlockHash = this.bcrypto.hash(previousBlock);

      if(block.previousBlockHash != previousBlockHash)
         blockIsValid = flase;
      
      if(block.id != JSON.parse(previousBlock).id + 1)
         blockIsValid = false;
      
      if(block.rewardAddress != forger.blockchainAddress) 
         blockIsValid = false;
      
      if(block.rewardAmount != 10)
         blockIsValid = false;

      if(block.payloadHash != this.bcrypto.hash(JSON.stringify(block.payload)))
         blockIsValid = false;

      for(var i = 0; i < block.payload.length && blockIsValid; i++) {
         var transactionFound = false;
         for(var j = 0; j < transactionQueue.length && !transactionFound; j++) {
            let transactionQueueEntryString = JSON.stringify(transactionQueue[j]);
            let blockPayloadEntryString = JSON.stringify(block.payload[j]);

            if(blockPayloadEntryString == transactionQueueEntryString) {
               transactionFound = true;
            }

            console.log("TEST")
         }
         if(!transactionFound)
            blockIsValid = false;
      }

      console.log(blockIsValid);

   }

}

module.exports = blockchain;