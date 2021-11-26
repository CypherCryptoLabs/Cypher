#define BLOCK_QUEUE_LENGTH 30
#define BLOCK_QUEUE_WORKER_INTERVAL 1
#define BLOCK_QUEUE_DELAY 5
#define LIVE_TICKER_SUBSCRIBER_COUNT 30
#define RELEASE 1
#define PATCH 0
#define FIX 0
#define EXTRAVERSION "-db1"

#define MYSQL_HOST "localhost"
#define MYSQL_USER "cypher"
#define MYSQL_PASSWD "cypher_blockchain"
#define MYSQL_DB "cypher"
#define MYSQL_DB_TABLE "blockchain"

#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <openssl/sha.h>
#include <openssl/rsa.h>
#include <openssl/pem.h>
#include <openssl/ssl.h>
#include <openssl/evp.h>
#include <openssl/bio.h>
#include <openssl/err.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <pthread.h>
#include <unistd.h>
#include <stdbool.h>
#include <mysql/mysql.h>
#include <ctype.h>
#include <math.h>

struct packet{
    int query_id;
    char timestamp[11];
    char sender_address[129];
    char receiver_address[129];
    char data_blob[10241];
    int data_blob_length;
};

struct live_ticker_subscriber {
    char *ticker_address;
    int socket;
};

struct node_cache {
    int length;
    char *node_address_list[];
};

struct packet *block_queue[BLOCK_QUEUE_LENGTH] = {0};
struct live_ticker_subscriber *live_ticker_subscriber_list[LIVE_TICKER_SUBSCRIBER_COUNT] = {0};
struct node_cache node_list;

char *local_pub_key;
char *local_priv_key;
long local_priv_key_num_bytes;
char *local_key_hash;
long local_pub_key_num_bytes;

#include "sha512.h"
#include "rsa_wrapper.h"
#include "mysql_wrapper.h"
#include "blockchain_queue.h"
#include "blockchain_query.h"
#include "blockchain_queue_worker.h"
#include "networking.h"
#include "init_node.h"