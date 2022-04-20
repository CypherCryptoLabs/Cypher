const fs = require("fs");
const crypto = require('crypto');
const { formatWithOptions } = require("util");
const { exit } = require("process");

class blockchain {

   constructor(bcrypto) {
      this.bcrypto = bcrypto;
      this.blockQueue = {id:-1};
      this.addressCache = {};
      this.loadAddressCache();
   }

   loadAddressCache() {
      try {
         if (!fs.existsSync("cache.json")) {
            console.log("generating Cache file...");
            var blockchainCopy = JSON.parse(fs.readFileSync("blockchain.json").toString()).blockchain;
            var cacheObj = {};

            for(var i = 0; i < blockchainCopy.length; i++) {
               if(cacheObj.hasOwnProperty(blockchainCopy[i].rewardAddress)) {
                  cacheObj[blockchainCopy[i].rewardAddress].balance += blockchainCopy[i].rewardAmount;
                  cacheObj[blockchainCopy[i].rewardAddress].balanceChanges.push(i);
               } else {
                  cacheObj[blockchainCopy[i].rewardAddress] = {balance: blockchainCopy[i].rewardAmount, balanceChanges: [i]};
               }

               let payload = blockchainCopy[i].payload;
               for(var j = 0; j < payload.length; j++) {
                  cacheObj[payload[j].blockchainSenderAddress].balance -= (payload[j].payload.unitsToTransfer + payload[j].payload.networkFee);

                  if(cacheObj.hasOwnProperty(payload[j].payload.blockchainReceiverAddress)) {
                     cacheObj[payload[j].payload.blockchainReceiverAddress].balance += payload[j].payload.unitsToTransfer;
                     if(cacheObj[payload[j].payload.blockchainReceiverAddress].balanceChanges.lastIndexOf(i) == -1) {
                        cacheObj[payload[j].payload.blockchainReceiverAddress].balanceChanges.push(i);
                     }
                  } else {
                     cacheObj[payload[j].payload.blockchainReceiverAddress] = {balance: payload[j].payload.unitsToTransfer, balanceChanges: [i]};
                  }
               }
            }

            fs.writeFileSync("cache.json", JSON.stringify(cacheObj));
         }

         this.addressCache = JSON.parse(fs.readFileSync("cache.json").toString());
         console.log(this.addressCache);
      } catch (err) {
         console.log(err);
         process.exit();
      }
   }

   updateAddressCache(block) {
      if(this.addressCache.hasOwnProperty(block.rewardAddress)) {
         this.addressCache[block.rewardAddress].balance += block.rewardAmount;
         this.addressCache[block.rewardAddress].balanceChanges.push[block.id];
      } else {
         this.addressCache[block.rewardAddress] = {balance: block.rewardAmount, balanceChanges: [block.id]};
      }

      let payload = block.payload;
      for(var j = 0; j < payload.length; j++) {
         this.addressCache[payload[j].blockchainSenderAddress].balance -= (payload[j].payload.unitsToTransfer + payload[j].payload.networkFee);

         if(this.addressCache.hasOwnProperty(payload[j].payload.blockchainReceiverAddress)) {
            this.addressCache[payload[j].payload.blockchainReceiverAddress].balance += payload[j].payload.unitsToTransfer;
            if(this.addressCache[payload[j].payload.blockchainReceiverAddress].balanceChanges.lastIndexOf[block.id] == -1) {
               this.addressCache[payload[j].payload.blockchainReceiverAddress].balanceChanges.push[block.id];
            }
         } else {
            this.addressCache[payload[j].payload.blockchainReceiverAddress] = {balance: payload[j].payload.unitsToTransfer, balanceChanges: [block.id]};
         }
      }

      fs.writeFileSync("cache.json", JSON.stringify(this.addressCache));
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
         validators: {},
         forgerSignature: ""
      }
      if(validators) {
         for(var i = 0; i < validators.validators.length; i++) {
            block.validators[validators.validators[i].blockchainAddress] = "";
         }
      }

      var blockCopy = JSON.parse(JSON.stringify(block));
      delete blockCopy["forgerSignature"];

      block.forgerSignature = this.bcrypto.sign(JSON.stringify(blockCopy));

      /*var block = {
         id : 0,
         timestamp : Date.now(),
         previousBlockHash : "0000000000000000000000000000000000000000000000000000000000000000",
         payloadHash : crypto.createHash('sha256').update(JSON.stringify(sortedQueue)).digest('hex'),
         payload : sortedQueue,
      }*/

