const ellipticcurve = require("starkbank-ecdsa");
const PrivateKey = ellipticcurve.PrivateKey;
const Ecdsa = ellipticcurve.Ecdsa;
const PublicKey = ellipticcurve.PublicKey;
const Signature = ellipticcurve.Signature;
const fs = require("fs");

class bcrypto {

    constructor(privateKeyPath) {
       this.privateKeyPath = privateKeyPath;
       this.privateKey;
       this.publicKey;
       this.generateNewKey();
    }
 
    generateNewKey() {
 
       try {
          if (fs.existsSync("private.pem")) {
             this.privateKey = PrivateKey.fromPem(fs.readFileSync("private.pem").toString());
             this.publicKey = this.privateKey.publicKey();
          } else {
             console.log("Key not found")
 
             this.privateKey = new PrivateKey();
             this.publicKey = this.privateKey.publicKey();
 
             fs.writeFileSync('private.pem', this.privateKey.toPem());
          }
       } catch(err) {
          console.log(err);
       }
    }
 
    static verrifySignature(signatureBase64, publicKeyPEM, packet) {

       let publicKey = PublicKey.fromPem(publicKeyPEM);
       let signature = Signature.fromBase64(signatureBase64);
 
       return Ecdsa.verify(packet, signature, publicKey);
    }
 
    sign(packet) {

       return Ecdsa.sign(packet, this.privateKey).toBase64();
 
    }
 
    getPubKey(asPem = false) {
        if(asPem)
            return this.publicKey.toPem();
        
        return this.publicKey;
    }
 
 }

 module.exports = bcrypto;