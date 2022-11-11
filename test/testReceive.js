var net = require('net');
const fs = require('fs');
var crypto = require('crypto');
var ellipticcurve = require("starkbank-ecdsa");

const HOST = '192.168.178.39'; 
const PORT = 1234; 
var client = new net.Socket(); 

var Ecdsa = ellipticcurve.Ecdsa;
var PrivateKey = ellipticcurve.PrivateKey;
// Generate new Keys
var privateKey;
var publicKey;

try {
    if (fs.existsSync("private.pem")) {
        privateKey = PrivateKey.fromPem(fs.readFileSync("private.pem").toString());
        publicKey = privateKey.publicKey();
    } else {
        console.log("Key not found")

        privateKey = new PrivateKey();
        publicKey = privateKey.publicKey();

        fs.writeFileSync('private.pem', privateKey.toPem());
    }
} catch(err) {
    console.log(err);
}

console.log(crypto.createHash('sha256').update(crypto.createPublicKey(publicKey.toPem()).export({ type: 'spki', format: 'der' })).digest('hex'));

function signPacket(packet) {

    // Generate Signature
    let signature = Ecdsa.sign(packet, privateKey);

    // Verify if signature is valid
    if(Ecdsa.verify(packet, signature, publicKey)) {
        return signature
    } else {
        return false
    }
}

var receivedData;
let requestFinished = new Promise((resolve, reject) => {
    client.connect(PORT, HOST, () => { 
        console.log(`client connected to ${HOST}:${PORT}`); 
        // Write a message to the socket as soon as the client is connected, the server will receive it as message from the client  
    
        var createTransactionPacket = {
            queryID : 8,
            unixTimestamp : Date.now(),
            payload : {
                type: "retrieve"
            },
            publicKey : publicKey.toPem(),
            signature : ""
        };
    
        var createTransactionPacketForSignature = JSON.parse(JSON.stringify(createTransactionPacket));
        delete createTransactionPacketForSignature.queryID;
        delete createTransactionPacketForSignature.signature;
    
        var createTransactionPacketJSON = JSON.stringify(createTransactionPacketForSignature);
    
        createTransactionPacket.signature = signPacket(createTransactionPacketJSON).toBase64();
    
        client.write(JSON.stringify(createTransactionPacket)); 
        client.end();
    });
    
    client.on('data', (data) => {     
        receivedData = data.toString("utf8").slice(0, -1);;
        resolve();
        if (data.toString().endsWith('exit')) { 
            client.destroy(); 
        }
    }); 
    
    // Add a 'close' event handler for the client socket 
    client.on('close', () => { 
        console.log('Client closed'); 
    }); 
    
    client.on('error', (err) => { 
        reject();
        console.error(err); 
    }); 
}).then((async () => {
    console.log(`Client received: ${receivedData}`);
    console.log(receivedData.length)
    var receivedMessages = JSON.parse(receivedData).payload;

    let keys = Object.keys(receivedMessages)

    for (var i = 0; i < keys.length; i++) { 
        let key = keys[i];
        var tmpclient = new net.Socket();
        
        let dataTransmitted = new Promise((resolve, reject) => {
            tmpclient.connect(PORT, HOST, () => { 
                console.log(`client connected to ${HOST}:${PORT}`); 
                // Write a message to the socket as soon as the client is connected, the server will receive it as message from the client  
                console.log(key)
                let messageHash = crypto.createHash('sha256').update(JSON.stringify(receivedMessages[key])).digest('hex')
                var createTransactionPacket = {
                    queryID : 9,
                    unixTimestamp : Date.now(),
                    payload : {
                    },
                    publicKey : publicKey.toPem(),
                    signature : ""
                };
                
                createTransactionPacket.payload[messageHash] = signPacket(messageHash).toBase64();
            
                var createTransactionPacketForSignature = JSON.parse(JSON.stringify(createTransactionPacket));
                delete createTransactionPacketForSignature.queryID;
                delete createTransactionPacketForSignature.signature;
            
                var createTransactionPacketJSON = JSON.stringify(createTransactionPacketForSignature);
            
                createTransactionPacket.signature = signPacket(createTransactionPacketJSON).toBase64();
            
                tmpclient.write(JSON.stringify(createTransactionPacket)); 
                tmpclient.end();
            });
            
            tmpclient.on('data', (data) => {     
                console.log(data.toString())
                resolve()
                if (data.toString().endsWith('exit')) { 
                    tmpclient.destroy(); 
                }
            }); 
            
            // Add a 'close' event handler for the client socket 
            tmpclient.on('close', () => { 
                console.log('Client closed'); 
            }); 
            
            tmpclient.on('error', (err) => {
                reject()
                console.error(err); 
            });
        })

        await dataTransmitted;

    }
}))