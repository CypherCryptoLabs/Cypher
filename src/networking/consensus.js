const BigNumber = require('bignumber.js');

class Consensus {
    constructor(bcrypto, nodeList, netInstance) {
        this.potentialBlock;
        this.forger;
        this._validators;
        this._signatures = {};
        this.bcrypto = bcrypto
        this.nodeList = nodeList
        this.netInstance = netInstance
    }

    get signatures() {
        return this._signatures
    }

    set signatures(obj) {
        this._signatures = obj
    }

    get validators() {
        return this._validators
    }

    set validators(obj) {
        this._validators = obj
    }

    pickValidators(latestBlockHash, nextVotingSlot) {
        var validators = { validators: [], forger: {} };
        var filteredNodeList = this.nodeList.list.filter(obj => obj.registrationTimestamp < nextVotingSlot - 120000)

        let numOfValidators = (filteredNodeList.length - 1 < 128) ? filteredNodeList.length : 128;
        var forgerAproximateAddress = new BigNumber(this.bcrypto.hash(latestBlockHash + nextVotingSlot), 16);


        var forgerAddress = new BigNumber("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", 16);
        var forgerAddressDifference = new BigNumber("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", 16);

        for (var i = 0; i < numOfValidators; i++) {

            var difference = forgerAproximateAddress.minus(filteredNodeList[i].blockchainAddress, 16);
            if (difference.isNegative())
                difference = difference.negated();

            if (difference.lt(forgerAddressDifference)) {
                validators.forger = filteredNodeList[i];
                forgerAddress = new BigNumber(filteredNodeList[i].blockchainAddress, 16);
                forgerAddressDifference = difference;
            }
        }

        var validatorAproximateAddress = forgerAproximateAddress;
        while (validators.validators.length < numOfValidators - 1) {
            validatorAproximateAddress = this.bcrypto.hash(validatorAproximateAddress.toString(16));

            var nodeListCopy = JSON.parse(JSON.stringify(filteredNodeList));
            nodeListCopy.push({ blockchainAddress: validatorAproximateAddress });

            nodeListCopy = nodeListCopy.sort((a, b) => (a.blockchainAddress > b.blockchainAddress) ? 1 : -1);
            var index = nodeListCopy.map(function (e) { return e.blockchainAddress; }).indexOf(validatorAproximateAddress);

            var indexesToAdd = new Array();
            if (index == 0) {
                indexesToAdd.push(index + 1);
            } else if (index == nodeListCopy.length - 1) {
                indexesToAdd.push(index - 1);
            } else {
                indexesToAdd.push(index - 1);
                indexesToAdd.push(index + 1);
            }

            for (var i = 0; i < indexesToAdd.length; i++) {
                if (validators.validators.map(function (e) { return e.blockchainAddress; }).indexOf(nodeListCopy[indexesToAdd[i]].blockchainAddress) == -1 &&
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
        var blockToVoteOnData = await this.netInstance.sendPacket(this.netInstance.createPacket(3, { type: "request" }), forger.ipAddress, forger.port);
        if (blockToVoteOnData == undefined)
            return;

        var blockToVoteOn = JSON.parse(blockToVoteOnData);
        var transactionQueueCopy = JSON.parse(JSON.stringify(transactionQueue));
        transactionQueueCopy.forEach(object => {
            delete object["queryID"];
        });

        if (blockToVoteOn != undefined) {
            blockToVoteOn = JSON.stringify(blockToVoteOn.payload.potentialBlock);

            let blockValidityValue = this.netInstance.blockchain.validateBlock(blockToVoteOn, currentVotingSlot, validators, forger, transactionQueueCopy, this.netInstance.networkDiff.diff);
            if (blockValidityValue == 0) {
                // send signature to Forger
                this.updatePotentialBlock(blockToVoteOn);
                var blockToVoteOnCopy = JSON.parse(blockToVoteOn);
                delete blockToVoteOnCopy.validators;

                var blockVoteSignature = this.bcrypto.sign(JSON.stringify(blockToVoteOnCopy));
                var packetVote = this.netInstance.createPacket(3, { type: "vote", signature: blockVoteSignature });

                for (var i = 0; i < validators.length; i++) {
                    if (validators[i].publicKey != this.bcrypto.getPubKey(true)) {
                        let z = i;
                        this.netInstance.sendPacket(packetVote, validators[z].ipAddress, validators[z].port);
                    }
                }

                var timeToWait = currentVotingSlot + 15000 - Date.now();

                var sleepPromise = new Promise((resolve) => {
                    setTimeout(resolve, timeToWait);
                });
                await sleepPromise;

                var votes = this.signatures;
                this.signatures = {};

                if (votes != undefined && Object.keys(votes).length >= ((Object.keys(validators).length / 2) - 1)) {
                    var votedBlock = JSON.parse(blockToVoteOn);

                    for (var i = 0; i < Object.keys(votes).length; i++) {
                        votedBlock.validators[Object.keys(votes)[i]] = votes[Object.keys(votes)[i]];
                    }

                    votedBlock.validators[this.bcrypto.getFingerprint()] = blockVoteSignature;
                    var broadcastPacket = this.netInstance.createPacket(4, { block: votedBlock });
                    this.netInstance.broadcastToRandomNodes(broadcastPacket);

                }

            } else {
                console.log("Block invalid, validity value is ", blockValidityValue);
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
}

module.exports = Consensus