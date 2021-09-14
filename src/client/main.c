#include <stdio.h>
#include <sys/socket.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <string.h>
#include <time.h>
#define PORT 50000
   
int main(int argc, char const *argv[])
{

    printf("[i] connecting to node...\n");

    int sock = 0, valread;
    struct sockaddr_in serv_addr;
    char *blockchain_name = "Cypher Blockchain";
    char buffer[1024] = {0};
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
        
        printf("Select mode:\n[1] Send Message\n[2] Query Blockchain\n");
        int mode_selection = 0;
        scanf("%d", &mode_selection);
        getchar();

        if(mode_selection == 1) {
            char timestamp_as_string[10];// = "1628770578";
            char message[1000] = {0};

            printf("Enter message:\n");
            char userinput[989] = {0};
            char userinput2[989] = {0};
            fgets(userinput, sizeof userinput, stdin);
            sprintf(userinput2, "%s", userinput);

            sprintf(timestamp_as_string, "%d", (unsigned int)time(NULL));
            strcat(message, "\x01");
            strcat(message, timestamp_as_string);

            strcat(message, userinput2);
            send(sock , message , strnlen(message, 10000) , 0 );
        } else if(mode_selection == 2) {
            
            char query[20267] = {0};
            char message[20268] = {0};
            char timestamp[11] = {0};
            char previous_hash[129] = {0};
            char receiver_address[129] = {0};
            char sender_address[129] = {0};
            char receiver_content[10001] = {0};
            char sender_content[10001] = {0};

            printf("Enter timestamp in Unix format:\n");
            fgets(timestamp, 11, stdin);
            if(timestamp[0] == '\n' && timestamp[1] == '\0'){
                timestamp[0] = 0x00;
            }

            printf("Enter previous Hash:\n");
            fgets(previous_hash, 129, stdin);
            if(previous_hash[0] == '\n' && previous_hash[1] == '\0'){
                previous_hash[0] = 0x00;
            }

            printf("Enter receiver Address:\n");
            fgets(receiver_address, 129, stdin);
            if(receiver_address[0] == '\n' && receiver_address[1] == '\0'){
                receiver_address[0] = 0x00;
            }

            printf("Enter sender Address:\n");
            fgets(sender_address, 129, stdin);
            if(sender_address[0] == '\n' && sender_address[1] == '\0'){
                sender_address[0] = 0x00;
            }

            printf("Enter receiver content:\n");
            fgets(receiver_content, 10001, stdin);
            if(receiver_content[0] == '\n' && receiver_content[1] == '\0'){
                receiver_content[0] = 0x00;
            }

            printf("Enter sender content:\n");
            fgets(sender_content, 10001, stdin);
            if(sender_content[0] == '\n' && sender_content[1] == '\0'){
                sender_content[0] = 0x00;
            }

            strcat(message, "\x02");

            int content_len = strnlen(receiver_content, 10001) - 1;

            memcpy(query, timestamp, 10);
            memcpy(query + 10, previous_hash, 128);
            memcpy(query + 138, receiver_address, 128);
            memcpy(query + 266, sender_address, 128);
            if(content_len > 0) {
                memcpy(query + 394, receiver_content, content_len);
                memcpy(query + 394 + content_len, sender_content, content_len);
                memcpy(message + 1, query, 394 + (content_len * 2));
            } else {
                memcpy(message + 1, query, 394);
            }

            send(sock , message , 394 + (content_len * 2) + 1 , 0 );
            valread = read( sock , buffer, 1024);

            for(int i = 0; i < 1024; i++) {
                printf("%02x", buffer[i]);
            }
            printf("\n");

        }

    } else {

        printf("[!] Ending communication: node sent wrong Blockchain Name!");

    }

    return 0;
}