#define BLOCK_QUEUE_LENGTH 30
#define BLOCK_QUEUE_WORKER_INTERVAL 1
#define BLOCK_QUEUE_DELAY 5
#define RELEASE 1
#define PATCH 0
#define FIX 0
#define EXTRAVERSION "-db1"

#define MYSQL_HOST "localhost"
#define MYSQL_USER "cypher"
#define MYSQL_PASSWD "cypher_blockchain"
#define MYSQL_DB "cypher"
#define MYSQL_DB_TABLE "blockchain"

char *block_queue[BLOCK_QUEUE_LENGTH] = {0};
int block_queue_current_index = 0;

#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <openssl/sha.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <pthread.h>
#include <unistd.h>
#include <stdbool.h>
#include <mysql/mysql.h>

#include "mysql_wrapper.h"
//#include "io.h"
#include "crypto.h"
#include "base64.h"
#include "blockchain_query.h"
#include "blockchain_queue.h"
#include "blockchain_queue_worker.h"
#include "networking.h"