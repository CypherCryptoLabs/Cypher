class NetworkDiff {
    constructor(netInstance) {
        this.netInstance = netInstance;
        this.diff = {registered:[], left:[]};
    }

    get diff() {
        return JSON.parse(JSON.stringify(this._diff));
    }

    set diff(obj) {
        this._diff = obj;
    }

    clear() {
        this.diff = { registered: [], left: [] };
    }

    update(mode, node) {
        return;

        var nodeAlreadyInDiff = false;

        if (mode == "register") {
            for (var i = 0; i < this.diff.registered.length; i++) {
                if (this.diff.registered[i].publicKey == node.publicKey) {
                    nodeAlreadyInDiff = true;
                    break;
                }
            }

            if (!nodeAlreadyInDiff)
                this.diff.registered.push(node);
        } else if (mode == "leave") {
            for (var i = 0; i < this.diff.left.length; i++) {
                if (this.diff.left[i].publicKey == node.publicKey) {
                    nodeAlreadyInDiff = true;
                    break;
                }
            }

            if (!nodeAlreadyInDiff)
                this.diff.left.push(node);
        }
    }

    updateNetworkCache(block) {
        var cache = { blockHeight: block.id, nodeList: JSON.parse(JSON.stringify(this.netInstance.nodeList.get())) };

        for (var i = 0; i < block.diff.registered.length; i++) {
            let node = block.diff.registered[i];
            var nodeIndex = -1;
            for (var j = 0; j < cache.nodeList.length; j++) {
                if (node.publicKey == cache.nodeList[j].publicKey) {
                    nodeAlreadyRegistered = j;
                    cache.nodeList.splice(j, 1);
                    cache.nodeList.push(node);
                    break;
                }
            }

            if (nodeIndex == -1) cache.nodeList.push(node);
        }

        for (var i = 0; i < block.diff.registered.length; i++) {
            let node = block.diff.registered[i];
            for (var j = 0; j < cache.nodeList.length; j++) {
                if (node.publicKey == cache.nodeList[j].publicKey) {
                    cache.nodeList.splice(j, 1);
                    break;
                }
            }
        }

        fs.writeFileSync("network_cache.json", JSON.stringify(cache));

    }
}

module.exports = NetworkDiff