      return block;
   }

   appendBlockToBlockchain(block = undefined) {
      var blockchainFilePath = "blockchain.json";
      var blockchainFileSize = fs.statSync(blockchainFilePath).size;

      if(block == undefined){
         this.updateAddressCache(this.blockQueue);
      } else {
         this.loadAddressCache();
         this.updateAddressCache(block);
      }

      fs.truncateSync(blockchainFilePath, blockchainFileSize - 2);

      if(block == undefined)
         fs.appendFileSync(blockchainFilePath, "," + JSON.stringify(this.blockQueue) + "]}");

      if(block != undefined)
         fs.appendFileSync(blockchainFilePath, "," + JSON.stringify(block) + "]}");
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
         fs.readSync(blockchainFd, buffer1, 0, buffer1.length, (blockchainFileSize - (buffer1.length) < 0) ? 0 : blockchainFileSize - (buffer1.length));

         var bufferConCatString = Buffer.concat([buffer1, buffer2]);
         index = bufferConCatString.toString("utf-8").lastIndexOf("{\"id\":");

         if (index != -1) {
            stringNotFound = false;
            //console.log(index);
         
         }

      }

      var lastBlockBuffer = Buffer.alloc(10000 - index - 2 - ((blockchainFileSize < 10000 ? 10000 - blockchainFileSize : 0)));
      fs.readSync(blockchainFd, lastBlockBuffer, 0, lastBlockBuffer.length, blockchainFileSize - lastBlockBuffer.length - 2);
      lastBlockBuffer = lastBlockBuffer.toString("utf-8");

      return lastBlockBuffer;

   }

   getNewestNBlocks(n) {
      var nBlocks = "";

      var blockchainFd = fs.openSync("blockchain.json", "r");
      var blockchainFileSize = fs.statSync("blockchain.json").size;
      var totalBuffer = Buffer.alloc(0);

      var index = -1;
      var i = 0;
      var dataReadForIteration = 0;

      while(index == -1) {
         var buffer = Buffer.alloc(10000);
         dataReadForIteration = fs.readSync(blockchainFd, buffer, 0, buffer.length, blockchainFileSize - (buffer.length * i));
         i++;

         index = buffer.toString().lastIndexOf('{"id":' + n + ',');
         totalBuffer = Buffer.concat([buffer, totalBuffer]);
      }

      totalBuffer = totalBuffer.subarray(index, dataReadForIteration + ((i - 2) * 10000)).toString("utf-8");
      return "{\"blocks\":[" + totalBuffer;
   }

   getBalanceForAddress(blockchainAddress) {
      if(!this.addressCache.hasOwnProperty(blockchainAddress)) {
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
      } else {
         return this.addressCache[blockchainAddress].balance;
      }
   }

   validateBlock(block, currentVotingSlot, validators, forger, transactionQueue) {
      var blockCopy = JSON.parse(block);
      delete blockCopy.forgerSignature;
      blockCopy = JSON.stringify(blockCopy);

      block = JSON.parse(block);
      var blockIsValid = true;
      
      if(JSON.stringify(Object.getOwnPropertyNames(block)) != JSON.stringify(['id', 'timestamp', 'previousBlockHash', 'rewardAddress', 'rewardAmount', "payloadHash", "payload", "validators", "forgerSignature"]))
         blockIsValid = false;

      if(block.timestamp < currentVotingSlot || block.timestamp > Date.now())
         blockIsValid =false;
      
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
         }
         if(!transactionFound)
            blockIsValid = false;
      }
      
      if(Object.keys(block.validators).length != validators.length)
         blockIsValid = false;
      
      for(var i = 0; i < block.validators.length && blockIsValid; i++) {
         if(block.validators[validators[i]] == undefined) {
            blockIsValid = false;
         }
      }

      if(!this.bcrypto.verrifySignature(block.forgerSignature, forger.publicKey, blockCopy))
         blockIsValid = true;

      let previousBlock = this.getNewestBlock();
      let previousBlockHash = this.bcrypto.hash(previousBlock);

      if(block.previousBlockHash != previousBlockHash)
            blockIsValid = false;

      if(block.id != JSON.parse(previousBlock).id + 1)
         blockIsValid = false;

      console.log(blockIsValid)
      return blockIsValid;

   }

   addBlockToQueue(block) {   
      if(this.blockQueue.id != block.id) {
         this.blockQueue = block;
         return true;
      } else {
         return false
      }
   }

}

module.exports = blockchain;