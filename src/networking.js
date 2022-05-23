const net = require('net');
const server = net.createServer();
const crypto = require('crypto');
const BigNumber = require('bignumber.js');
const { resolve } = require('path');
const { type } = require('os');

class networking {

   server = net.createServer();

   constructor(host, port, bcrypto, transactionQueue, stableNode, stableNodePort, blockchain) {
      this.host = host;
      this.port = port;
      this.nodeList = new Array();
      this.stableNode = stableNode;
      this.stableNodePort = stableNodePort;
      this.bcrypto = bcrypto;
      this.transactionQueue = transactionQueue;
      this.registerToNetwork();
      this.potentialBlock;
      this.forger;
      this.validators;
      this.signatures = {};
      this.blockchain = blockchain;
   }

   async checkReachabilityForRandomNodes() {
      while(true) {

         var sleep = new Promise((resolve) => {
            setTimeout(() => {
               resolve();
            }, 60000);
         })

         await sleep;

         var numOfRandomPeers = (numOfRandomPeers > this.nodeList.length) ? this.nodeList.length - 1 : 8;
         for(var i = 0; i < numOfRandomPeers; i++) {
            var randomNodeIndex = Math.floor(Math.random() * (this.nodeList.length));
            var randomNode = this.nodeList[randomNodeIndex];

            if(randomNode.publicKey != this.bcrypto.getPubKey(true) && await this.isReachable(randomNode.ipAddress, randomNode.port) == false) {
               var packet = this.createPacket(6, {type:"report", publicKey:randomNode.publicKey});
               this.broadcastToRandomNodes(packet);
               this.removeNodeFromNodeList(randomNode.publicKey);
            }
         }
      }
   }

   async broadcastToRandomNodes(packet, numOfRandomPeers = -1) {
      if (numOfRandomPeers == -1) {
         numOfRandomPeers = this.nodeList.length;
      } else {
         var numOfRandomPeers = (numOfRandomPeers > this.nodeList.length) ? this.nodeList.length - 1 : 8;
      }
      var notifiedNodes = [this.bcrypto.getFingerprint()];
      var successfullyNotifiedNodes = [this.bcrypto.getFingerprint()];

      while (successfullyNotifiedNodes.length - 1 < numOfRandomPeers && notifiedNodes.length - 1 < this.nodeList.length) {
         var randomNodeIndex = Math.floor(Math.random() * (this.nodeList.length));
         var randomNode = this.nodeList[randomNodeIndex];

         if (notifiedNodes.indexOf(randomNode.blockchainAddress) == -1 && successfullyNotifiedNodes.indexOf(randomNode.blockchainAddress) == -1) {

            if(await this.sendPacket(packet, randomNode.ipAddress, randomNode.port) != undefined) {
               successfullyNotifiedNodes.push(randomNode.blockchainAddress);
            }

            notifiedNodes.push(randomNode.blockchainAddress);
         }

      }
   }

   async syncBlockchain() {
      var syncSuccessful = false;
      var packet = this.createPacket(5, {type: "request", blockHeight:JSON.parse(this.blockchain.getNewestBlock()).id});

      var newBlocks = "";

      while(!syncSuccessful && this.nodeList.length > 1) {
         let randomNodeIndex = Math.floor(Math.random() * (this.nodeList.length));
         if(this.nodeList[randomNodeIndex].publicKey != this.bcrypto.getPubKey().toPem()) {
            newBlocks = await this.sendPacket(packet, this.nodeList[randomNodeIndex].ipAddress, this.nodeList[randomNodeIndex].port);
            if(newBlocks != undefined) {
               
               var blockchainUpdate = JSON.parse(newBlocks).payload.blocks;
               var newestBlock = JSON.stringify(blockchainUpdate[blockchainUpdate.length - 1]);
               var validatePacket = this.createPacket(5, {type: "verification", hash:this.bcrypto.hash(newestBlock)});
               let validationRandomNode = Math.floor(Math.random() * (this.nodeList.length));
               
               if(JSON.parse(await this.sendPacket(validatePacket, this.nodeList[validationRandomNode].ipAddress, this.nodeList[validationRandomNode].port)).payload.status) {

                  if(blockchainUpdate.length > 1) {
                     var syncIsInvalid = false;
                     if(this.bcrypto.hash(this.blockchain.getNewestBlock()) != blockchainUpdate[1].previousBlockHash)
                        syncIsInvalid = true;
                     
                     for(var i = 2; i < blockchainUpdate.length && !syncIsInvalid; i++) {
                        if(this.bcrypto.hash(JSON.stringify(blockchainUpdate[i-1])) != blockchainUpdate[i].previousBlockHash)
                           syncIsInvalid = true;
                     }

                     if(syncIsInvalid)
                        throw "one or more blocks are invalid!";

                     for(var i = 1; i < blockchainUpdate.length; i++) {
                        this.blockchain.appendBlockToBlockchain(blockchainUpdate[i]);
                     }
                  }

                  syncSuccessful = true;
               }

            } else {
               console.log("Could not sync Blockchain. Local Blockchain may be ahead of network!")
               process.exit();
            }
         }
      }
   }

