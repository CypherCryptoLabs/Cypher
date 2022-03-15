const blockchain = require(__dirname + "/blockchain.js");
const net = require('net');

class transactionQueue {

   constructor(bcrypto) {
      this.queue = [];
      this.Blockchain = new blockchain();
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

   worker(networkingInstance) {
      var _this = this;
      setInterval(function () { // need to find alterbative to setInterval
         if (_this.queue && _this.queue.length) {
            var sortedQueue = _this.queue.sort((a, b) => (a.payload.networkFee > b.payload.networkFee) ? 1 : (a.payload.networkFee === b.payload.networkFee) ? ((a.unixTimestamp > b.unixTimestamp) ? 1 : -1) : -1).slice(0, 100);
            var potentialNewBlock = _this.Blockchain.generateBlock(sortedQueue);
            var packet = {potentialBlock: potentialNewBlock, unixTimestamp: Date.now(), publicKey: _this.bcrypto.getPubKey().toPem() }
            packet.signature = _this.bcrypto.sign(JSON.stringify(packet));
            packet.queryID = 3;

            for (var i = 0; i < networkingInstance.nodeList.length; i++) {
               let client = new net.Socket();

               client.connect(networkingInstance.nodeList[i].port, networkingInstance.nodeList[i].ipAddress, () => {

                  client.write(JSON.stringify(packet));
                  client.end();
                  //client.destroy();

               });

               client.on('close', () => {
                  console.log('Client closed');
               });
      
               client.on('error', (err) => {
                  console.error(err);
                  reject();
               });

            }

            //_this.Blockchain.appendBlockToBlockchain(potentialNewBlock);
            _this.clean(sortedQueue);
         }
      }, 10000);
   }

   clean(usedQueue) {
      for (var i = 0; i < usedQueue.length; i++) {
         for (var j = 0; j < this.queue.length; j++) {
            if (this.queue.signature == usedQueue.signature)
               this.queue.splice(j, 1);
         }
      }
   }

}

module.exports = transactionQueue;