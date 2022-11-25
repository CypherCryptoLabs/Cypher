class transactionQueue {

   constructor(bcrypto, blockchain) {
      this.queue = [];
      this.Blockchain = blockchain;
      this.bcrypto = bcrypto;
   }

   addTransaction(transaction) {
      transaction.payload.unitsToTransfer = parseFloat((Math.ceil(parseFloat(transaction.payload.unitsToTransfer) * 1000) / 1000).toFixed(3));
      transaction.payload.networkFee = parseFloat((Math.ceil(parseFloat(transaction.payload.networkFee) * 1000) / 1000).toFixed(3));

      if (this.Blockchain.getBalanceForAddress(transaction.payload.blockchainSenderAddress) >= transaction.payload.unitsToTransfer + transaction.payload.networkFee) {
         if (this.queue && this.queue.length) {

            for(var i = 0; i < this.queue.length; i++) {
               if(this.queue[i].signature == transaction.signature)
               return false;
            }

            var unitsToTransferAlreadyInQueue = 0;

            for (var i = 0; i < this.queue.length; i++) {
               if (this.queue[i].payload.blockchainSenderAddress == transaction.payload.blockchainSenderAddress)
                  unitsToTransferAlreadyInQueue += parseFloat(this.queue[i].payload.unitsToTransfer) + parseFloat(this.queue[i].payload.networkFee);
            }

            if (unitsToTransferAlreadyInQueue + transaction.payload.unitsToTransfer + transaction.payload.networkFee < this.Blockchain.getBalanceForAddress(transaction.payload.blockchainSenderAddress)) {
               this.queue.push(transaction);
               return true
            } else {
               return false;
            }

         } else {
            this.queue[0] = transaction;
            return true;
         }
      } else {
         return false;
      }
   }

   async worker(networkingInstance) {
      var _this = this;
      let localNodeAddress = this.bcrypto.getFingerprint();

      while(true) {
         var now = Date.now();
         var nextVoteSlotTimestamp = now - (now % 60000) + 60000;
         var nextPoRDistributionSlot = now - (now % 60000) + 45000;
         var isValidator = false;
         var isForger = false;

         let validators = networkingInstance.consensus.pickValidators(this.bcrypto.hash(this.Blockchain.getNewestBlock(true)), nextVoteSlotTimestamp.toString());

         var timeToWait = nextPoRDistributionSlot - Date.now();
         let sleepPromiseDistribution = new Promise((resolve) => {
            setTimeout(resolve, timeToWait);
         });
         await sleepPromiseDistribution;

         // if this node is a validator for the current votingslot, send PoR to other validators
         if(validators.map(function(e) { return e.blockchainAddress; }).indexOf(localNodeAddress) != -1) {
            isValidator = true
            let porHash = networkingInstance.consensus.pickBestPoR(nextVoteSlotTimestamp);
            var por = networkingInstance.consensus.por[porHash]

            if(por != undefined) {
               por = JSON.parse(JSON.stringify(por))
               por.hash = porHash

               networkingInstance.consensus.distributePoR(validators, por)
               networkingInstance.consensus.votingSlotPoRList.push(por);
            }
         }

         var timeToWait = nextVoteSlotTimestamp - Date.now();
         let sleepPromiseVoting = new Promise((resolve) => {
            setTimeout(resolve, timeToWait);
         });
         await sleepPromiseVoting;

         let winnerPoR = networkingInstance.consensus.pickWinnerPoR(this.bcrypto.hash(this.Blockchain.getNewestBlock(true)), nextVoteSlotTimestamp.toString());
         
         if(winnerPoR != undefined) {
            let nodeListBlockchainAddresses = networkingInstance.nodeList.get().map(function(e) { return e.blockchainAddress; })
            let validatorListBlockchainAddresses = validators.map(function(e) { return e.blockchainAddress; })
            networkingInstance.consensus.forger = networkingInstance.nodeList.get(nodeListBlockchainAddresses.indexOf(winnerPoR.nodeBlockchainAddress))
            let forgerIndex = validatorListBlockchainAddresses.indexOf(winnerPoR.nodeBlockchainAddress)
            validators.splice(forgerIndex, 1);
            networkingInstance.consensus.validators = validators;

            if(networkingInstance.consensus.forger.blockchainAddress == localNodeAddress) {
               isForger = true;
            }
            
         } else {
            // fall back to alternate forger picker
         }

         if(isValidator && !isForger) {
            let sleepPromise = new Promise((resolve) => {
               setTimeout(resolve, 150);
            });
            await sleepPromise;
            console.log("This node is a validator for the current epoch. Forger:", networkingInstance.consensus.forger.ipAddress, networkingInstance.consensus.forger.port)
            networkingInstance.consensus.voteOnBlock(networkingInstance.consensus.forger, nextVoteSlotTimestamp, networkingInstance.consensus.validators, this.queue);
         } else if(isForger && validators.length > 1 && _this.queue && _this.queue.length) {
            console.log("This node is the forger for the current epoch.")
            var sortedQueue = this.queue.sort((a, b) => (a.payload.networkFee > b.payload.networkFee) ? 1 : (a.payload.networkFee === b.payload.networkFee) ? ((a.unixTimestamp > b.unixTimestamp) ? 1 : -1) : -1).slice(0, 100);
            networkingInstance.consensus.updatePotentialBlock(this.Blockchain.generateBlock(sortedQueue, validators, networkingInstance.networkDiff.diff));
         } else {
            console.log("This node is inactive during this epoch.")
            networkingInstance.consensus.updatePotentialBlock(this.Blockchain.generateBlock({}, validators, networkingInstance.networkDiff.diff));
         }

         networkingInstance.consensus.votingSlotPoRList = []
      }
   }

   clean(usedQueue) {
      let currentTimestamp = Date.now();
      for (var i = 0; i < usedQueue.length; i++) {
         for (var j = 0; j < this.queue.length; j++) {
            if (this.queue[j].signature == usedQueue[i].signature || this.queue[j].unixTimestamp < currentTimestamp - 43200000) {
               this.queue.splice(j, 1);
               j--;
            }
         }
      }
   }

   getQueue() {
      return JSON.parse(JSON.stringify(this.queue));
   }

}

module.exports = transactionQueue;