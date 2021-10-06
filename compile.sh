#!/bin/bash

reset

if [ $1 = "node" ]
then
    gcc ./src/node/main.c -pthread -v -o ./products/node -lcrypto -lz $(mysql_config --libs)
fi

if [ $1 = "test1" ]
then
    gcc ./src/client/test1.c -o ./products/test1
fi

if [ $1 = "test2" ]
then
    gcc ./src/client/test2.c -o ./products/test2  -lcrypto
fi

if [ $1 = "all" ]
then
    gcc ./src/client/test1.c -o ./products/test1
    gcc ./src/client/test2.c -o ./products/test2  -lcrypto
    gcc ./src/node/main.c -pthread -o ./products/node -lcrypto -lz $(mysql_config --libs)
fi

if [ $1 = "clear" ]
then
    rm -rf ./products/client ./products/node
fi
