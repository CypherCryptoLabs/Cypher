class NodeList {
    constructor(bcrypto) {
        this.bcrypto = bcrypto
        this.list = []
    }

    loadFrom(source) {
        this.list = source
    }

    add(packet, updateNetworkDiff = true) {
        var newNode = {
            ipAddress: packet.payload.ipAddress,
            port: packet.payload.port,
            publicKey: packet.publicKey,
            blockchainAddress: this.bcrypto.getFingerprint(packet.publicKey)
        };
        var nodeIsAlreadyRegistered = false;
        var nodeIndex = -1;

        for (var i = 0; i < this.list.length && !nodeIsAlreadyRegistered; i++) {
            if (JSON.stringify(this.list[i].publicKey) == JSON.stringify(packet.publicKey)) {
                nodeIsAlreadyRegistered = true;
                nodeIndex = i;
            }
        }

        if (!nodeIsAlreadyRegistered) {
            this.list.push(newNode);
        } else {
            this.list.splice(nodeIndex, 1);
            this.list.push(newNode);
        }

        /*if(updateNetworkDiff)
           this.updateNetworkDiff("register", newNode);*/

    }

    remove(publicKey, updateNetworkDiff = true) {
        for (var i = 0; i < this.list.length; i++) {
            if (this.list[i].publicKey == publicKey) {
                if (updateNetworkDiff)
                    this.updateNetworkDiff("leave", this.list[i]);
                this.list.splice(i, 1);
                break;
            }
        }
    }

    get(index = undefined) {
        if(index != undefined)
            return this.list[index];
        
        return this.list;
    }

    get length() {
        return this.list.length;
    }
}

module.exports = NodeList