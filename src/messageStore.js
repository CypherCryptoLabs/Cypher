const fs = require("fs");
const { inherits } = require("util");

class messageStore {

    constructor(bcrypto) {
        this.bcrypto = bcrypto;
        this.init()
        this.localNodeAddress = this.bcrypto.getFingerprint();
    }

    init() {
        try {
            if(!fs.existsSync("./message_store/")) {
                fs.mkdirSync("./message_store/")
            }
        } catch(error) {
            console.log("Could not create Message store: " + error)
            process.exit();
        }
    }

    checkIfExists(messageHash, receiverAddress) {
        try {
            let messageStoreForAddress = fs.readFileSync("./message_store/" + receiverAddress + ".json").toString("utf-8");
            let message = JSON.parse(messageStoreForAddress)[messageHash];

            if (message != undefined)
                return true;
            
            return false;
        } catch(_) {
            return false;
        }
    }

    retrieveSpecific(messageHash, receiverAddress) {
        try {
            let messageStoreForAddress = fs.readFileSync("./message_store/" + receiverAddress + ".json").toString("utf-8");
            var message = JSON.parse(messageStoreForAddress)[messageHash];
            message.nodeBlockchainAddress = this.localNodeAddress;

            if (message != undefined)
                return message;
            
            return false;
        } catch(_) {
            return false;
        }
    }

    discardSpecific(messageHash, receiverAddress) {
        try {
            let messageStoreForAddress = fs.readFileSync("./message_store/" + receiverAddress + ".json").toString("utf-8");
            let messages = JSON.parse(messageStoreForAddress);

            delete messages[messageHash]

            fs.writeFileSync("./message_store/" + receiverAddress + ".json", JSON.stringify(messages));
            
            return true;
        } catch(_) {
            return false;
        }
    }

    retrieveAll(receiverAddress) {
        try {
            let messageStoreForAddress = fs.readFileSync("./message_store/" + receiverAddress + ".json").toString("utf-8");
            var messages = JSON.parse(messageStoreForAddress);

            Object.entries(messages).forEach(([key, value]) => {
                messages[key].nodeBlockchainAddress = this.localNodeAddress;
            });

            return messages;
        } catch(_) {
            return undefined;
        }
    }

    store(messagePacket) {
        let message = {
            unixTimestamp: messagePacket.unixTimestamp,
            message: messagePacket.payload.message,
            sender: this.bcrypto.getFingerprint(messagePacket.publicKey),
            signature: messagePacket.signature,
            nodeBlockchainAddress: this.localNodeAddress
        }
        
        let messageHash = this.bcrypto.hash(JSON.stringify(message))

        try {
            var store;
            if(fs.existsSync("./message_store/" + messagePacket.payload.blockchainReceiverAddress + ".json")) {
                store = JSON.parse(fs.readFileSync("./message_store/" + messagePacket.payload.blockchainReceiverAddress + ".json"))
            } else {
                store = {};
            }

            if(Object.keys(store).length >= 30)
                return false;
            
            store[messageHash] = message;

            fs.writeFileSync("./message_store/" + messagePacket.payload.blockchainReceiverAddress + ".json", JSON.stringify(store));

            return true;
        } catch(_) {
            return false;
        }

    }

}

module.exports = messageStore;