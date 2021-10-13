#!/bin/bash
BLOCK_QUEUE_LENGTH=5

echo "running Test script"
printf "generating and sending %d packages...\n" $BLOCK_QUEUE_LENGTH

for i in $(eval echo "{0..$BLOCK_QUEUE_LENGTH}")
do
    printf "generating packet %d...\n" $i
    touch ./.testpackage$i

    echo -e 01 | xxd -r -p >> ./.testpackage$i
    printf '%(%s)T' -1 >> ./.testpackage$i
    hexdump -n 64 -e '16/4 "%08X"' /dev/urandom >> ./.testpackage$i
    hexdump -n 64 -e '16/4 "%08X"' /dev/urandom >> ./.testpackage$i
    hexdump -n 64 -e '16/4 "%08X" 1 "\0"' /dev/urandom >> ./.testpackage$i

    printf "sending packet %d...\n" $i
    netcat -w 1 127.0.0.1 50000 <./.testpackage$i &

    printf "deleting packet %d...\n" $i
    rm ./.testpackage$i
done
