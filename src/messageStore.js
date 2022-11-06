const fs = require("fs");
const { inherits } = require("util");

class messageStore {

    constructor() {
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
            sender: messagePacket.payload.blockchainSenderAddress,
            signature: messagePacket.signature
        }

        try {
            var store;
            if(fs.existsSync("./message_store/" + messagePacket.payload.blockchainReceiverAddress + ".json")) {
                store = JSON.parse(fs.readFileSync("./message_store/" + messagePacket.payload.blockchainReceiverAddress + ".json"))
            } else {
                store = new Array();
            }

            store.push(message);

            fs.writeFileSync("./message_store/" + messagePacket.payload.blockchainReceiverAddress + ".json", JSON.stringify(store));

            return true;
        } catch(_) {
            return false;
        }

    }

}

module.exports = messageStore;