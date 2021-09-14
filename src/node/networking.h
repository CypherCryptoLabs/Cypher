#define PORT 50000

void * connection_handler();
void * handle_request( void* p_socket );


void * connection_handler()
{
    
    // setting up socket and listen to port, and checking if the client is sending the magic words :P

    int server_fd, new_socket, valread;
    struct sockaddr_in address;
    int opt = 1;
    int addrlen = sizeof(address);
    char *blockchain_name = "Cypher Blockchain";

    printf("[i] Creating socket file descriptor \n");
    if ((server_fd = socket(AF_INET, SOCK_STREAM, 0)) == 0) {
        perror("[!] socket failed");
        exit(EXIT_FAILURE);
    }
    
    printf("[i] Forcefully attaching socket to the port %i \n", PORT);
    if (setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR | SO_REUSEPORT, &opt, sizeof(opt))) {
        perror("[!] setsockopt");
        exit(EXIT_FAILURE);
    }

    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons( PORT );
    
    if (bind(server_fd, (struct sockaddr *)&address, sizeof(address))<0) {
        perror("[!] bind failed");
        exit(EXIT_FAILURE);
    }
    
    // if a connection comes in, it will be handled by a new thread, and this loop will continue to listen forever, thus spawning new threads for each successful connection.

    while (1) {

        if (listen(server_fd, 3) < 0) {
            perror("[!] listen");
            exit(EXIT_FAILURE);
        }

        if ((new_socket = accept(server_fd, (struct sockaddr *)&address, (socklen_t*)&addrlen))<0) {
            perror("[!] accept");
            exit(EXIT_FAILURE);
        }


        char buffer[1024] = {0};

        valread = read( new_socket , buffer, 1024);
        printf("[i] Received packet from %s containing Message '%s'\n", inet_ntoa(address.sin_addr),buffer );

        if(strcmp(blockchain_name, buffer) == 0) {

            send(new_socket , blockchain_name , strlen(blockchain_name) , 0 );

            pthread_t ptid;
  
            // Creating a new thread
            int *arg = malloc(sizeof(new_socket));
            *arg = new_socket;
            pthread_create(&ptid, 0, handle_request, arg);
            
        }

    }
    
}

 void * handle_request( void* p_socket ) {

    printf("[i] Started new Thread...\n");

    int socket = *((int *) p_socket);
    char *client_packet = malloc(sizeof(char) + 20268);
    memset(client_packet, 0, sizeof(char) + 20268);

    read(socket, client_packet, 20268);

    unsigned int query_id = client_packet[0]; // hopefully this will never be needed to be increased :P
    char *client_packet_content = client_packet + 1;

    switch (query_id)
    {
    case 1:

        /* 
        *       1 Byte for query ID
        * +    10 bytes for timestamp string
        * +   128 Bytes for SHA512 hashed reciever key
        * +   128 Bytes for SHA512 hashed sender key
        * + 10000 Bytes for message for receiver
        * + 10000 Bytes for message for sender to be decrypted and reloaded
        * +     1 Byte 0 terminator
        * -------
        *   20268 Bytes toal
        */

        // add new blobk to blockchain
        printf("[i] Client send request to create a new Block (query_id = '%X')\n", *client_packet);
        add_block_to_queue(client_packet_content);

        break;

    case 2:
    
        // search for block matching metadata
        printf("[i] Client send request search for Block in blockchain (query_id = '%X')\n", *client_packet);
        struct block_cluster test = search_blockchain(client_packet_content);

        for(int i = 0; i < test.cluster_length; i++) {
            printf("%02x", test.cluster[i]);
        }
        printf("\n");

        printf("%d\n", test.cluster_length);

        send(socket , test.cluster , test.cluster_length , 0 );

        break;
    
    default:
        printf("[!] query_id '%u' is invalid!\n", query_id);
        break;
    }

}