const net = require('net');
const server = net.createServer();
const BigNumber = require('bignumber.js');
const fs = require("fs");

const NodeList = require("./nodeList")
const Consensus = require("./consensus")
const NetworkDiff = require("./networkDiff")
const MessageStore = require("../messageStore");
const { type } = require('os');

class networking {

   server = net.createServer();

   constructor(host, port, bcrypto, transactionQueue, stableNode, stableNodePort, blockchain, stableNodePubKey) {
      this.host = host;
      this.port = port;
      this.nodeList = new NodeList(bcrypto, this)
      this.consensus = new Consensus(bcrypto, this.nodeList, this)
      this.networkDiff = new NetworkDiff(this)
      this.MessageStore = new MessageStore(bcrypto)
      this.stableNode = stableNode;
      this.stableNodePort = stableNodePort;
      this.stableNodePubKey = stableNodePubKey;
      this.bcrypto = bcrypto;
      this.transactionQueue = transactionQueue;
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
            var randomNode = this.nodeList.get(randomNodeIndex);

            if(randomNode.publicKey != this.bcrypto.getPubKey(true) && await this.isReachable(randomNode.ipAddress, randomNode.port) == false) {
               var packet = this.createPacket(6, {type:"report", publicKey:randomNode.publicKey});
               this.broadcastToRandomNodes(packet);
               this.nodeList.remove(randomNode.publicKey);
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

      while (successfullyNotifiedNodes.length - 1 < numOfRandomPeers && notifiedNodes.length - 1 < this.nodeList.length - 1) {
         var randomNodeIndex = Math.floor(Math.random() * (this.nodeList.length));
         var randomNode = this.nodeList.get(randomNodeIndex);

         if (notifiedNodes.indexOf(randomNode.blockchainAddress) == -1 && successfullyNotifiedNodes.indexOf(randomNode.blockchainAddress) == -1) {

            if(JSON.parse(packet).queryID != 4) {
               if(await this.sendPacket(packet, randomNode.ipAddress, randomNode.port) != undefined) {
                  successfullyNotifiedNodes.push(randomNode.blockchainAddress);
               }
            } else {
               try {
                  this.sendPacket(packet, randomNode.ipAddress, randomNode.port)
               }catch (_) {}
            }

            notifiedNodes.push(randomNode.blockchainAddress);
         }

      }
   }

   async syncBlockchain(randomNode = false) {
      var syncSuccessful = false;
      var packet = this.createPacket(5, {type: "request", blockHeight:JSON.parse(this.blockchain.getNewestBlock()).id});

      var newBlocks = "";

      while(!syncSuccessful && (randomNode || this.nodeList.length > 1)) {
         let randomNodeIndex = Math.floor(Math.random() * (this.nodeList.length));
         if(this.nodeList.get(randomNodeIndex).publicKey != this.bcrypto.getPubKey().toPem()) {
            try {
               if(randomNode) {
                  newBlocks = await this.sendPacket(packet, this.nodeList.get(randomNodeIndex).ipAddress, this.nodeList.get(randomNodeIndex).port);
               } else {
                  newBlocks = await this.sendPacket(packet, this.stableNode, this.stableNodePort);
               }

               if(newBlocks != undefined) {
                  
                  var blockchainUpdate = JSON.parse(newBlocks).payload.blocks;
                  var newestBlock = blockchainUpdate[blockchainUpdate.length - 1];
                  delete newestBlock.validators;
                  newestBlock = JSON.stringify(newestBlock);
                  var validatePacket = this.createPacket(5, {type: "verification", hash:this.bcrypto.hash(newestBlock)});
                  let validationRandomNode = Math.floor(Math.random() * (this.nodeList.length));
                  let validationAnswer = await this.sendPacket(validatePacket, this.nodeList.get(validationRandomNode).ipAddress, this.nodeList.get(validationRandomNode).port);

                  if(JSON.parse(validationAnswer).payload.status) {
                     if(blockchainUpdate.length > 1) {
                        var syncIsInvalid = false;
                        if(this.bcrypto.hash(this.blockchain.getNewestBlock(true)) != blockchainUpdate[1].previousBlockHash)
                           syncIsInvalid = true;
                        
                        for(var i = 2; i < blockchainUpdate.length && !syncIsInvalid; i++) {
                           delete blockchainUpdate[i-1].validators;
                           if(this.bcrypto.hash(JSON.stringify(blockchainUpdate[i-1])) != blockchainUpdate[i].previousBlockHash)
                              syncIsInvalid = true;
                        }

                        if(syncIsInvalid)
                           throw "one or more blocks are invalid!";

                        for(var i = 1; i < blockchainUpdate.length; i++) {
                           this.blockchain.appendBlockToBlockchain(this, blockchainUpdate[i]);
                        }
                     }

                     syncSuccessful = true;
                  } else {
                     console.log("Could not sync Blockchain. Local Blockchain may be ahead of network!")
                     process.exit();
                  }

               } else {
                  console.log("Could not sync Blockchain. Node is offline or send faulty packet!")
                  break;
               }
            } catch (error) {
               console.log(error)
            }
         }
      }
   }

   async syncTransactionQueue(randomNode = false) {
      var packet = this.createPacket(7, {});
      var transactionQueue;
      if(!randomNode){
         transactionQueue = await this.sendPacket(packet, this.stableNode, this.stableNodePort);
      } else {
         let nodePool = JSON.parse(JSON.stringify(this.nodeList.get()));
         for(var i in nodePool) {
            if(nodePool[i].publicKey == this.stableNodePubKey) nodePool.splice(i, 1);
         }

         let randomNodeIndex = Math.floor(Math.random() * (nodePool.length));
         transactionQueue = await this.sendPacket(packet, nodePool[randomNodeIndex].ipAddress, nodePool[randomNodeIndex].port);
      }

      if(transactionQueue == undefined) {
         console.log("Could not sync transaction Queue!")
         //process.exit(2);
         return
      }
      
      transactionQueue = JSON.parse(transactionQueue).payload.queue;

      for(var i = 0; i < transactionQueue.length; i++) {
         if(this.verrifyPacket(JSON.stringify(transactionQueue[i]), false)) 
            this.transactionQueue.addTransaction(transactionQueue[i])
      }
   }

   async registerToNetwork() {
      var cache;
      var packet = this.createPacket(2, {ipAddress: this.host, port: this.port});
      let registrationTimestamp = JSON.parse(packet).unixTimestamp
      this.nodeList.add({ unixTimestamp: registrationTimestamp, payload: { ipAddress: this.host, port: this.port }, publicKey: this.bcrypto.getPubKey(true) });
      this.nodeList.add({ unixTimestamp: registrationTimestamp, payload: { ipAddress: this.stableNode, port: this.stableNodePort }, publicKey: this.stableNodePubKey }, false);

      if(fs.existsSync("network_cache.json")) {
         cache = JSON.parse(fs.readFileSync("network_cache.json").toString());
      } else {
         cache = this.blockchain.generateNodeList();
         fs.writeFileSync("network_cache.json", JSON.stringify(cache));
      }

      /*for(var i in cache.nodeList) {
         this.nodeList.add({ payload: { ipAddress: cache.nodeList[i].ipAddress, port: cache.nodeList[i].port }, publicKey: cache.nodeList[i].publicKey }, false);
      }*/

      var randomMode = false;
      if(!fs.existsSync("blockchain.json")) process.exit(1);
      /*if(await this.isReachable(this.stableNode, this.stableNodePort)) {
         await this.syncBlockchain();
      } else {
         console.log("Stable Node is not reachable, continuing with random Node. This may not be as secure!");
         await this.syncBlockchain(true);
         randomMode = true;
      }*/

      await this.syncBlockchain();
      var networkDiff;

      if(!randomMode) {
         let data = await this.sendPacket(packet, this.stableNode, this.stableNodePort);
         //if(data != undefined) networkDiff = JSON.parse(data).payload.nodeList;
         if(data != undefined) {
            let payload = JSON.parse(data).payload;
            if(payload.status != undefined && payload.status == false) {
               console.log("Node refused registration! Maybe you just recently left the network?")
               process.exit();
            }

            this.nodeList.loadFrom(JSON.parse(data).payload.nodeList)
         }
      } else {
         var receivedSuccessfully = false;
         for(var i = 0; i < this.nodeList.length && !receivedSuccessfully; i++) {
            if(this.nodeList.get(i).publicKey != this.bcrypto.getPubKey(true)) {
               let data = await this.sendPacket(packet, this.nodeList.get(i).ipAddress, this.nodeList.get(i).port);
               //if(data != undefined) networkDiff = JSON.parse(data).payload.nodeList;
               if(data != undefined) this.nodeList.loadFrom(JSON.parse(data).payload.nodeList)
            }

            if(networkDiff != undefined) receivedSuccessfully = true;;
         }
      }

      if(networkDiff != undefined) {
         for(var i in networkDiff.registered) {
            let node = networkDiff.registered[i];
            this.nodeList.add({ payload: { ipAddress: node.ipAddress, port: node.port }, publicKey: node.publicKey });
         }

         for(var i in networkDiff.left) {
            let node = networkDiff.registered[i];
            this.nodeList.remove(node.publicKey)
         }
      }

      /*for (var i = 0; i < this.nodeList.length; i++) {
         if(this.nodeList.get(i).publicKey != this.bcrypto.getPubKey(true) && (!randomMode && this.nodeList.get(i).publicKey != this.stableNodePubKey)){
            await this.sendPacket(packet, this.nodeList.get(i).ipAddress, this.nodeList.get(i).port);
         }
      }*/

      await this.syncTransactionQueue(randomMode);
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
         if(this.nodeList.get(i).publicKey == publicKey) {
            return await this.isReachable(this.nodeList.get(i).ipAddress, this.nodeList.get(i).port);
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
                        payload.potentialBlock = this.consensus.potentialBlock;

                     if(packet.payload.type == "vote") {
                        var blockToVoteOnCopy;
                        if(typeof this.consensus.potentialBlock == "string") {
                           blockToVoteOnCopy = JSON.parse(this.consensus.potentialBlock);
                        } else if(typeof this.consensus.potentialBlock == "object") {
                           blockToVoteOnCopy = JSON.parse(JSON.stringify(this.consensus.potentialBlock));
                        }

                        if(blockToVoteOnCopy == undefined) break;
                        delete blockToVoteOnCopy.validators;

                        var senderIsValidator = false;
                        if(this.consensus.validators != undefined && this.consensus.validators.hasOwnProperty('length')) {
                           for(var i = 0; i < this.consensus.validators.length; i++) {
                              if(packet.publicKey == this.consensus.validators[i].publicKey)
                                 senderIsValidator = true;
                           }
                        }

                        if(this.bcrypto.verrifySignature(packet.payload.signature, packet.publicKey, JSON.stringify(blockToVoteOnCopy)) && senderIsValidator) {
                           this.consensus.signatures[this.bcrypto.getFingerprint(packet.publicKey)] = packet.payload.signature;
                        }
                     }
                               
                     break;

                  case 4:

                     if(JSON.parse(this.blockchain.getNewestBlock()).id == packet.payload.block.id - 1) {
                        payload.status = true;

                        if(this.blockchain.addBlockToQueue(packet.payload.block)) {
                           this.broadcastToRandomNodes(data.toString());
                           this.blockchain.appendBlockToBlockchain(this);
                           this.transactionQueue.clean(packet.payload.block.payload);
                           this.networkDiff.clear();

                           console.log("(Block announcement) Block " + packet.payload.block.id + " appended to Blockchain.")
                        }
                     } else {
                        payload.status = false;
                     }

                     break;
                  case 5:
                        if(packet.payload.type == "request")
                           payload = this.blockchain.getNewestNBlocks(packet.payload.blockHeight);
                        
                        if(packet.payload.type == "verification") {
                           payload.status = (this.bcrypto.hash(JSON.stringify(JSON.parse(this.blockchain.getNewestBlock(true)))) == packet.payload.hash);
                        }

                     break;
                  case 6:
                     if(JSON.stringify(Object.getOwnPropertyNames(payload)) != JSON.stringify(["type"])) {
                        payload.timestamp = Date.now();
                     } else {
                        /*if(!this.isReachableByPublicKey(payload.publicKey)) {
                           this.nodeList.remove(payload.publicKey);
                           this.broadcastToRandomNodes(data.toString());
                           payload.status = true;
                        } else {
                           payload.status = false;
                        }*/
                        subroutineHandlesSocket = true;
                        this.handleReachabilityCheck(socket, packet);
                     }
                     break;
                  case 7:
                     var queue = this.transactionQueue.getQueue();

                     for(var i = 0; i < queue.length; i++) {
                        var transaction = queue[i];
                        var rebuiltTx = {
                           queryID: 1, 
                           unixTimestamp: transaction.unixTimestamp,
                           payload: transaction.payload,
                           publicKey: transaction.publicKey,
                           signature: transaction.signature
                        }

                        queue[i] = rebuiltTx
                     }

                     payload.queue = queue;
                     break;

                  case 8:
                     if(packet.payload.type == "send") {
                        payload.status = this.MessageStore.store(packet);
                     } else if(packet.payload.type == "retrieve") {
                        payload = this.MessageStore.retrieveAll(this.bcrypto.getFingerprint(packet.publicKey))
                     }
                     break;
                  
                  case 9:
                     let messageHash = Object.keys(packet.payload)[0]
                     this.MessageStore.checkIfExists(messageHash, this.bcrypto.getFingerprint(packet.publicKey))

                     payload.status = this.MessageStore.checkIfExists(messageHash, this.bcrypto.getFingerprint(packet.publicKey))

                     let por = {
                        hash: messageHash,
                        payload: this.MessageStore.retrieveSpecific(messageHash, this.bcrypto.getFingerprint(packet.publicKey))
                     }

                     por.payload.blockchainReceiverAddress = this.bcrypto.getFingerprint(packet.publicKey);
                     por.payload.blockchainReceiverPubKey = packet.publicKey;
                     por.payload.por = packet.payload[messageHash]

                     this.consensus.storePor(por);
                     this.MessageStore.discardSpecific(messageHash, this.bcrypto.getFingerprint(packet.publicKey))

                     break;
               }

               if(!subroutineHandlesSocket) {
                  var answer = this.createPacket(packet.queryID * -1, payload);
                  socket.setTimeout(3000);
                  socket.write(answer + Buffer.from([0x00]).toString("utf8"));

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
         this.nodeList.remove(packet.payload.publicKey);
         this.broadcastToRandomNodes(JSON.stringify(packet));
         payload.status = true;
      } else {
         payload.status = false;
      }

      var answer = this.createPacket(packet.queryID * -1, payload);
      socket.setTimeout(3000);
      socket.write(answer + Buffer.from([0x00]).toString("utf8"));

      socket.on('timeout', () => {
         socket.end();
         socket.destroy();
      })

      socket.on('error', (err) => {
         console.log(err)
      });
   }

   async handleRegistration(socket, packet) {
      var payload = {};

      if( await this.isReachable(packet.payload.ipAddress, packet.payload.port)) {
         if(this.nodeList.getByPublicKey(packet.publicKey) == -1) {
            this.nodeList.add(packet);
            this.broadcastToRandomNodes(JSON.stringify(packet), 8)
            payload.nodeList = this.nodeList.get();
         } else {
            payload.status = false;
         }


      } else {
         payload.status = false;
      }

      var answer = this.createPacket(packet.queryID * -1, payload);
      socket.setTimeout(3000);
      socket.write(answer + Buffer.from([0x00]).toString("utf8"));

      socket.on('timeout', () => {
         socket.end();
         socket.destroy();
      })

      socket.on('error', (err) => {
         console.log(err)
      });
   }

   verrifyPacket(packetJSON, checkTimestamp = true, checkSignature = true) {
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
         if (checkTimestamp && (packet.unixTimestamp <= Date.now() - 60000 || packet.unixTimestamp >= Date.now() + 10000))
            return false;

         // checking signature
         if(checkSignature && !this.bcrypto.verrifySignature(packet.signature, packet.publicKey, JSON.stringify(packetCopy)))
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

               /*if(JSON.stringify(Object.getOwnPropertyNames(payload.nodeList)) != JSON.stringify(["registered", "left"]))
                  return false;

               for(var i in payload.nodeList.registered) {
                  let entry = payload.nodeList.registered[i];

                  if(JSON.stringify(Object.getOwnPropertyNames(entry)) != JSON.stringify(["ipAddress", "port", "publicKey", "blockchainAddress"]))
                     return false

                  if(isNaN(entry.port) || entry.port < 0 || entry.port > 65535)
                     return false;
   
                  if (!/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(entry.ipAddress))
                     return false;

               }

               for(var i in payload.nodeList.left) {
                  let entry = payload.nodeList.left[i];

                  if(JSON.stringify(Object.getOwnPropertyNames(entry)) != JSON.stringify(["ipAddress", "port", "publicKey", "blockchainAddress"]))
                     return false

                  if(isNaN(entry.port) || entry.port < 0 || entry.port > 65535)
                     return false;
   
                  if (!/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(entry.ipAddress))
                     return false;

               }*/

               for(var i in payload.nodeList) {
                  let entry = payload.nodeList[i];
                  if(JSON.stringify(Object.getOwnPropertyNames(entry)) != JSON.stringify(["ipAddress", "port", "publicKey", "blockchainAddress", "registrationTimestamp"]))
                     return false

                  if(isNaN(entry.port) || entry.port < 0 || entry.port > 65535)
                     return false;
   
                  if (!/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(entry.ipAddress))
                     return false;

               }
               
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

               let validatorsAndForger = this.consensus.pickValidators(this.bcrypto.hash(this.blockchain.getNewestBlock(true)), Date.now() - (Date.now() % 60000));

               let blockValidityValue = this.blockchain.validateBlock(JSON.stringify(packet.payload.block), Date.now() - (Date.now() % 60000), validatorsAndForger.validators, validatorsAndForger.forger, this.transactionQueue.getQueue(), this.networkDiff.diff)
               if(blockValidityValue != 0) {
                  console.log("(Block announcement) Block invalid, validity value is ", blockValidityValue)
                  return false;
               }

               var blockValidators = Object.keys(packet.payload.block.validators);
               var invalidSignatures = 0;

               var blockCopy = JSON.parse(JSON.stringify(packet.payload.block));
               delete blockCopy.validators;
               blockCopy = JSON.stringify(blockCopy);

               for(var i = 0; i < blockValidators.length; i++) {
                  for(var j = 0; j < this.consensus.validators.length; j++) {
                     if(blockValidators[i] == this.consensus.validators[j].blockchainAddress) {
                        try {
                           if(!this.bcrypto.verrifySignature(packet.payload.block.validators[blockValidators[i]], this.consensus.validators[j].publicKey, blockCopy))
                              invalidSignatures++;
                        } catch(_) {
                           invalidSignatures++;
                        }
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
            case 7:
               if(JSON.stringify(Object.getOwnPropertyNames(payload)) != JSON.stringify([]))
                  return false;
               break;
            case -7:
               // no checks needed since each received transaction will be chacked later on anyways
               break;
            case 8:
               if(!payload.hasOwnProperty("type"))
                  return false;

               if(payload.type == "send") {
                  if(JSON.stringify(Object.getOwnPropertyNames(payload)) != JSON.stringify(["type","blockchainReceiverAddress","message"]))
                     return false;

                  if(
                     typeof payload.type != "string" ||
                     typeof payload.blockchainReceiverAddress != "string" ||
                     typeof payload.message != "string"
                  ) return false;

                  if(!/^[0-9a-f]{64}$/.test(payload.blockchainReceiverAddress))
                  return false;

               } else if(payload.type == "retrieve") {
                  if(JSON.stringify(Object.getOwnPropertyNames(payload)) != JSON.stringify(["type"]))
                     return false;
               } else {
                  return false;
               }
               
               break;
            case 9:
               let messageHashes = Object.keys(payload);

               for(var i = 0; i < messageHashes.length; i++) {
                  if(!/^[0-9a-f]{64}$/.test(messageHashes[i]))
                     return false;

                  if(!this.bcrypto.verrifySignature(payload[messageHashes[i]], packet.publicKey, messageHashes[i]))
                     return false;
               }

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
      var response = "";
      var receivedResponsePromise = new Promise(function (resolve, reject) {
         socket.connect(port, ipAddress, () => {
            socket.write(packet);
         })

         socket.on('data', (data) => {
            response += data.toString();
            if(response.slice(-1) ==  Buffer.from([0x00]).toString("utf-8")) {
               response = response.slice(0, -1);
               socket.destroy();
               resolve();
            }
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