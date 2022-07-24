
const fs = require('fs');
var ellipticcurve = require("starkbank-ecdsa");

var Ecdsa = ellipticcurve.Ecdsa;
var PrivateKey = ellipticcurve.PrivateKey;

try {
    let privateKey = new PrivateKey();

    fs.writeFileSync('private.pem', privateKey.toPem());
} catch(err) {
    console.log(err);
}