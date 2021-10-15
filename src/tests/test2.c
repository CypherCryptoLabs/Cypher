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

int padding = RSA_PKCS1_PADDING;
 
RSA * create_RSA(unsigned char * key,int public)
{
    RSA *rsa= NULL;
    BIO *keybio ;
    keybio = BIO_new_mem_buf(key, -1);
    if (keybio==NULL)
    {
        printf( "Failed to create key BIO");
        return 0;
    }
    if(public)
    {
        rsa = PEM_read_bio_RSA_PUBKEY(keybio, &rsa,NULL, NULL);
    }
    else
    {
        rsa = PEM_read_bio_RSAPrivateKey(keybio, &rsa,NULL, NULL);
    }
    if(rsa == NULL)
    {
        printf( "Failed to create RSA");
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

void printLastError(char *msg)
{
    char * err = malloc(130);;
    ERR_load_crypto_strings();
    ERR_error_string(ERR_get_error(), err);
    printf("%s ERROR: %s\n",msg, err);
    free(err);
}

int main(int argc, char* argv[]) {

    FILE    *pubkey_infile;
    FILE    *privkey_infile;
    char    *pubkey_buffer;
    char    *privkey_buffer;
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

    printf("The file called public.pem contains this text\n\n%s\n", pubkey_buffer);
    printf("The file called private.pem contains this text\n\n%s\n", privkey_buffer);

    char *encrypted_file;
    int encrypted_buffer_size = private_encrypt(pubkey_buffer, pubkey_numbytes, privkey_buffer, encrypted_file);

    if(encrypted_buffer_size == -1){
        printLastError("Private Decrypt failed ");
        exit(0);
    }

    for(int i = 0; i < encrypted_buffer_size; i++) {
        printf("%x", encrypted_file[i]);
    }
    printf("\n");

    printf("%d\n", encrypted_buffer_size);

    free(pubkey_buffer);
    free(privkey_buffer);

}