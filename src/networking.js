const net = require('net');
const server = net.createServer();
const crypto = require('crypto');
const BigNumber = require('bignumber.js');
const { resolve } = require('path');
const blockchain = require('./blockchain');

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
      this.potentialBlock;
      this.validators;
      this.signatures;
      this.blockchain = new blockchain(bcrypto);
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
                  //console.log(`client connected to ${randomNode.ipAddress}:${randomNode.port}`);

                  client.write(JSON.stringify(packet));
                  client.end();
               });

               client.on('data', (data) => {
                  data = data.toString();
                  //console.log(data);
                  resolve();
                  client.destroy();
               });

               // Add a 'close' event handler for the client socket 
               client.on('close', () => {
                  //console.log('Client closed');
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
               //console.log(error);
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
            //console.log(`client connected to ${_this.stableNode}:${_this.port}`);

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
            //console.log('Client closed');
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

            try { await registeredToNode; } catch (error) { /*console.log(error)*/ }
         }
      } catch (error) {
         //console.log(error);
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
            //console.log("received :"  + data.toString());
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
                     if(packet.type == "request")
                        socket.write(JSON.stringify(this.potentialBlock));

                     if(packet.type == "vote") {
                        var blockToVoteOnCopy;
                        if(typeof this.potentialBlock == "string") {
                           blockToVoteOnCopy = JSON.parse(this.potentialBlock);
                        } else if(typeof this.potentialBlock == "object") {
                           blockToVoteOnCopy = JSON.parse(JSON.stringify(this.potentialBlock));
                        }
                        //delete blockToVoteOnCopy.validators;

                        var senderIsValidator = false;
                        if(this.validators != undefined && this.validators.hasOwnProperty('length')) {
                           for(var i = 0; i < this.validators.length; i++) {
                              if(packet.publicKey == this.validators[i].publicKey)
                                 senderIsValidator = true;
                           }
                        }

                        if(this.bcrypto.verrifySignature(packet.payload.signature, packet.publicKey, JSON.stringify(blockToVoteOnCopy)) && senderIsValidator) {
                           this.signatures[this.bcrypto.hash(packet.publicKey)] = packet.payload.signature;
                        }
                     }
                               
                     break;

                  case 4:
                     console.log(packet);
                     socket.write(JSON.stringify({ status: true }));
                     this.broadcastToRandomNodes(packet)
                     break;
               }
            }
            socket.end();
            socket.destroy();
         });

         socket.on('error', (err) => {
            //console.log(`[` + Date.now().toString + `] Error occurred in ${clientAddress}: ${err.message}`);
         });
      });
   }

   verrifyPacket(packetJSON) {
      try {
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
               /*if ((JSON.stringify(Object.getOwnPropertyNames(packet)) != JSON.stringify(['queryID', 'unixTimestamp', 'type', 'publicKey', 'signature']) || packet.type != "request") && (JSON.stringify(Object.getOwnPropertyNames(packet)) != JSON.stringify(['queryID', 'unixTimestamp', 'type', 'payload', 'publicKey', 'signature']) || JSON.stringify(Object.getOwnPropertyNames(packet)) != JSON.stringify(['signature'] || packet.type != "vote"))) {
                  packetIsValid = false;
               }*/

               if(!packet.hasOwnProperty("type") && packet.type != "request" && packet.type != "vote")
                  packetIsValid = false;

               if(packet.type == "request" && JSON.stringify(Object.getOwnPropertyNames(packet)) != JSON.stringify(['queryID', 'unixTimestamp', 'type', 'publicKey', 'signature'])) {
                  packetIsValid = false;
               }

               if(packet.type == "vote" && (JSON.stringify(Object.getOwnPropertyNames(packet)) != JSON.stringify(['queryID', 'unixTimestamp', 'type', 'payload', 'publicKey', 'signature']) || JSON.stringify(Object.getOwnPropertyNames(packet.payload)) != JSON.stringify(['signature']))) {
                  packetIsValid = false;
               }
               // TODO: checks for packet with QueryID 3 and 4
               break;
            case 4:
               break;
            default:
               packetIsValid = false;
               break;

         }

         delete packetCopy.queryID;
         delete packetCopy.signature;

         if (!this.bcrypto.verrifySignature(packet.signature, packet.publicKey, JSON.stringify(packetCopy)))
            packetIsValid = false;

         return packetIsValid;
      } catch (error) {
         //console.log(error);
         return false;
      }
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
         } else if(index == nodeListCopy.length - 1) {
            indexesToAdd.push(index - 1);
         } else {
            indexesToAdd.push(index - 1);
            indexesToAdd.push(index + 1);
         }

         for(var i = 0; i < indexesToAdd.length; i++) {
            if(validators.validators.map(function(e) { return e.blockchainAddress; }).indexOf(nodeListCopy[indexesToAdd[i]].blockchainAddress) == -1 && 
            validators.forger.blockchainAddress != nodeListCopy[indexesToAdd[i]].blockchainAddress) {
               validators.validators.push(nodeListCopy[indexesToAdd[i]]);
            }
         }
      }
      
      return validators;

   }

   async voteOnBlock(forger, currentVotingSlot, validators, transactionQueue) {
      var client = new net.Socket();
      var blockToVoteOn;

      var retrieveBlockPromise = new Promise((resolve, reject) => {
         client.connect(forger.port, forger.ipAddress, () => {
            var packet = {queryID:3, unixTimestamp: Date.now(), type:"request", publicKey:this.bcrypto.getPubKey().toPem()};
            var packetCopy = JSON.parse(JSON.stringify(packet));
            delete packetCopy.queryID;
   
            packet.signature = this.bcrypto.sign(JSON.stringify(packetCopy));
   
            client.write(JSON.stringify(packet))
         });
   
         client.on('data', (data) => {
            blockToVoteOn = data.toString();
            resolve();
         });

         client.on('error', (error) => {
            reject();
         })
      })

      var transactionQueueCopy = JSON.parse(JSON.stringify(transactionQueue));
      transactionQueueCopy.forEach(object => {
         delete object["queryID"];
      });

      try {
         await retrieveBlockPromise;
         if (this.blockchain.validateBlock(blockToVoteOn, currentVotingSlot, validators, forger, transactionQueueCopy)) {
            // send signature to Forger
            this.updateValidators(validators, blockToVoteOn);
            var blockToVoteOnCopy = JSON.parse(blockToVoteOn);
            delete blockToVoteOn.validators;

            var blockVoteSignature = this.bcrypto.sign(JSON.stringify(blockToVoteOnCopy));
            var packetVote = {queryID:3, unixTimestamp: Date.now(), type:"vote", payload: {signature:blockVoteSignature},publicKey:this.bcrypto.getPubKey().toPem()};
            var packetVoteCopy = JSON.parse(JSON.stringify(packetVote));
            delete packetVoteCopy.queryID;
   
            packetVote.signature = this.bcrypto.sign(JSON.stringify(packetVoteCopy));

            for(var i = 0; i < validators.length; i++) {
               if(validators[i].publicKey != this.bcrypto.getPubKey(true)) {
                  let z = i;
                  let clientVote = new net.Socket();
                  //console.log(validators[z]);
                  clientVote.connect(validators[z].port, validators[z].ipAddress, () => {
                     //console.log("send vote package (" + validators[z].ipAddress + ":" + validators[z].port + "): " + JSON.stringify(packetVote));
            
                     clientVote.write(JSON.stringify(packetVote))
                  });
            
                  clientVote.on('data', (data) => {
                  });
         
                  clientVote.on('error', (error) => {
                  })
               }
            }

            var timeToWait = currentVotingSlot + 15000 - Date.now();

            var sleepPromise = new Promise((resolve) => {
               setTimeout(resolve, timeToWait);
            });
            await sleepPromise;
            
            var votes = this.getVotes();
            this.updateValidators({}, {});

            if(votes != undefined && Object.keys(votes).length >= ((Object.keys(validators).length / 2) - 1)) {
               var votedBlock = JSON.parse(blockToVoteOn);

               for(var i = 0; i < Object.keys(votes).length; i++) {
                  votedBlock.validators[Object.keys(votes)[i]] = votes[Object.keys(votes)[i]];
               }
               
               votedBlock.validators[this.bcrypto.hash(this.bcrypto.getPubKey(true))] = blockVoteSignature;
               var broadcastPacket = {queryID:4, unixTimestamp: Date.now(), payload: {block:votedBlock},publicKey:this.bcrypto.getPubKey().toPem()};
               var broadcastPacketCopy = JSON.parse(JSON.stringify(broadcastPacket));
               delete broadcastPacketCopy.queryID;
      
               broadcastPacket.signature = this.bcrypto.sign(JSON.stringify(broadcastPacketCopy));

               this.broadcastToRandomNodes(broadcastPacket);

            }

         }
      } catch (error) {
         //console.log(error);
      }
   }

   async updatePotentialBlock(potentialBlock) {
      this.potentialBlock = potentialBlock;
      //console.log(this.potentialBlock);

      var sleepPromise = new Promise((resolve) => {
         setTimeout(resolve, 15000);
      });
      await sleepPromise;

      this.potentialBlock = {};
   }

   async updateValidators(validators, potentialBlock) {
      this.updatePotentialBlock(potentialBlock);
      this.validators = validators;
      this.signatures = {};
      //console.log(this.potentialBlock);
   }

   getVotes() {
      return this.signatures;
   }

}

module.exports = networking;