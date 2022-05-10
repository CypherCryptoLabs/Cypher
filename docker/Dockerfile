FROM node

MAINTAINER cypher_crypto

RUN git clone https://github.com/michelbarnich/cypher
WORKDIR /cypher

RUN cd /cypher/src && npm i --save
RUN cd /cypher/setup && npm i --save
RUN cd /cypher && node /cypher/setup/setup.js && echo '\n\n\n!!!COPY THE FOLLOWING KEY TO A SECURE LOCATION!!!' && cat private.pem && echo '\n\n\n'

COPY config.json /cypher/config.json
COPY blockchain.json /cypher/blockchain.json
#CMD ["bash"]

EXPOSE 1234
ENTRYPOINT ["node", "/cypher/src/main.js"]
