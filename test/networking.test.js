const Blockchain = require("../src/blockchain.js");
const TransactionQueue = require("../src/transactionQueue.js");
const BCrypto = require("../src/bcrypto.js");
const Networking = require("../src/networking.js");
const fs = require("fs");

var bcrypto = new BCrypto();
var blockchainInstance = new Blockchain(bcrypto);
var transactionQueue = new TransactionQueue(bcrypto, blockchainInstance);
var netInstance;

beforeAll(() => {
    fs.writeFileSync("config.json", "{\"host\":\"192.168.178.39\",\"port\":1234,\"stableNode\":\"192.168.178.39\",\"stableNodePort\":1235,\"stableNodePubKey\":\"-----BEGINPUBLICKEY-----\\nMFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAE6x9RJRVMnhvYlrPtX7Nt5aDNoQp9gkv0\\nZC7uDgXYEFDwK8vOYjhLIC+VIoGNYtPhS0XWUK9kiJyzCqLdgmiR0g==\\n-----ENDPUBLICKEY-----\\n\"}");
    
    let config = JSON.parse(fs.readFileSync("config.json", "utf-8"));
    netInstance = new Networking(config.host, config.port, bcrypto, transactionQueue, config.stableNode, config.stableNodePort, blockchainInstance, config.stableNodePubKey);
})

test("initialization", () => {
    expect(netInstance.host).toBe("192.168.178.39");
    expect(netInstance.port).toBe(1234);
    expect(netInstance.nodeList).toStrictEqual([]);
    expect(netInstance.stableNodePort).toStrictEqual(1235);
    expect(netInstance.stableNodePubKey).toStrictEqual("-----BEGINPUBLICKEY-----\nMFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAE6x9RJRVMnhvYlrPtX7Nt5aDNoQp9gkv0\nZC7uDgXYEFDwK8vOYjhLIC+VIoGNYtPhS0XWUK9kiJyzCqLdgmiR0g==\n-----ENDPUBLICKEY-----\n");
    expect(netInstance.networkDiff).toStrictEqual({"left": [], "registered": []});
    expect(netInstance.signatures).toStrictEqual({});
})

test("get network Diff", () => {
    netInstance.networkDiff = {test:[]}
    expect(netInstance.getNetworkDiff()).toStrictEqual({test:[]});
})

test("clear Network Diff", ()=>{
    netInstance.clearNetworkDiff();
    expect(netInstance.getNetworkDiff()).toStrictEqual({"left": [], "registered": []});
})

test("update Network Diff", ()=> {
    let node = {publicKey:"test"};
    netInstance.updateNetworkDiff("register", node);

    expect(netInstance.getNetworkDiff()).toStrictEqual({"left": [], "registered": [{publicKey:"test"}]});

    netInstance.updateNetworkDiff("register", node);
    expect(netInstance.getNetworkDiff()).toStrictEqual({"left": [], "registered": [{publicKey:"test"}]});

    netInstance.updateNetworkDiff("leave", node);
    expect(netInstance.getNetworkDiff()).toStrictEqual({"left": [{publicKey:"test"}], "registered": [{publicKey:"test"}]});

    netInstance.updateNetworkDiff("leave", node);
    expect(netInstance.getNetworkDiff()).toStrictEqual({"left": [{publicKey:"test"}], "registered": [{publicKey:"test"}]});
    netInstance.clearNetworkDiff();

})

test("add Node to NodeList", ()=> {
    let node = {
        payload: {
            ipAddress: "192.168.178.123",
            port: 1234
        },
        publicKey: bcrypto.getPubKey(true)
    }

    netInstance.nodeList.add(node, false);
    expect(netInstance.nodeList).toStrictEqual([{"ipAddress":"192.168.178.123","port":1234,"publicKey":"-----BEGIN PUBLIC KEY-----\nMFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAE0eh+AvR+We2qTcRyxHBxMhSZEYGjbeQz\nrhWsrJ6uw3PiwtpEaYOP24QXai23F/DQdWL0GkhRfsdTMyeqr3Kh9A==\n-----END PUBLIC KEY-----\n","blockchainAddress":"30c442f72e92c0ddcd5662ebf399a1e9ea00f8f77fac95b8ac4c4456a2661d47"}])
})

test("remove Node from NodeList", ()=> {
    let node = bcrypto.getPubKey(true)

    netInstance.nodeList.remove(node)
    expect(netInstance.nodeList).toStrictEqual([])
})

test("pick validators", ()=> {
    let nodeList = [
        {blockchainAddress:"97fbf3d86ecbd9aa92ecb4f837241f5a6689438429da05f7e419f1d0ee1a50a132a90e3d720c688815297bb5bebffbf2dd5cf238cc0bdb34513ebbc4461deb33"},
        {blockchainAddress:"7b4be24e7f6d83a849f9fc62e76c246cf8510cc0f66dd47283d4e515ec86f27ebabd1bd9da7c4ec8d33c5c2fcbcb9b849d26bbc1b66110b9a4551638b015c9ca"},
        {blockchainAddress:"13af4e1d958c631e7a391b547106fa9d989a4e53fb1c8d048a554b06293c1e8604daefd7ee781e8d8441c5ae7ebda8d9a4ca71aeb55cab633127c904e73b5424"},
        {blockchainAddress:"3a0aaf2eaa1ae98397785663443d783978dda23377130143e0a583e6215e67c52efa343a9b1a7eddf8afdff29651004b699fb852f280ebf44ce5e81476530955"}
    ]

    netInstance.nodeList = nodeList;

    expect(netInstance.consensus.pickValidators("fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0", 1)).toStrictEqual({"validators":[{"blockchainAddress":"13af4e1d958c631e7a391b547106fa9d989a4e53fb1c8d048a554b06293c1e8604daefd7ee781e8d8441c5ae7ebda8d9a4ca71aeb55cab633127c904e73b5424"},{"blockchainAddress":"3a0aaf2eaa1ae98397785663443d783978dda23377130143e0a583e6215e67c52efa343a9b1a7eddf8afdff29651004b699fb852f280ebf44ce5e81476530955"},{"blockchainAddress":"7b4be24e7f6d83a849f9fc62e76c246cf8510cc0f66dd47283d4e515ec86f27ebabd1bd9da7c4ec8d33c5c2fcbcb9b849d26bbc1b66110b9a4551638b015c9ca"}],"forger":{"blockchainAddress":"97fbf3d86ecbd9aa92ecb4f837241f5a6689438429da05f7e419f1d0ee1a50a132a90e3d720c688815297bb5bebffbf2dd5cf238cc0bdb34513ebbc4461deb33"}})
})

test("get votes", () => {
    expect(netInstance.getVotes()).toStrictEqual({})
})

test("create Packet", ()=> {
    var packet = JSON.parse(netInstance.createPacket(1, {}))
    delete packet.signature;
    delete packet.unixTimestamp;

    expect(packet).toStrictEqual({"queryID":1,"payload":{},"publicKey":"-----BEGIN PUBLIC KEY-----\nMFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAE0eh+AvR+We2qTcRyxHBxMhSZEYGjbeQz\nrhWsrJ6uw3PiwtpEaYOP24QXai23F/DQdWL0GkhRfsdTMyeqr3Kh9A==\n-----END PUBLIC KEY-----\n"});
})

afterAll(() => {
    fs.rmSync("config.json");
})