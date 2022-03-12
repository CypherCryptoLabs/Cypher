// CONFIG //
var port = 0; 
var host = ''; 
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

class transactionQueue {

   constructor(validatorPort, bcrypto) {
      this.queue = [];
      this.Blockchain = new blockchain();
      this.validatorPort = validatorPort;
      this.bcrypto = bcrypto;
   }

   addTransaction(transaction) {
      var senderHasPendingTransaction = false;

      if(this.Blockchain.getBalanceForAddress(transaction.blockchainSenderAddress) >= transaction.payload.unitsToTransfer + transaction.payload.networkFee) {
         if(this.queue && this.queue.length) {
            for(var i = 0; i < this.queue.length && !senderHasPendingTransaction; i++) {
               if(this.queue[i].blockchainSenderAddress == transaction.blockchainSenderAddress)
                  senderHasPendingTransaction = true;
            }
            if(!senderHasPendingTransaction){
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
      setInterval(function() { // need to find alterbative to setInterval
         if(_this.queue && _this.queue.length) {
            var sortedQueue = _this.queue.sort((a, b) => (a.payload.networkFee > b.payload.networkFee) ? 1 : (a.payload.networkFee === b.payload.networkFee) ? ((a.unixTimestamp > b.unixTimestamp) ? 1 : -1) : -1 ).slice(0, 100);
            var potentialNewBlock = _this.Blockchain.generateBlock(sortedQueue);
            var packet = {queryID: 3, potentialBlock: potentialNewBlock, unixTimestamp : Date.now(), publicKey: _this.bcrypto.getPubKey().toPem()}
            packet.signature = _this.bcrypto.sign(JSON.stringify(packet));
            console.log(packet)

            for(var i = 0; i < networkingInstance.nodeList.length; i++) {
               let client = new net.Socket();

               client.connect(networkingInstance.nodeList[i].port, networkingInstance.nodeList[i].ipAddress, () => { 
            
                  client.write(JSON.stringify(packet)); 
                  client.end();
                  client.destroy();

               });
            }

            console.log(networkingInstance.nodeList);

            //_this.Blockchain.appendBlockToBlockchain(potentialNewBlock);
            _this.clean(sortedQueue);
         }
     }, 10000);
   }

   clean(usedQueue) {
      for(var i = 0; i < usedQueue.length; i ++) {
         for(var j = 0; j < this.queue.length; j++) {
            if(this.queue.signature == usedQueue.signature)
               this.queue.splice(j, 1);
         }
      }
   }

}

const net = require('net'); 
const ellipticcurve = require("starkbank-ecdsa");
const server = net.createServer();
const crypto = require('crypto');
const { PrivateKey } = require('starkbank-ecdsa/ellipticcurve/privateKey');

class bcrypto {

   constructor(privateKeyPath) {
      this.privateKeyPath = privateKeyPath;
      this.privateKey = new String();
      this.publicKey = new String();
      this.generateNewKey();
   }

   publicKey = this.publicKey;
   Ecdsa = ellipticcurve.Ecdsa;
   PrivateKey = ellipticcurve.PrivateKey;

   generateNewKey() {

      try {
         if (fs.existsSync("private.pem")) {
            this.privateKey = PrivateKey.fromPem(fs.readFileSync("private.pem").toString());
            this.publicKey = this.privateKey.publicKey();
         } else {
            console.log("Key not found")

            this.privateKey = new PrivateKey();
            this.publicKey = this.privateKey.publicKey();

            fs.writeFileSync('private.pem', this.privateKey.toPem());
         }
      } catch(err) {
         console.log(err);
      }
   }

   static verrifySignature(signatureBase64, publicKeyPEM, packet) {

      const Ecdsa = ellipticcurve.Ecdsa;
      const PublicKey = ellipticcurve.PublicKey;
      const Signature = ellipticcurve.Signature;

      let publicKey = PublicKey.fromPem(publicKeyPEM);
      let signature = Signature.fromBase64(signatureBase64);

      return Ecdsa.verify(packet, signature, publicKey);
   }

   sign(packet) {

      const Ecdsa = ellipticcurve.Ecdsa;
      return Ecdsa.sign(packet, this.privateKey).toBase64();

   }

   getPubKey() {
      return this.publicKey;
   }

}

class networking {
   
   server = net.createServer();

   constructor(host, port, bcrypto, stableNode = "192.168.178.39") {
      this.host = host;
      this.port = port;
      this.nodeList = new Array();
      this.stableNode = stableNode;
      this.bcrypto = bcrypto;
      this.registerToNetwork();
   }

   async broadcastToRandomNodes(packet, numOfRandomPeers = -1) {
      if(numOfRandomPeers == -1) {
         numOfRandomPeers = this.nodeList.length;
      } else {
         var numOfRandomPeers = (numOfRandomPeers > this.nodeList.length) ? this.nodeList.length - 1 : 8;
      }
      var notifiedNodes = [host];
      var successfullyNotifiedNodes = [host];

      while(successfullyNotifiedNodes.length - 1 < numOfRandomPeers && notifiedNodes.length - 1 < this.nodeList.length) {
         var randomNodeIndex = Math.floor(Math.random() * (this.nodeList.length));
         var randomNode = this.nodeList[randomNodeIndex];

         if(notifiedNodes.indexOf(randomNode.ipAddress) == -1 && successfullyNotifiedNodes.indexOf(randomNode.ipAddress) == -1) {
            let client = new net.Socket();

            var randomNodeNotified = new Promise(function (resolve, reject) {
               client.connect(randomNode.port, randomNode.ipAddress, () => { 
                  console.log(`client connected to ${randomNode.ipAddress}:${randomNode.port}`); 
            
                  client.write(JSON.stringify(packet)); 
                  client.end();
               });
            
               client.on('data', (data) => {
                  data = data.toString();
                  console.log(data);
                  resolve();
                  client.destroy();
               }); 
            
               // Add a 'close' event handler for the client socket 
               client.on('close', () => { 
                  console.log('Client closed'); 
               }); 
            
               client.on('error', (err) => { 
                  console.error(err);
                  reject();
               }); 
            });

            try {
               var x = await randomNodeNotified;
               successfullyNotifiedNodes.push(randomNode.ipAddress);
            } catch (error) {
               console.log(error);
            }

            notifiedNodes.push(randomNode.ipAddress);
         }

      }
   }

   async registerToNetwork() {
      this.addNodeToNodeList({payload : {ipAddress : host, port : port}, publicKey : this.bcrypto.getPubKey().toPem()});
      
      var packet = {
         queryID : 2,
         unixTimestamp : Date.now(),
         payload : {
            ipAddress : host,
            port : port
         },
         publicKey : this.bcrypto.getPubKey().toPem(),
         signature : ""
      }

      var packetCopy = JSON.parse(JSON.stringify(packet));

      delete packetCopy.queryID;
      delete packetCopy.signature;

      packet.signature = this.bcrypto.sign(JSON.stringify(packetCopy));
      var _this = this;

      // send it to the stableNode
      var registration = new Promise(function (resolve, reject) {
         var client = new net.Socket();
         client.connect(_this.port, _this.stableNode, () => { 
            console.log(`client connected to ${_this.stableNode}:${_this.port}`); 
      
            client.write(JSON.stringify(packet)); 
            client.end();
         });
      
         client.on('data', (data) => {
            data = JSON.parse(data);   
            for(var i in data) {
               _this.addNodeToNodeList({payload : {ipAddress : data[i].ipAddress, port : data[i].port}, publicKey : data[i].publicKey});         
            }

            client.destroy();
            resolve();
         }); 
      
         // Add a 'close' event handler for the client socket 
         client.on('close', () => { 
            console.log('Client closed'); 
         }); 
      
         client.on('error', (err) => { 
            console.error(err);
            reject();
         });
      });

      try{
         await registration;
         for(var i = 0; i < this.nodeList.length; i++) {
            var registeredToNode = new Promise(function(resolve, reject) {
               var client = new net.Socket();
               client.connect(_this.nodeList[i].port, _this.nodeList[i].ipAddress, () => { 
                  client.write(JSON.stringify(packet)); 
                  client.end();
                  resolve();
               });

               client.on('error', (err) => { 
                  console.error(err);
                  reject();
               });
            });

            try{await registeredToNode;} catch(error) {console.log(error)}
         }
      } catch (error) {
         console.log(error);
      }
   }

   addNodeToNodeList(packet) {
      var newNode = {
         ipAddress : packet.payload.ipAddress,
         port : packet.payload.port,
         publicKey : packet.publicKey
      };
      var nodeIsAlreadyRegistered = false;
      var nodeIndex = -1;

      for(var i = 0; i < this.nodeList.length && !nodeIsAlreadyRegistered; i++) {
         if(JSON.stringify(this.nodeList[i].publicKey) == JSON.stringify(packet.publicKey)) {
            nodeIsAlreadyRegistered = true;
            nodeIndex = i;
         }
      }

      if(!nodeIsAlreadyRegistered) {
         this.nodeList.push(newNode);
      } else {
         this.nodeList.splice(nodeIndex, 1);
         this.nodeList.push(newNode);
      }
   }

   connectionHandler() {
      server.listen(this.port, this.host, () => { 
         console.log(`Node listening on ${this.host}:${this.port}`); 
      });

      server.on('connection', (socket) => { 
         var clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
         
         socket.on('data', (data) => { 
            // handle incomming data
            if(this.verrifyPacket(data.toString())) {
               var packet = JSON.parse(data.toString());
               
               switch(packet.queryID) {
                  case 1: 
                     let status = TransactionQueue.addTransaction(JSON.parse(data.toString()))
                     socket.write(JSON.stringify({status : status}));

                     if(status) {
                        this.broadcastToRandomNodes(packet, 8);
                     }

                     break;
                  case 2:
                     this.addNodeToNodeList(packet);
                     socket.write(JSON.stringify(this.nodeList));
                     break;

                  case 3:
                     console.log(packet);
                     break;
               }
            }
            socket.end();
            socket.destroy();
         });

         socket.on('error', (err) => { 
            console.log(`[` + Date.now().toString + `] Error occurred in ${clientAddress}: ${err.message}`); 
         }); 
      });
   }

   verrifyPacket(packetJSON) {
      let packet = JSON.parse(packetJSON);
      let packetCopy = JSON.parse(packetJSON);
      var packetIsValid = true;

      if(packet.unixTimestamp <= Date.now() - 60000 || packet.unixTimestamp >= Date.now())
               packetIsValid = false;

      switch (packet.queryID) {
         case 1:
            if(JSON.stringify(Object.getOwnPropertyNames(packet)) != JSON.stringify(['queryID', 'unixTimestamp', 'blockchainSenderAddress', 'payload', 'publicKey', 'signature']) || JSON.stringify(Object.getOwnPropertyNames(packet.payload)) != JSON.stringify(['blockchainReceiverAddress', 'unitsToTransfer', 'networkFee']))
               packetIsValid = false;

            if(packet.payload.unitsToTransfer <= 0 || packet.payload.networkFee < 0) {
               packetIsValid = false;
            }

            if(packet.blockchainSenderAddress != crypto.createHash('sha256').update(packet.publicKey).digest('hex'))
               packetIsValid = false;
            
            break;

         case 2:
            if(JSON.stringify(Object.getOwnPropertyNames(packet)) != JSON.stringify(['queryID', 'unixTimestamp', 'payload', 'publicKey', 'signature']) || JSON.stringify(Object.getOwnPropertyNames(packet.payload)) != JSON.stringify(['ipAddress', 'port']))
               packetIsValid = false;

            if (!/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(packet.payload.ipAddress))
               packetIsValid = false;

            if(isNaN(packet.payload.port) || packet.payload.port > 65535 || packet.payload.port < 1)
               packetIsValid = false;

            break;
         case 3:
            break;

      }

      delete packetCopy.queryID;
      delete packetCopy.signature;

      if(!bcrypto.verrifySignature(packet.signature, packet.publicKey, JSON.stringify(packetCopy)))
         packetIsValid = false;

      return packetIsValid;
   }

}
var configFile = fs.readFileSync("config.json", "utf-8");
host = JSON.parse(configFile).host;
port = JSON.parse(configFile).port;
stableNode = JSON.parse(configFile).stableNode;

var BCrypto = new bcrypto();
const TransactionQueue = new transactionQueue(1235, BCrypto);

let netInstance = new networking(host, port, BCrypto,stableNode);
TransactionQueue.worker(netInstance);
netInstance.connectionHandler();