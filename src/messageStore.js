const fs = require("fs");
const { inherits } = require("util");

class messageStore {

    constructor(bcrypto) {
        this.bcrypto = bcrypto;
        this.init()
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

    retrieve(receiverAddress) {
        try {
            let messageStoreForAddress = fs.readFileSync("./message_store/" + receiverAddress + ".json").toString("utf-8");
            let messages = JSON.parse(messageStoreForAddress);

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
            signature: messagePacket.signature
        }
        
        let messageHash = this.bcrypto.hash(JSON.stringify(message))
        console.log(messageHash)

        try {
            var store;
            if(fs.existsSync("./message_store/" + messagePacket.payload.blockchainReceiverAddress + ".json")) {
                store = JSON.parse(fs.readFileSync("./message_store/" + messagePacket.payload.blockchainReceiverAddress + ".json"))
            } else {
                store = {};
            }

            store[messageHash] = message;

            fs.writeFileSync("./message_store/" + messagePacket.payload.blockchainReceiverAddress + ".json", JSON.stringify(store));

            return true;
        } catch(_) {
            return false;
        }

    }

}

module.exports = messageStore;