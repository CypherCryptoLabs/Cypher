const fs = require("fs");
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
        this.por;
        this.init();
        this.votingSlotPoRList = [];
    }

    init() {
        try {
            if (!fs.existsSync("./por_store.json")) {
                fs.writeFileSync("./por_store.json", "{}")
                this.por = {};
            } else {
                this.por = JSON.parse(fs.readFileSync("./por_store.json").toString("utf-8"))
            }
        } catch (error) {
            console.log("Could not create PoR store: " + error)
            process.exit();
        }
    }

    storePor(por) {
        this.por[por.hash] = por.payload;
        try {
            fs.writeFileSync("./por_store.json", JSON.stringify(this.por));
        } catch (error) {
            console.log("Could not write to PoR store: " + error)
            process.exit();
        }
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

    pickWinnerPoR(latestBlockHash, nextVotingSlot) {
        var seedAddress = new BigNumber(this.bcrypto.hash(latestBlockHash + nextVotingSlot), 16);

        if (this.votingSlotPoRList.length > 1) {
            var sortedPoRList = JSON.parse(JSON.stringify(this.votingSlotPoRList))
            sortedPoRList.push({ hash: seedAddress.toString(16) })
            sortedPoRList = sortedPoRList.sort((a, b) => {
                let bigNumA = new BigNumber(a.hash, 16)
                let bigNumB = new BigNumber(b.hash, 16)

                if(bigNumA.isGreaterThanOrEqualTo(bigNumB)) {
                    return 1;
                } else {
                    return -1
                }
            })

            let indexOfFakePoR = sortedPoRList.map(function (e) { return e.hash }).indexOf(seedAddress.toString(16));

            if (indexOfFakePoR == 0) {
                return sortedPoRList[1]
            } else if (indexOfFakePoR == sortedPoRList.length - 1) {
                return sortedPoRList[indexOfFakePoR - 1]
            } else {
                var differenceSmallerHash = seedAddress.minus(sortedPoRList[indexOfFakePoR - 1].hash, 16);
                var differenceBiggerHash = seedAddress.minus(sortedPoRList[indexOfFakePoR + 1].hash, 16).negated;

                if(new BigNumber(differenceBiggerHash.toString(16), 16).lt(new BigNumber(differenceSmallerHash).toString(16), 16)) {
                    return sortedPoRList[indexOfFakePoR + 1]
                } else {
                    return sortedPoRList[indexOfFakePoR - 1]
                }

            }

        } else {
            return this.votingSlotPoRList[0]
        }
    }

    pickValidators(latestBlockHash, nextVotingSlot) {
        var validators = [];
        var filteredNodeList = this.nodeList.list.filter(obj => obj.registrationTimestamp < nextVotingSlot - 120000).sort((a, b) => b.registrationTimestamp - a.registrationTimestamp)
        let numOfValidators = 128;
        var seedAddress = new BigNumber(this.bcrypto.hash(latestBlockHash + nextVotingSlot), 16);
        var forgerAddress = new BigNumber("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", 16);
        var forgerAddressDifference = new BigNumber("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", 16);

        if (filteredNodeList.length < numOfValidators) {
            return filteredNodeList;
        } else {

            for (var i = 0; i < numOfValidators; i++) {

                var difference = seedAddress.minus(filteredNodeList[i].blockchainAddress, 16);
                if (difference.isNegative())
                    difference = difference.negated();

                if (difference.lt(forgerAddressDifference)) {
                    validators.forger = filteredNodeList[i];
                    forgerAddress = new BigNumber(filteredNodeList[i].blockchainAddress, 16);
                    forgerAddressDifference = difference;
                }
            }

            var validatorAproximateAddress = seedAddress;
            while (validators.length < numOfValidators - 1) {
                validatorAproximateAddress = this.bcrypto.hash(validatorAproximateAddress.toString(16) + nextVotingSlot);

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
                    if (validators.map(function (e) { return e.blockchainAddress; }).indexOf(nodeListCopy[indexesToAdd[i]].blockchainAddress) == -1) {
                        validators.push(nodeListCopy[indexesToAdd[i]]);
                    }
                }
            }

            return validators;
        }

    }

    async distributePoR(validators, por) {
        let packet = this.netInstance.createPacket(10, por)

        for (var i = 0; i < validators.length; i++) {
            if (validators[i].publicKey != this.bcrypto.getPubKey(true)) this.netInstance.sendPacket(packet, validators[i].ipAddress, validators[i].port);
        }
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

    pickBestPoR(nextVotingSlot) {
        // find closest PoR to Seed
        // the seed is the SHA265 Hash of lastBlockHash+nextVotingSlot

        let porSeed = new BigNumber(this.bcrypto.hash(this.bcrypto.hash(this.netInstance.blockchain.getNewestBlock(true)) + nextVotingSlot), 16);
        let porList = Object.keys(this.por).sort();
        var bestFittingPoR;

        porList.push(porSeed.toString(16));
        let porSeedIndex = porList.sort().indexOf(porSeed.toString(16));

        if (porList.length == 1) return;

        // find best matching PoR
        if (porSeedIndex == 0) {
            bestFittingPoR = porList[1]
        } else if (porSeedIndex == porList.length - 1) {
            bestFittingPoR = porList[porList.length - 2]
        } else {
            let previousIndexDeviation = porSeed.minus(new BigNumber(porList[porSeedIndex - 1], 16))
            let nextIndexDeviation = porSeed.minus(new BigNumber(porList[porSeedIndex + 1], 16)).negated()

            if (previousIndexDeviation.isLessThanOrEqualTo(nextIndexDeviation)) {
                bestFittingPoR = porList[porSeedIndex - 1];
            } else {
                bestFittingPoR = porList[porSeedIndex + 1];
            }
        }
        return bestFittingPoR;

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