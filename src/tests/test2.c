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

#define PORT 50000

void printLastError(char *msg)
{
    char * err = malloc(130);;
    ERR_load_crypto_strings();
    ERR_error_string(ERR_get_error(), err);
    printf("%s ERROR: %s\n",msg, err);
    free(err);
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

int padding = RSA_PKCS1_PADDING;
 
RSA * create_RSA(unsigned char * key,int public)
{
    RSA *rsa= NULL;
    BIO *keybio ;
    keybio = BIO_new_mem_buf(key, -1);
    if (keybio==NULL)
    {
        printf( "Failed to create key BIO\n");
        return 0;
    }
    if(public)
    {
        rsa = PEM_read_bio_RSAPublicKey(keybio, &rsa,NULL, NULL);
    }
    else
    {
        rsa = PEM_read_bio_RSAPrivateKey(keybio, &rsa,NULL, NULL);
    }

    if(rsa == NULL)
    {
        printLastError( "Failed to create RSA\n");
    }
 
    return rsa;
}
 
int public_encrypt(unsigned char * data,int data_len,unsigned char * key, unsigned char *encrypted)
{
    RSA * rsa = create_RSA(key,1);
    int result = RSA_public_encrypt(data_len,data,encrypted,rsa,padding);
    return result;
}
int private_decrypt(unsigned char * enc_data,int data_len,unsigned char * key, unsigned char *decrypted)
{
    RSA * rsa = create_RSA(key,0);
    int  result = RSA_private_decrypt(data_len,enc_data,decrypted,rsa,padding);
    return result;
}
 
 
int private_encrypt(unsigned char * data,int data_len,unsigned char * key, unsigned char *encrypted)
{
    RSA * rsa = create_RSA(key,0);
    int result = RSA_private_encrypt(data_len,data,encrypted,rsa,padding);
    return result;
}
int public_decrypt(unsigned char * enc_data,int data_len,unsigned char * key, unsigned char *decrypted)
{
    RSA * rsa = create_RSA(key,1);
    int  result = RSA_public_decrypt(data_len,enc_data,decrypted,rsa,padding);
    return result;
}

int main(int argc, char* argv[]) {

    FILE    *pubkey_infile;
    FILE    *privkey_infile;
    unsigned char    *pubkey_buffer;
    unsigned char    *privkey_buffer;
    long    pubkey_numbytes;
    long    privkey_numbytes;

    pubkey_infile = fopen("public.pem", "r");
    if(pubkey_infile == NULL)
        return 1;

    privkey_infile = fopen("private.pem", "r");
    if(privkey_infile == NULL)
        return 1;

    fseek(privkey_infile, 0L, SEEK_END);
    privkey_numbytes = ftell(privkey_infile);

    fseek(pubkey_infile, 0L, SEEK_END);
    pubkey_numbytes = ftell(pubkey_infile);

    fseek(pubkey_infile, 0L, SEEK_SET);
    fseek(privkey_infile, 0L, SEEK_SET);	

    pubkey_buffer = (char*)calloc(pubkey_numbytes, sizeof(char));	
    privkey_buffer = (char*)calloc(privkey_numbytes, sizeof(char));	

    if(pubkey_buffer == NULL)
        return 1;

    if(privkey_buffer == NULL)
        return 1;

    fread(pubkey_buffer, sizeof(char), pubkey_numbytes, pubkey_infile);
    fclose(pubkey_infile);

    fread(privkey_buffer, sizeof(char), privkey_numbytes, privkey_infile);
    fclose(privkey_infile);

    char *pub_key_hash = get_sha512_string(pubkey_buffer, pubkey_numbytes);
    int pub_key_hash_num_bytes = 128;

    unsigned char *encrypted_file = malloc(1024);
    int encrypted_buffer_size = private_encrypt(pub_key_hash, pub_key_hash_num_bytes, privkey_buffer, encrypted_file);

    if(encrypted_buffer_size == -1){
        printLastError("Private Decrypt failed ");
        exit(0);
    }

    int num_of_null_bytes = 0;
    for(int i = 0; i < encrypted_buffer_size; i++) {
        if(encrypted_file[i] == '\x00') {
            num_of_null_bytes++;
        }
    }

    int offset = 0;
    unsigned char *encrypted_file_escaped = malloc(encrypted_buffer_size + num_of_null_bytes);
    for(int i = 1; i < encrypted_buffer_size + num_of_null_bytes; i++) {
        if(encrypted_file[i + offset] == '\x00') {
            encrypted_file_escaped[i + offset] = '\\';
            offset++;
            encrypted_file_escaped[i + offset] = '\x00';
        } else {
            encrypted_file_escaped[i + offset] = encrypted_file[i + offset];
        }
    }

    unsigned char *decrypted_file = malloc(encrypted_buffer_size);
    int decrypted_buffer_size = public_decrypt(encrypted_file, encrypted_buffer_size, pubkey_buffer, decrypted_file);

    if(decrypted_buffer_size == -1){
        printLastError("Private Decrypt failed ");
        exit(0);
    }

    if(strcmp(decrypted_file, pub_key_hash) == 0) {
        printf("encryption and decryption successful!\n");
    } else {
        printf("ERROR: Something went wrong! decrypted_file != encrypted_file\n");
    }

    unsigned char packet_buffer[775 + 512 + 267] = {0};

    packet_buffer[0] = 4;
    char timestamp_as_string[11];
    unsigned int timestamp = (unsigned int)time(NULL);
    sprintf(timestamp_as_string, "%d", timestamp);
    memcpy(packet_buffer + 1, timestamp_as_string, 10);
    memcpy(packet_buffer + 11, pub_key_hash, 128);
    memcpy(packet_buffer + 139, pub_key_hash, 128);
    memcpy(packet_buffer + 267, pubkey_buffer, pubkey_numbytes);
    memcpy(packet_buffer + 267 + pubkey_numbytes, encrypted_file_escaped, encrypted_buffer_size + offset);

    for (int i = 0; i < 268 + pubkey_numbytes + encrypted_buffer_size; i++) {
        printf("%02X", packet_buffer[i]);
    }
    printf("\n\n");

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
    if(inet_pton(AF_INET, "127.0.0.1", &serv_addr.sin_addr)<=0) 
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
        send(sock , packet_buffer , 268 + pubkey_numbytes + encrypted_buffer_size + offset , 0 );
    }

    free(pubkey_buffer);
    free(privkey_buffer);

}