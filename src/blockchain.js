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

               if(blockchainCopy[i].hasOwnProperty("validators")) {
                  let validators = Object.keys(blockchainCopy[i].validators);

                  for(var j in validators) {
                     if(blockchainCopy[i].validators[validators[j]] == "") {
                        if(cacheObj.hasOwnProperty(validators[j])) {
                           cacheObj[validators[j]].balance -= 15;
                           if(cacheObj[validators[j]].balanceChanges.lastIndexOf(i) == -1)
                              cacheObj[validators[j]].balanceChanges.push(i);
                        }
                     }
                  }
               }

               for(var j in blockchainCopy[i].networkDiff.left) {
                  if(cacheObj.hasOwnProperty(blockchainCopy[i].networkDiff.left[j].blockchainAddress)) {
                     cacheObj[blockchainCopy[i].networkDiff.left[j].blockchainAddress].balance -= 1;
                     if(cacheObj[blockchainCopy[i].networkDiff.left[j].blockchainAddress].balanceChanges.lastIndexOf(i) == -1)
                        cacheObj[blockchainCopy[i].networkDiff.left[j].blockchainAddress].balanceChanges.push(i);
                  }
               }

               let payload = blockchainCopy[i].payload;
               for(var j = 0; j < payload.length; j++) {
                  cacheObj[payload[j].payload.blockchainSenderAddress].balance -= (payload[j].payload.unitsToTransfer + payload[j].payload.networkFee);
                  if(cacheObj[payload[j].payload.blockchainSenderAddress].balanceChanges.lastIndexOf(i) == -1)
                     cacheObj[payload[j].payload.blockchainSenderAddress].balanceChanges.push(i);

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
      } catch (err) {
         console.log(err);
         process.exit();
      }
   }

   updateAddressCache(block) {
      if(this.addressCache.hasOwnProperty(block.rewardAddress)) {
         this.addressCache[block.rewardAddress].balance += block.rewardAmount;
         this.addressCache[block.rewardAddress].balanceChanges.push(block.id);
      } else {
         this.addressCache[block.rewardAddress] = {balance: block.rewardAmount, balanceChanges: [block.id]};
      }

      if(block.hasOwnProperty("validators")) {
         let validators = Object.keys(block.validators);

         for(var j in validators) {
            if(block.validators[validators[j]] == "") {
               if(this.addressCache.hasOwnProperty(validators[j])) {
                  this.addressCache[validators[j]].balance -= 15;
                  if(this.addressCache[validators[j]].balanceChanges.lastIndexOf(block.id) == -1)
                  this.addressCache[validators[j]].balanceChanges.push(block.id);
               }
            }
         }
      }

      for(var j in block.networkDiff.left) {
         if(this.addressCache.hasOwnProperty(block.networkDiff.left[j].blockchainAddress)) {
            this.addressCache[block.networkDiff.left[j].blockchainAddress].balance -= 1;
            if(this.addressCache[block.networkDiff.left[j].blockchainAddress].balanceChanges.lastIndexOf(block.id) == -1)
            this.addressCache[block.networkDiff.left[j].blockchainAddress].balanceChanges.push(block.id);
         }
      }

      let payload = block.payload;
      for(var j = 0; j < payload.length; j++) {
         this.addressCache[payload[j].payload.blockchainSenderAddress].balance -= (payload[j].payload.unitsToTransfer + payload[j].payload.networkFee);
         if(this.addressCache[payload[j].payload.blockchainSenderAddress].balanceChanges.lastIndexOf(block.id) == -1)
            this.addressCache[payload[j].payload.blockchainSenderAddress].balanceChanges.push(block.id);

         if(this.addressCache.hasOwnProperty(payload[j].payload.blockchainReceiverAddress)) {
            this.addressCache[payload[j].payload.blockchainReceiverAddress].balance += payload[j].payload.unitsToTransfer;
            if(this.addressCache[payload[j].payload.blockchainReceiverAddress].balanceChanges.lastIndexOf(block.id) == -1) {
               this.addressCache[payload[j].payload.blockchainReceiverAddress].balanceChanges.push(block.id);
            }
         } else {
            this.addressCache[payload[j].payload.blockchainReceiverAddress] = {balance: payload[j].payload.unitsToTransfer, balanceChanges: [block.id]};
         }
      }

      fs.writeFileSync("cache.json", JSON.stringify(this.addressCache));
   }

   generateBlock(sortedQueue, validators, networkDiff) {
      if(sortedQueue.length) {
         sortedQueue.forEach(object => {
            delete object["queryID"];
         });
      }

      var previousBlock = this.getNewestBlock(true);
      var transactionQueueNetworkFeeSum = 0;

      for(var i in sortedQueue) {
         let transaction = sortedQueue[i];
         transactionQueueNetworkFeeSum += transaction.payload.networkFee;
      }

      var block = {
         id: JSON.parse(previousBlock).id + 1,
         timestamp: Date.now(),
         previousBlockHash: this.bcrypto.hash(previousBlock),
         rewardAddress: this.bcrypto.getFingerprint(),
         rewardAmount: (transactionQueueNetworkFeeSum > 1) ? transactionQueueNetworkFeeSum : 1,
         payloadHash: this.bcrypto.hash(JSON.stringify(sortedQueue)),
         payload: sortedQueue,
         networkDiff: networkDiff,
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

   appendBlockToBlockchain(networkingInstance, block = undefined) {
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

      if(block != undefined) {
         fs.appendFileSync(blockchainFilePath, "," + JSON.stringify(block) + "]}");
         networkingInstance.updateNetworkCache(block);
      }
   }

   getNewestBlock(removeValidatorSignatures = false) {
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

      if(!removeValidatorSignatures)
         return lastBlockBuffer;

      var parsedBlock = JSON.parse(lastBlockBuffer);
      delete parsedBlock.validators

      return JSON.stringify(parsedBlock);
   }

   getNewestNBlocks(n) {
      if(n > JSON.parse(this.getNewestBlock()).id)
         return;
      
      var nBlocks = "";

      var blockchainFd = fs.openSync("blockchain.json", "r");
      var blockchainFileSize = fs.statSync("blockchain.json").size;
      var totalBuffer = Buffer.alloc(0);

      var index = -1;
      var i = 0;
      var dataReadForIteration = 0;

      while(index == -1) {
         let position = blockchainFileSize - (10000 * i);
         var buffer = Buffer.alloc((position >= 0) ? 10000 : position + 10000);

         dataReadForIteration = fs.readSync(blockchainFd, buffer, 0, (position >= 0) ? 10000 : position + 10000, blockchainFileSize - (10000 * i));
         i++;

         index = buffer.toString().lastIndexOf('{"id":' + n + ',');
         totalBuffer = Buffer.concat([buffer, totalBuffer]);
      }

      totalBuffer = totalBuffer.subarray(index, dataReadForIteration + ((i - 2) * 10000)).toString("utf-8");
      return JSON.parse("{\"blocks\":[" + totalBuffer);
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
               if (blockchain.blockchain[i].payload[j].payload.blockchainSenderAddress == blockchainAddress) {
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

   validateBlock(block, currentVotingSlot, validators, forger, transactionQueue, networkDiff) {
      var blockCopy = JSON.parse(block);
      delete blockCopy.forgerSignature;
      var blockCopyValidators = Object.keys(blockCopy.validators);
      for(var i = 0; i < blockCopyValidators.length; i++) {
         blockCopy.validators[blockCopyValidators[i]] = "";
      }
      blockCopy = JSON.stringify(blockCopy);

      if(transactionQueue.length) {
         transactionQueue.forEach(object => {
            delete object["queryID"];
         });
      }

      block = JSON.parse(block);
      var blockIsValid = true;
      
      if(JSON.stringify(Object.getOwnPropertyNames(block)) != JSON.stringify(['id', 'timestamp', 'previousBlockHash', 'rewardAddress', 'rewardAmount', "payloadHash", "payload", "networkDiff", "validators", "forgerSignature"]))
         return 1;

      if(block.timestamp < currentVotingSlot || block.timestamp > Date.now())
         return 2;
      
      if(block.rewardAddress != forger.blockchainAddress) 
         return 3;

      if(block.payloadHash != this.bcrypto.hash(JSON.stringify(block.payload)))
         return 4;

      for(var i = 0; i < block.payload.length; i++) {
         var signatureTmp = block.payload[i].signature;

         for(var j = 0; j < block.payload.length; j++) {
            if(j!=i) {
               if(signatureTmp == block.payload[j].signature) return 5;
            }
         }
      }

      if(JSON.stringify(Object.getOwnPropertyNames(block.networkDiff)) != JSON.stringify(["registered", "left"]))
         return 6;
      
      if(block.networkDiff.registered.length != networkDiff.registered.length || block.networkDiff.left.length != networkDiff.left.length)
         return 7;

      for(var i = 0; i < block.networkDiff.registered.length; i++) {
         var registrationFound = false;
         var registrationInBlock = JSON.stringify(block.networkDiff.registered[i]);
         for(var j = 0; j < networkDiff.registered.length; j++) {
            var registrationLocal = JSON.stringify(networkDiff.registered[j]);
            if(registrationInBlock == registrationLocal) {
               registrationFound = true;
               break;
            }
         }

         if(!registrationFound)
            return 8;
      }

      for(var i = 0; i < block.networkDiff.left.length; i++) {
         var leaveFound = false;
         var leaveInBlock = JSON.stringify(block.networkDiff.left[i]);
         for(var j = 0; j < networkDiff.left.length; j++) {
            var leaveLocal = JSON.stringify(networkDiff.left[j]);
            if(leaveInBlock == leaveLocal) {
               leaveFound = true;
               break;
            }
         }

         if(!leaveFound)
            return 9;
      }

      var expectedRewardAmount = 0;

      for(var i = 0; i < block.payload.length && blockIsValid; i++) {
         var transactionFound = false;
         expectedRewardAmount += block.payload[i].payload.networkFee;
         for(var j = 0; j < transactionQueue.length && !transactionFound; j++) {
            let transactionQueueEntryString = JSON.stringify(transactionQueue[j]);
            let blockPayloadEntryString = JSON.stringify(block.payload[i]);

            if(blockPayloadEntryString == transactionQueueEntryString) {
               transactionFound = true;
            }
         }
         if(!transactionFound)
            return 10;
      }

      if(block.rewardAmount != expectedRewardAmount)
         return 11;
      
      if(Object.keys(block.validators).length != validators.length)
         return 12;
      
      for(var i = 0; i < block.validators.length && blockIsValid; i++) {
         if(block.validators[validators[i]] == undefined) {
            return 13;
         }
      }

      if(!this.bcrypto.verrifySignature(block.forgerSignature, forger.publicKey, blockCopy))
         return 14;

      let previousBlock = this.getNewestBlock(true);
      let previousBlockHash = this.bcrypto.hash(previousBlock);

      if(block.previousBlockHash != previousBlockHash)
            return 15;

      if(block.id != JSON.parse(previousBlock).id + 1)
         return 16;

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

   generateNodeList() {
      var nodeList = [];
      var blockchainCopy = JSON.parse(fs.readFileSync("blockchain.json").toString()).blockchain;

      for(var i = 0; i < blockchainCopy.length; i++) {
         var networkDiff = blockchainCopy[i].networkDiff;

         for(var j = 0; j < networkDiff.registered.length; j++) {
            var nodeUpdated = false;
            for(var k = 0; k < nodeList.length; k++) {
               if(nodeList[k].publicKey == networkDiff.registered[j].publicKey) {
                  nodeList.splice(k, 1);
                  nodeList.push(networkDiff.registered[j]);
                  nodeUpdated = true;
               }
            }

            if(!nodeUpdated) nodeList.push(networkDiff.registered[j]);
         }

         for(var j = 0; j < networkDiff.left.length; j++) {
            for(var k = 0; k < nodeList.length; k++) {
               if(nodeList[k].publicKey == networkDiff.left[j].publicKey) {
                  nodeList.splice(k, 1);
               }
            }
         }
      }

      return {blockHeight:JSON.parse(this.getNewestBlock()).id, nodeList: nodeList};
   }

}

module.exports = blockchain;