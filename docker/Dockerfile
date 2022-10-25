FROM node

MAINTAINER cypher_crypto

RUN git clone https://github.com/CypherCryptoLabs/Cypher
WORKDIR /Cypher

COPY config.json /Cypher/config.json
COPY blockchain.json /Cypher/blockchain.json

RUN cd /Cypher/src && npm i --save
RUN cd /Cypher/setup && npm i --save
RUN cd /Cypher && node /Cypher/setup/setup.js && echo '\n\n\n!!!COPY THE FOLLOWING KEY TO A SECURE LOCATION!!!' && cat private.pem && echo '\n\n\n'

EXPOSE 1234
ENTRYPOINT ["node", "/Cypher/src/main.js"]
