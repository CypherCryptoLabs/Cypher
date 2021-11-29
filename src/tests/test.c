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
#include <fcntl.h>

#define PORT 50000

struct packet{
    int query_id;
    char timestamp[11];
    char sender_address[129];
    char receiver_address[129];
    char data_blob[10241];
    int data_blob_length;
};

char *local_pub_key;
char *local_priv_key;
long local_priv_key_num_bytes;
char *local_key_hash;
long local_pub_key_num_bytes;

bool file_exists(char *filename) {
    FILE *file;
    
    if (file = fopen(filename, "r")) 
    {
        return 1;
    }
    else
    {
        return 0;
    }
}

char * get_sha512_string( char content[10520], int len) {

    SHA512_CTX ctx;
    unsigned char buffer[10520] = {0};
    char *hash_as_string = (char *)malloc(SHA512_DIGEST_LENGTH * 2);
    //int len = strnlen(content, 20269);

    strcpy(buffer,content);

    SHA512_Init(&ctx);
    SHA512_Update(&ctx, buffer, len);
    SHA512_Final(buffer, &ctx);

    for (int i = 0; i < SHA512_DIGEST_LENGTH; i++) {
        sprintf(&hash_as_string[2 * i], "%02x", buffer[i]);
    }

    return hash_as_string;

}

int setup_local_keys() {
    FILE    *pubkey_infile;
    FILE    *privkey_infile;

    pubkey_infile = fopen("test_public.pem", "r");
    if(pubkey_infile == NULL)
        return 1;

    privkey_infile = fopen("test_private.pem", "r");
    if(privkey_infile == NULL)
        return 1;

    fseek(privkey_infile, 0L, SEEK_END);
    local_priv_key_num_bytes = ftell(privkey_infile);

    fseek(pubkey_infile, 0L, SEEK_END);
    local_pub_key_num_bytes = ftell(pubkey_infile);

    fseek(pubkey_infile, 0L, SEEK_SET);
    fseek(privkey_infile, 0L, SEEK_SET);	

    local_pub_key = (char*)calloc(local_pub_key_num_bytes, sizeof(char));	
    local_priv_key = (char*)calloc(local_priv_key_num_bytes, sizeof(char));	

    if(local_pub_key == NULL)
        return 1;

    if(local_priv_key == NULL)
        return 1;

    fread(local_pub_key, sizeof(char), local_pub_key_num_bytes, pubkey_infile);
    fclose(pubkey_infile);

    fread(local_priv_key, sizeof(char), local_priv_key_num_bytes, privkey_infile);
    fclose(privkey_infile);

    local_key_hash = get_sha512_string(local_pub_key, local_pub_key_num_bytes);

    return 0;
}

void generate_keypair()
{
	int ret = 0;
	RSA *r = NULL;
	BIGNUM *bne = NULL;
	BIO *bp_public = NULL, *bp_private = NULL;

	int				bits = 4096;
	unsigned long	e = RSA_F4;

	bne = BN_new();
	ret = BN_set_word(bne,e);
	if(ret != 1){
		goto free_all;
	}

	r = RSA_new();
	ret = RSA_generate_key_ex(r, bits, bne, NULL);
	if(ret != 1){
		goto free_all;
	}

	bp_public = BIO_new_file("test_public.pem", "w+");
	ret = PEM_write_bio_RSAPublicKey(bp_public, r);
	if(ret != 1){
		goto free_all;
	}

	bp_private = BIO_new_file("test_private.pem", "w+");
	ret = PEM_write_bio_RSAPrivateKey(bp_private, r, NULL, NULL, 0, NULL, NULL);

free_all:

	BIO_free_all(bp_public);
	BIO_free_all(bp_private);
	RSA_free(r);
	BN_free(bne);

	return;
}

void init_test() {
    char *public_key_filename = "test_public.pem";
    char *private_key_filename = "test_private.pem";
    
    if(!file_exists(public_key_filename) || !file_exists(private_key_filename)) {
        printf("[i] Either public- or private key is missing. Generating new keypair!\n");
        generate_keypair();
    }

    setup_local_keys();
}
   
int connect_to_node(char *ip_address)
{

    printf("[i] connecting to node...\n");

    int sock = 0, valread;
    struct sockaddr_in serv_addr;
    char *blockchain_name = "Cypher Blockchain";
    char buffer[20269] = {0};
    if ((sock = socket(AF_INET, SOCK_STREAM, 0)) < 0)
    {
        printf("[!] Socket creation error \n");
        return -1;
    }
   
    serv_addr.sin_family = AF_INET;
    serv_addr.sin_port = htons(PORT);
       
    // Convert IPv4 and IPv6 addresses from text to binary form
    if(inet_pton(AF_INET, ip_address, &serv_addr.sin_addr)<=0) 
    {
        printf("[!] Invalid address/ Address not supported \n");
        return -1;
    }
   
    if (connect(sock, (struct sockaddr *)&serv_addr, sizeof(serv_addr)) < 0)
    {
        printf("[!] Connection Failed \n");
        return -1;
    }
    send(sock , blockchain_name , strlen(blockchain_name) , 0 );
    printf("[i] Blockchain Name sent\n");
    valread = read( sock , buffer, 1024);
    printf("[i] Node answered '%s'\n",buffer );

    if(strcmp(blockchain_name, buffer) == 0) {
        return sock;
    }

    return 0;
}

char *compile_to_packet_buffer(struct packet *block) {

    char *packet = malloc(267 + block->data_blob_length);
    memset(packet, 0, 267 + block->data_blob_length);

    memcpy(packet + 1, block->timestamp, 10);
    memcpy(packet + 11, block->sender_address, 128);
    memcpy(packet + 139, block->receiver_address, 128);
    memcpy(packet + 267, block->data_blob, block->data_blob_length);

    return packet;

}

int main(int argc, char const *argv[]) {
    
    init_test();
    char user_input_ip_address[17] = {0};
    int socket;
    
    printf("Please enter Node-IP-Address: ");
    scanf("%16s", user_input_ip_address);

    if(socket = connect_to_node(user_input_ip_address) == 0)
        exit(1);

    printf("[i] running tests...\n");

    unsigned int timestamp = (unsigned int)time(NULL) - BLOCK_QUEUE_DELAY;
    char timestamp_as_string[11];
    sprintf(timestamp_as_string, "%d", timestamp);

    struct packet *new_block_packet = malloc(sizeof(struct packet));
    memcpy(new_block_packet->receiver_address, local_key_hash, 128);
    memcpy(new_block_packet->sender_address, local_key_hash, 128);
    memcpy(new_block_packet->timestamp, timestamp_as_string, 10);
    new_block_packet->data_blob_length = rand() % (10000 + 1 - 0) + 0;

    int rnd=open("/dev/urandom", O_RDONLY);
    read(rnd, new_block_packet->data_blob, new_block_packet->data_blob_length);
    close(rnd);

    char *packet_buffer = compile_to_packet_buffer(new_block_packet);
    packet_buffer[0] = 1;

    char node_status;
    bool request_data = 0;
    send(socket, &packet_buffer, 268 + new_block_packet->data_blob_length, 0);
    printf("TEST\n");
    read(socket, &node_status, 1);
    printf("TEST\n");

    if(node_status) {
        printf("Success!\n");
    } else {
        printf("Failure!\n");
    }

    send(socket, &request_data, 1, 0);

}