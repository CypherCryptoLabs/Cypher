#!/bin/bash

reset

if [ $1 = "node" ]
then
    gcc ./src/node/main.c -pthread -v -o ./products/node -lcrypto -lz $(mysql_config --libs)
fi

if [ $1 = "client" ]
then
    gcc ./src/client/main.c -o ./products/client
fi

if [ $1 = "all" ]
then
    gcc ./src/client/main.c -o ./products/client
    gcc ./src/node/main.c -pthread -o ./products/node -lcrypto -lz $(mysql_config --libs)
fi

if [ $1 = "clear" ]
then
    rm -rf ./products/client ./products/node
fi
