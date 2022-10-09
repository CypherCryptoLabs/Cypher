class NodeList {
    constructor(bcrypto, netInstance) {
        this.bcrypto = bcrypto
        this.netInstance = netInstance
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
            blockchainAddress: this.bcrypto.getFingerprint(packet.publicKey),
            registrationTimestamp: packet.unixTimestamp
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
           this.netInstance.update("register", newNode);*/

    }

    remove(publicKey, updateNetworkDiff = true) {
        for (var i = 0; i < this.list.length; i++) {
            if (this.list[i].publicKey == publicKey) {
                if (updateNetworkDiff)
                    this.netInstance.networkDiff.update("leave", this.list[i]);
                this.list.splice(i, 1);
            }
        }
    }

    get(index = undefined) {
        if(index != undefined)
            return this.list[index];
        
        return this.list;
    }

    getByPublicKey(key) {
        return JSON.parse(JSON.stringify(this.list)).map(function(e) { return e.publicKey; }).indexOf(key);
    }

    get length() {
        try {
            return this.list.length;
        } catch (_) {
            return 0
        }
    }
}

module.exports = NodeList