   async registerToNetwork() {
      this.addNodeToNodeList({ payload: { ipAddress: this.host, port: this.port }, publicKey: this.bcrypto.getPubKey(true) });

      var packet = this.createPacket(2, {ipAddress: this.host, port: this.port});
      var response = await this.sendPacket(packet, this.stableNode, this.stableNodePort);

      if(response != undefined) {

         var nodes = JSON.parse(response).payload.nodeList;
         for (var i in nodes) {
            this.addNodeToNodeList({ payload: { ipAddress: nodes[i].ipAddress, port: nodes[i].port }, publicKey: nodes[i].publicKey });
         }

         for (var i = 0; i < this.nodeList.length; i++) {
            await this.sendPacket(packet, this.nodeList[i].ipAddress, this.nodeList[i].port);
         }
      }

      this.syncBlockchain();
   }

   addNodeToNodeList(packet) {
      var newNode = {
         ipAddress: packet.payload.ipAddress,
         port: packet.payload.port,
         publicKey: packet.publicKey,
         blockchainAddress: this.bcrypto.getFingerprint(packet.publicKey)
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

   removeNodeFromNodeList(publicKey) {
      for(var i = 0; i < this.nodeList.length; i++) {
         if(this.nodeList[i].publicKey == publicKey) {
            this.nodeList.splice(i, 1);
            break;
         }
      }
   }

   async isReachable(address, port) {
      let receivedPacket = await this.sendPacket(this.createPacket(6, {}), address, port)
      if(receivedPacket != undefined) {
         var timestamp = JSON.parse(receivedPacket).payload.timestamp;
         if(timestamp <= Date.now() && timestamp >= Date.now() - 60000) {
            return true;
         }

         return false;
      } else {
         return false;
      }
   }

   async isReachableByPublicKey(publicKey) {
      for(var i = 0; i < this.nodeList.length; i++) {
         if(this.nodeList[i].publicKey == publicKey) {
            return await this.isReachable(this.nodeList[i].ipAddress, this.nodeList[i].port);
         }
      }

      return false;
   }

   connectionHandler() {
      this.checkReachabilityForRandomNodes();

      server.listen(this.port, () => {
         console.log(`Node listening on Port ${this.port}`);
      });

      server.on('connection', (socket) => {
         var subroutineHandlesSocket = false;

         socket.on('data', (data) => {
            if (this.verrifyPacket(data.toString())) {
               var packet = JSON.parse(data.toString());
               var payload = {};

               switch (packet.queryID) {
                  case 1:
                     let status = this.transactionQueue.addTransaction(JSON.parse(data.toString()))
                     payload.status = status

                     if (status) {
                        this.broadcastToRandomNodes(data.toString(), 8);
                     }

                     break;
                  case 2:
                     subroutineHandlesSocket = true;
                     this.handleRegistration(socket, packet);
                     break;

                  case 3:
                     if(packet.payload.type == "request")
                        payload.potentialBlock = this.potentialBlock;

                     if(packet.payload.type == "vote") {
                        var blockToVoteOnCopy;
                        if(typeof this.potentialBlock == "string") {
                           blockToVoteOnCopy = JSON.parse(this.potentialBlock);
                        } else if(typeof this.potentialBlock == "object") {
                           blockToVoteOnCopy = JSON.parse(JSON.stringify(this.potentialBlock));
                        }
                        delete blockToVoteOnCopy.validators;

                        var senderIsValidator = false;
                        if(this.validators != undefined && this.validators.hasOwnProperty('length')) {
                           for(var i = 0; i < this.validators.length; i++) {
                              if(packet.publicKey == this.validators[i].publicKey)
                                 senderIsValidator = true;
                           }
                        }

                        if(this.bcrypto.verrifySignature(packet.payload.signature, packet.publicKey, JSON.stringify(blockToVoteOnCopy)) && senderIsValidator) {
                           this.signatures[this.bcrypto.getFingerprint(packet.publicKey)] = packet.payload.signature;
                        }
                     }
                               
                     break;

                  case 4:

                     if(JSON.parse(this.blockchain.getNewestBlock()).id == packet.payload.block.id - 1) {
                        payload.status = true;
                        this.broadcastToRandomNodes(data.toString());

                        if(this.blockchain.addBlockToQueue(packet.payload.block)) {
                           this.blockchain.appendBlockToBlockchain();
                           this.transactionQueue.clean(packet.payload.block.payload);
                        }
                     } else {
                        payload.status = false;
                     }

                     break;
                  case 5:
                        if(packet.payload.type == "request")
                           payload = this.blockchain.getNewestNBlocks(packet.payload.blockHeight);
                        
                        if(packet.payload.type == "verification") {
                           payload.status = (this.bcrypto.hash(JSON.stringify(JSON.parse(this.blockchain.getNewestBlock()))) == packet.payload.hash);
                        }

                     break;
                  case 6:
                     if(JSON.stringify(Object.getOwnPropertyNames(payload)) != JSON.stringify(["type"])) {
                        payload.timestamp = Date.now();
                     } else {
                        /*if(!this.isReachableByPublicKey(payload.publicKey)) {
                           this.removeNodeFromNodeList(payload.publicKey);
                           this.broadcastToRandomNodes(data.toString());
                           payload.status = true;
                        } else {
                           payload.status = false;
                        }*/
                        subroutineHandlesSocket = true;
                        this.handleReachabilityCheck(socket, packet);
                     }
                     break;
               }

               if(!subroutineHandlesSocket) {
                  var answer = this.createPacket(packet.queryID * -1, payload);
                  socket.setTimeout(3000);
                  socket.write(answer);

                  socket.on('timeout', () => {
                     socket.end();
                     socket.destroy();
                  })
               }
            
            } else {
               console.log(data.toString())
            }
            
            if(!subroutineHandlesSocket) {
               socket.end();
               socket.destroy();
            }
         });

         socket.on('error', (err) => {
         });
      });
   }

   async handleReachabilityCheck(socket, packet) {
      var payload = {};

      if(!await this.isReachableByPublicKey(packet.payload.publicKey)) {
         this.removeNodeFromNodeList(packet.payload.publicKey);
         payload.status = true;
      } else {
         payload.status = false;
      }

      var answer = this.createPacket(packet.queryID * -1, payload);
      socket.setTimeout(3000);
      socket.write(answer);

      socket.on('timeout', () => {
         socket.end();
         socket.destroy();
      })

      socket.on('error', (err) => {
         console.log(err)
      });

      if(payload.status)
         this.broadcastToRandomNodes(JSON.stringify(packet));
   }

   async handleRegistration(socket, packet) {
      var payload = {};

      if(await this.isReachable(packet.payload.ipAddress, packet.payload.port)) {
         this.addNodeToNodeList(packet);
         payload.nodeList = this.nodeList;
      } else {
         payload.status = false;
      }

      var answer = this.createPacket(packet.queryID * -1, payload);
      socket.setTimeout(3000);
      socket.write(answer);

      socket.on('timeout', () => {
         socket.end();
         socket.destroy();
      })

      socket.on('error', (err) => {
         console.log(err)
      });
   }

   verrifyPacket(packetJSON) {
      try {
         let packet = JSON.parse(packetJSON);
         var packetCopy = JSON.parse(packetJSON);
         let payload = packet.payload;

         // checking structure
         if(JSON.stringify(Object.getOwnPropertyNames(packet)) != JSON.stringify(["queryID", "unixTimestamp", "payload", "publicKey", "signature"]))
            return false;

         delete packetCopy.queryID;
         delete packetCopy.signature;

         // checking timestamp
         if (packet.unixTimestamp <= Date.now() - 60000 || packet.unixTimestamp >= Date.now())
            return false;

         // checking signature
         if(!this.bcrypto.verrifySignature(packet.signature, packet.publicKey, JSON.stringify(packetCopy)))
            return false;

         // checking data types
         if(isNaN(packet.queryID) || isNaN(packet.unixTimestamp))
            return false;
         
         if(typeof packet.publicKey != "string" || typeof packet.signature != "string" || typeof packet.payload != "object")
            return false;
         
         // checking payload
         switch (packet.queryID) {
            case 1:
               if(JSON.stringify(Object.getOwnPropertyNames(payload)) != JSON.stringify(["blockchainSenderAddress", "blockchainReceiverAddress", "unitsToTransfer", "networkFee"]))
                  return false;

               if(isNaN(payload.unitsToTransfer)||
                  isNaN(payload.networkFee) ||
                  typeof payload.blockchainSenderAddress != "string" ||
                  typeof payload.blockchainReceiverAddress != "string")
                  return false;

               if(payload.unitsToTransfer <= 0 || payload.networkFee <= 0)
                  return false;

               if (payload.blockchainSenderAddress != this.bcrypto.getFingerprint(packet.publicKey))
                  return false;

               if(!/^[0-9a-f]{64}$/.test(payload.blockchainReceiverAddress))
                  return false;
               
               break;
            case -1:
               if(JSON.stringify(Object.getOwnPropertyNames(payload)) != JSON.stringify(["status"]))
                  return false;
               
               if(typeof payload.status != "boolean")
                  return false
               break;
            case 2:
               if(JSON.stringify(Object.getOwnPropertyNames(payload)) != JSON.stringify(["ipAddress", "port"]))
                  return false;

               if(isNaN(payload.port) || payload.port < 0 || payload.port > 65535)
                  return false;

               if (!/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(payload.ipAddress))
                  return false;
               
               break;
            case -2:
               if(JSON.stringify(Object.getOwnPropertyNames(payload)) != JSON.stringify(["status"]) && JSON.stringify(Object.getOwnPropertyNames(payload)) != JSON.stringify(["nodeList"]))
                  return false;
               
               if(payload.status && typeof payload.status != "boolean")
                  return false
               break;
            case 3:
               if((JSON.stringify(Object.getOwnPropertyNames(payload)) == JSON.stringify(["type"]) && payload.type != "request") ||
                  (JSON.stringify(Object.getOwnPropertyNames(payload)) == JSON.stringify(["type", "signature"]) && payload.type != "vote"))
                  return false;

               if(payload.hasOwnProperty("signature") && !/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/.test(payload.signature))
                  return false;

               break;
            case -3:
               if((JSON.stringify(Object.getOwnPropertyNames(payload)) != JSON.stringify(["potentialBlock"]) && payload != {}))
                  return false;
               break;
            case 4:
               if(JSON.stringify(Object.getOwnPropertyNames(payload)) != JSON.stringify(["block"]))
                  return false;

               if(!this.blockchain.validateBlock(JSON.stringify(packet.payload.block), Date.now() - (Date.now() % 60000), this.validators, this.forger, this.transactionQueue.getQueue()))
                  return false;

               var blockValidators = Object.keys(packet.payload.block.validators);
               var invalidSignatures = 0;

               var blockCopy = JSON.parse(JSON.stringify(packet.payload.block));
               delete blockCopy.validators;
               blockCopy = JSON.stringify(blockCopy);

               for(var i = 0; i < blockValidators.length; i++) {
                  for(var j = 0; j < this.validators.length; j++) {
                     if(blockValidators[i] == this.validators[j].blockchainAddress) {
                        if(!this.bcrypto.verrifySignature(packet.payload.block.validators[blockValidators[i]], this.validators[j].publicKey, blockCopy))
                           invalidSignatures++;
                     }
                  }
               }

               if(invalidSignatures > blockValidators.length / 2) {
                  return false;
               }

               break;
            case -4:
               if(JSON.stringify(Object.getOwnPropertyNames(payload)) != JSON.stringify(["status"]))
                  return false;
               
               if(typeof payload.status != "boolean")
                  return false;
               break;
            case 5:
               if((JSON.stringify(Object.getOwnPropertyNames(payload)) != JSON.stringify(["type", "blockHeight"]) && payload.type != "request") &&
                  (JSON.stringify(Object.getOwnPropertyNames(payload)) != JSON.stringify(["type", "hash"]) && payload.type != "verification"))
                  return false;

               if(payload.hasOwnProperty("blocHeight") && isNaN(payload.blockHeight) || payload.blockHeight < 0)
                  return false;

               if(payload.hasOwnProperty("hash") && !/^[0-9a-f]{64}$/.test(payload.hash))
                  return false;
               
               break;
            case -5:
               if(JSON.stringify(Object.getOwnPropertyNames(payload)) != JSON.stringify(["status"]) && JSON.stringify(Object.getOwnPropertyNames(payload)) != JSON.stringify(["blocks"]))
                  return false;
            
               if(payload.status && typeof payload.status != "boolean")
                  return false;
               break;
            case 6:
               if(JSON.stringify(Object.getOwnPropertyNames(payload)) != JSON.stringify([]) && JSON.stringify(Object.getOwnPropertyNames(payload)) != JSON.stringify(["type", "publicKey"]))
                  return false;

               if(JSON.stringify(Object.getOwnPropertyNames(payload)) == JSON.stringify(["type", "publicKey"]) && payload.type != "report")
                  return false;
               break;
            case -6:
               if(JSON.stringify(Object.getOwnPropertyNames(payload)) != JSON.stringify(["timestamp"]) && JSON.stringify(Object.getOwnPropertyNames(payload)) != JSON.stringify(["status"]))
                  return false;

               if(JSON.stringify(Object.getOwnPropertyNames(payload)) == JSON.stringify(["timestamp"]) && typeof payload.timestamp != "number")
                  return false
               break;
            default:
               return false;
               break;
         }

         return true;
      } catch (error) {
         console.log(error);
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

      this.validators = validators.validators;
      this.forger = validators.forger;
      
      return validators;

   }

   async voteOnBlock(forger, currentVotingSlot, validators, transactionQueue) {
      var blockToVoteOnData = await this.sendPacket(this.createPacket(3, {type: "request"}), forger.ipAddress, forger.port);
      if(blockToVoteOnData == undefined)
         return;

      var blockToVoteOn = JSON.parse(blockToVoteOnData);
      var transactionQueueCopy = JSON.parse(JSON.stringify(transactionQueue));
      transactionQueueCopy.forEach(object => {
         delete object["queryID"];
      });

      if(blockToVoteOn != undefined) {
         blockToVoteOn = JSON.stringify(blockToVoteOn.payload.potentialBlock);

         if (this.blockchain.validateBlock(blockToVoteOn, currentVotingSlot, validators, forger, transactionQueueCopy)) {
            // send signature to Forger
            this.updatePotentialBlock(blockToVoteOn);
            var blockToVoteOnCopy = JSON.parse(blockToVoteOn);
            delete blockToVoteOnCopy.validators;

            var blockVoteSignature = this.bcrypto.sign(JSON.stringify(blockToVoteOnCopy));
            var packetVote = this.createPacket(3, {type: "vote", signature: blockVoteSignature});

            for(var i = 0; i < validators.length; i++) {
               if(validators[i].publicKey != this.bcrypto.getPubKey(true)) {
                  let z = i;
                  this.sendPacket(packetVote, validators[z].ipAddress, validators[z].port, false);
               }
            }

            var timeToWait = currentVotingSlot + 15000 - Date.now();

            var sleepPromise = new Promise((resolve) => {
               setTimeout(resolve, timeToWait);
            });
            await sleepPromise;
            
            var votes = this.signatures;
            this.signatures = {};

            if(votes != undefined && Object.keys(votes).length >= ((Object.keys(validators).length / 2) - 1)) {
               var votedBlock = JSON.parse(blockToVoteOn);

               for(var i = 0; i < Object.keys(votes).length; i++) {
                  votedBlock.validators[Object.keys(votes)[i]] = votes[Object.keys(votes)[i]];
               }
               
               votedBlock.validators[this.bcrypto.getFingerprint()] = blockVoteSignature;
               var broadcastPacket = this.createPacket(4, {block:votedBlock});
               this.broadcastToRandomNodes(broadcastPacket);

            }

         }
      }
   }

   async updatePotentialBlock(potentialBlock) {
      this.potentialBlock = potentialBlock;

      var sleepPromise = new Promise((resolve) => {
         setTimeout(resolve, 15000);
      });
      await sleepPromise;

      this.potentialBlock = {};
   }

   getVotes() {
      return this.signatures;
   }

   createPacket(queryID, payload) {
      var packet = {
         queryID:queryID, 
         unixTimestamp: Date.now(),
         payload:payload, 
         publicKey: this.bcrypto.getPubKey().toPem()
      };

      var packetCopy = JSON.parse(JSON.stringify(packet));
      delete packetCopy.queryID;
      packet.signature = this.bcrypto.sign(JSON.stringify(packetCopy));

      return JSON.stringify(packet);
   }

   async sendPacket(packet, ipAddress, port, waitForAnswer = true) {
      let socket = new net.Socket();
      socket.setTimeout(3000);
      var response;
      var receivedResponsePromise = new Promise(function (resolve, reject) {
         socket.connect(port, ipAddress, () => {
            socket.write(packet);
         })

         socket.on('data', (data) => {
            response = data.toString();
            socket.destroy();
            resolve();
         })

         socket.on('error', (error) => {
            console.log(error);
            socket.destroy();
            reject();
         })

         socket.on('timeout', () => {
            socket.destroy();
            reject();
         })
      })

      if(waitForAnswer) {
         try {
            await receivedResponsePromise;
            if(this.verrifyPacket(response)) {
               return response;
            } else {
               return;
            }
         } catch (error) {
            return;
         }
      } else {
         return;
      }

   }

}

module.exports = networking;
