#!/bin/bash

reset

if [ $1 = "node" ]
then
    gcc ./src/node/main.c -pthread -v -o ./products/node -lcrypto -lz $(mysql_config --libs)
fi

if [ $1 = "test1" ]
then
    gcc ./src/tests/test1.c -o ./tests/test1 -lcrypto -lz $(mysql_config --libs)
fi

if [ $1 = "test2" ]
then
    gcc ./src/tests/test2.c -o ./tests/test2  -lcrypto -lcrypto -lz $(mysql_config --libs)
fi

if [ $1 = "test" ]
then
    #gcc ./src/tests/test.c -o ./tests/test  -lcrypto -lcrypto -lz $(mysql_config --libs)
    gcc ./src/tests/test.c -pthread -o ./tests/test -lcrypto -lz $(mysql_config --libs)
fi

if [ $1 = "all" ]
then
    gcc ./src/tests/test1.c -o ./tests/test1 -lcrypto -lz $(mysql_config --libs)
    gcc ./src/tests/test2.c -o ./tests/test2   -lcrypto -lz $(mysql_config --libs)
    gcc ./src/node/main.c -pthread -o ./products/node -lcrypto -lz $(mysql_config --libs)
    gcc ./src/tests/test.c -o ./tests/test  -lcrypto -lcrypto -lz $(mysql_config --libs)
fi

if [ $1 = "clear" ]
then
    rm -rf ./products/*
fi
