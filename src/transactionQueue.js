const net = require('net');

class transactionQueue {

   constructor(bcrypto, blockchain) {
      this.queue = [];
      this.Blockchain = blockchain;
      this.bcrypto = bcrypto;
   }

   addTransaction(transaction) {
      var senderHasPendingTransaction = false;

      if (this.Blockchain.getBalanceForAddress(transaction.blockchainSenderAddress) >= transaction.payload.unitsToTransfer + transaction.payload.networkFee) {
         if (this.queue && this.queue.length) {
            for (var i = 0; i < this.queue.length && !senderHasPendingTransaction; i++) {
               if (this.queue[i].blockchainSenderAddress == transaction.blockchainSenderAddress)
                  senderHasPendingTransaction = true;
            }
            if (!senderHasPendingTransaction) {
               this.queue[this.queue.length] = transaction;
            } else {
               return false;
            }
         } else {
            this.queue[0] = transaction;
         }
      } else {
         senderHasPendingTransaction = true;
      }

      return !senderHasPendingTransaction;
   }

   async worker(networkingInstance) {
      var _this = this;

      while(true) {
         var now = Date.now();
         var nextVoteSlotTimestamp = now - (now % 60000) + 60000;

         let validators = networkingInstance.pickValidators(this.bcrypto.hash(this.Blockchain.getNewestBlock()), nextVoteSlotTimestamp.toString());
         var timeToWait = nextVoteSlotTimestamp - Date.now();

         var sleepPromise = new Promise((resolve) => {
            setTimeout(resolve, timeToWait);
         });
         await sleepPromise;

         let localNodeAddress = this.bcrypto.hash(this.bcrypto.getPubKey(true));
         if(validators.validators.map(function(e) { return e.blockchainAddress; }).indexOf(localNodeAddress) != -1) {
            
            var sleepPromise = new Promise((resolve) => {
               setTimeout(resolve, 100);
            });
            await sleepPromise;

            networkingInstance.voteOnBlock(validators.forger, nextVoteSlotTimestamp, validators.validators, this.queue);
         } else if(validators.forger.blockchainAddress == localNodeAddress && _this.queue && _this.queue.length) {
            var sortedQueue = this.queue.sort((a, b) => (a.payload.networkFee > b.payload.networkFee) ? 1 : (a.payload.networkFee === b.payload.networkFee) ? ((a.unixTimestamp > b.unixTimestamp) ? 1 : -1) : -1).slice(0, 100);
            await networkingInstance.updatePotentialBlock(this.Blockchain.generateBlock(sortedQueue, validators));
         } else {
            networkingInstance.updatePotentialBlock(this.Blockchain.generateBlock({}));
         }
         
      }
   }

   clean(usedQueue) {
      for (var i = 0; i < usedQueue.length; i++) {
         for (var j = 0; j < this.queue.length; j++) {
            if (this.queue.signature == usedQueue.signature)
               this.queue.splice(j, 1);
         }
      }
   }

   getQueue() {
      return JSON.parse(JSON.stringify(this.queue));
   }

}

module.exports = transactionQueue;