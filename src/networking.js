const net = require('net');
const server = net.createServer();
const crypto = require('crypto');
const BigNumber = require('bignumber.js');

class networking {

   server = net.createServer();

   constructor(host, port, bcrypto, transactionQueue, stableNode) {
      this.host = host;
      this.port = port;
      this.nodeList = new Array();
      this.stableNode = stableNode;
      this.bcrypto = bcrypto;
      this.transactionQueue = transactionQueue;
      this.registerToNetwork();
   }

   async broadcastToRandomNodes(packet, numOfRandomPeers = -1) {
      if (numOfRandomPeers == -1) {
         numOfRandomPeers = this.nodeList.length;
      } else {
         var numOfRandomPeers = (numOfRandomPeers > this.nodeList.length) ? this.nodeList.length - 1 : 8;
      }
      var notifiedNodes = [this.host];
      var successfullyNotifiedNodes = [this.host];

      while (successfullyNotifiedNodes.length - 1 < numOfRandomPeers && notifiedNodes.length - 1 < this.nodeList.length) {
         var randomNodeIndex = Math.floor(Math.random() * (this.nodeList.length));
         var randomNode = this.nodeList[randomNodeIndex];

         if (notifiedNodes.indexOf(randomNode.ipAddress) == -1 && successfullyNotifiedNodes.indexOf(randomNode.ipAddress) == -1) {
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
      this.addNodeToNodeList({ payload: { ipAddress: this.host, port: this.port }, publicKey: this.bcrypto.getPubKey(true) });

      var packet = {
         queryID: 2,
         unixTimestamp: Date.now(),
         payload: {
            ipAddress: this.host,
            port: this.port
         },
         publicKey: this.bcrypto.getPubKey().toPem(),
         signature: ""
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
            for (var i in data) {
               _this.addNodeToNodeList({ payload: { ipAddress: data[i].ipAddress, port: data[i].port }, publicKey: data[i].publicKey });
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

      try {
         await registration;
         for (var i = 0; i < this.nodeList.length; i++) {
            var registeredToNode = new Promise(function (resolve, reject) {
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

            try { await registeredToNode; } catch (error) { console.log(error) }
         }
      } catch (error) {
         console.log(error);
      }
   }

   addNodeToNodeList(packet) {
      var newNode = {
         ipAddress: packet.payload.ipAddress,
         port: packet.payload.port,
         publicKey: packet.publicKey,
         blockchainAddress: this.bcrypto.hash(packet.publicKey)
      };
      var nodeIsAlreadyRegistered = false;
      var nodeIndex = -1;

      for (var i = 0; i < this.nodeList.length && !nodeIsAlreadyRegistered; i++) {
         if (JSON.stringify(this.nodeList[i].publicKey) == JSON.stringify(packet.publicKey)) {
            nodeIsAlreadyRegistered = true;
            nodeIndex = i;
         }
      }

      if (!nodeIsAlreadyRegistered) {
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
            if (this.verrifyPacket(data.toString())) {
               var packet = JSON.parse(data.toString());

               switch (packet.queryID) {
                  case 1:
                     let status = this.transactionQueue.addTransaction(JSON.parse(data.toString()))
                     socket.write(JSON.stringify({ status: status }));

                     if (status) {
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

      if (packet.unixTimestamp <= Date.now() - 60000 || packet.unixTimestamp >= Date.now())
         packetIsValid = false;

      switch (packet.queryID) {
         case 1:
            if (JSON.stringify(Object.getOwnPropertyNames(packet)) != JSON.stringify(['queryID', 'unixTimestamp', 'blockchainSenderAddress', 'payload', 'publicKey', 'signature']) || JSON.stringify(Object.getOwnPropertyNames(packet.payload)) != JSON.stringify(['blockchainReceiverAddress', 'unitsToTransfer', 'networkFee']))
               packetIsValid = false;

            if (packet.payload.unitsToTransfer <= 0 || packet.payload.networkFee < 0) {
               packetIsValid = false;
            }

            if (packet.blockchainSenderAddress != crypto.createHash('sha256').update(packet.publicKey).digest('hex'))
               packetIsValid = false;

            break;

         case 2:
            if (JSON.stringify(Object.getOwnPropertyNames(packet)) != JSON.stringify(['queryID', 'unixTimestamp', 'payload', 'publicKey', 'signature']) || JSON.stringify(Object.getOwnPropertyNames(packet.payload)) != JSON.stringify(['ipAddress', 'port']))
               packetIsValid = false;

            if (!/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(packet.payload.ipAddress))
               packetIsValid = false;

            if (isNaN(packet.payload.port) || packet.payload.port > 65535 || packet.payload.port < 1)
               packetIsValid = false;

            break;
         case 3:
            break;

      }

      delete packetCopy.queryID;
      delete packetCopy.signature;

      if (!this.bcrypto.verrifySignature(packet.signature, packet.publicKey, JSON.stringify(packetCopy)))
         packetIsValid = false;

      return packetIsValid;
   }

   pickValidators(latestBlockHash, nextVotingSlot) {
      var validators = {validators:[], forger:{}};

      let numOfValidators = (this.nodeList.length - 1 < 128) ? this.nodeList.length - 1 : 128;
      var forgerAproximateAddress = new BigNumber(this.bcrypto.hash(latestBlockHash + nextVotingSlot), 16);


      var forgerAddress = new BigNumber("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", 16);
      var forgerAddressDifference = new BigNumber("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", 16);

      for(var i = 0; i < numOfValidators; i++) {

         var difference = forgerAproximateAddress.minus(this.nodeList[i].blockchainAddress, 16);
         if(difference.isNegative())
            difference = difference.negated();

         if(difference.lt(forgerAddressDifference)) {
            validators.forger = this.nodeList[i];
            forgerAddress = new BigNumber(this.nodeList[i].blockchainAddress, 16);
            forgerAddressDifference = difference;
         }
      }

      var validatorAproximateAddress = forgerAproximateAddress;
      while(validators.validators.length < numOfValidators) {
         validatorAproximateAddress = this.bcrypto.hash(validatorAproximateAddress.toString(16));

         var nodeListCopy = JSON.parse(JSON.stringify(this.nodeList));
         nodeListCopy.push({blockchainAddress: validatorAproximateAddress});
         
         nodeListCopy = nodeListCopy.sort((a, b) => (a.blockchainAddress > b.blockchainAddress) ? 1 : -1);
         var index = nodeListCopy.map(function(e) { return e.blockchainAddress; }).indexOf(validatorAproximateAddress);

         var indexesToAdd = new Array();
         if(index == 0) {
            indexesToAdd.push(index + 1);
         } else if(index == this.nodeList.length) {
            indexesToAdd.push(index - 1);
         } else {
            indexesToAdd.push(index - 1);
            indexesToAdd.push(index + 1);
         }

         for(var i = 0; i < indexesToAdd.length; i++) {
            if(validators.validators.map(function(e) { return e.blockchainAddress; }).indexOf(this.nodeList[indexesToAdd[i]].blockchainAddress) == -1 && forgerAproximateAddress != this.nodeList[indexesToAdd[i]].blockchainAddress) {
               validators.validators.push(this.nodeList[indexesToAdd[i]]);
            }
         }
      }
      
      return validators;

   }

}

module.exports = networking;