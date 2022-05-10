FROM node

MAINTAINER cypher_crypto

RUN git clone https://github.com/michelbarnich/cypher
WORKDIR /cypher

RUN cd /cypher/src && npm i --save && cd /cypher

COPY config.json /cypher/config.json
COPY blockchain.json /cypher/blockchain.json
#CMD ["bash"]

EXPOSE 1234
ENTRYPOINT ["node", "/cypher/src/main.js"]
