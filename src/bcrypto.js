const ellipticcurve = require("starkbank-ecdsa");
const PrivateKey = ellipticcurve.PrivateKey;
const Ecdsa = ellipticcurve.Ecdsa;
const PublicKey = ellipticcurve.PublicKey;
const Signature = ellipticcurve.Signature;
const fs = require("fs");
const crypto = require('crypto');

class bcrypto {

   constructor(privateKeyPath) {
      this.privateKeyPath = privateKeyPath;
      this.privateKey;
      this.publicKey;
      this.fingerprint;
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

         let pubkeyDER = crypto.createPublicKey(this.publicKey.toPem()).export({ type: 'spki', format: 'der' });
         this.fingerprint = crypto.createHash('sha256').update(pubkeyDER).digest('hex');

      } catch (err) {
         console.log(err);
      }
   }

   verrifySignature(signatureBase64, publicKeyPEM, packet) {

      let publicKey = PublicKey.fromPem(publicKeyPEM);
      let signature = Signature.fromBase64(signatureBase64);

      return Ecdsa.verify(packet, signature, publicKey);
   }

   sign(packet) {

      return Ecdsa.sign(packet, this.privateKey).toBase64();

   }

   getPubKey(asPem = false) {
      if (asPem) {
         return this.publicKey.toPem();
      }

      return this.publicKey;
   }

   getFingerprint(key = undefined) {
      if(key == undefined)
         return this.fingerprint;

      return crypto.createHash('sha256').update(crypto.createPublicKey(key).export({ type: 'spki', format: 'der' })).digest('hex');
   }

   hash(data) {
      return crypto.createHash('sha256').update(data).digest('hex')
   }

}

module.exports = bcrypto;