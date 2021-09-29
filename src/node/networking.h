#define PORT 50000

struct packet parse_packet(char *source_buffer) {

    struct packet *destination = malloc(sizeof(struct packet));
    memset(destination, 0, sizeof(destination));

    destination->sender_content_length = 0;
    destination->receiver_content_length = 0;

    destination->query_id = source_buffer[0];
    memcpy(destination->timestamp, source_buffer + 1, 10);
    memcpy(destination->sender_address, source_buffer + 11, 128);
    memcpy(destination->receiver_address, source_buffer + 139, 128);
    memcpy(destination->previous_block_hash, source_buffer + 267, 128);

    int first_null_byte = -1;

    // figure out sender_content_length + receiver_content_length
    for (int i = 0; i < 10000 && first_null_byte == -1; i++) {
        if(source_buffer[i + 395] == '\0' && source_buffer[i + 395 - 1] != '\\') {
            first_null_byte = i + 1;
        }
    }

    memcpy(destination->sender_content, source_buffer + 395, first_null_byte -1 );

    int second_null_byte = -1;
    // figuring sender_content_length out
    for (int i = 0; i < 10000 && second_null_byte == -1; i++) {
        if(source_buffer[i + 395 + first_null_byte] == '\0' && source_buffer[i + 395 - 1 + first_null_byte] != '\\') {
            second_null_byte = i + 1;
        }
    }

    memcpy(destination->receiver_content, source_buffer + 395 + first_null_byte, second_null_byte -1 );

    destination->sender_content_length = first_null_byte;
    destination->receiver_content_length = second_null_byte;

    return *destination;

    // TODO: verify that all fields in packet are actual valid data
}

void * handle_request( void* p_socket ) {

    printf("[i] Started new Thread...\n");

    int socket = *((int *) p_socket);
    char client_packet[20269];
    memset(client_packet, 0, sizeof(char) + 20268);

    read(socket, client_packet, 20268);

    struct packet *parsed_packet = malloc(sizeof(struct packet));
    memset(parsed_packet, 0, sizeof(parsed_packet));

    *parsed_packet = parse_packet(client_packet);

    switch (parsed_packet->query_id)
    {
    case 1:

        // add new blobk to blockchain
        printf("[i] Client send request to create a new Block (query_id = '%X')\n", parsed_packet->query_id);
        add_block_to_queue(parsed_packet);

        break;

    case 2:
    
        // search for block matching metadata
        printf("[i] Client send request search for Block in blockchain (query_id = '%X')\n", *client_packet);
        struct block_cluster test = search_blockchain(parsed_packet);

        //DEBUG
        /*for(int i = 0; i < test.cluster_length; i++) {
            printf("%02x", test.cluster[i]);
        }
        printf("\n");

        printf("%d\n", test.cluster_length);*/

        send(socket , test.cluster , test.cluster_length , 0 );

        break;
        
    case 3:
    
        printf("[i] Client send request to create a live ticker (query_id = '%X')\n", *client_packet);

        subscribe_to_live_ticker(parsed_packet->sender_address, socket);
        break;
    
    default:
        printf("[!] query_id '%u' is invalid!\n", parsed_packet->query_id);
        break;
    }

}

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

void notify_ticker_subscriber(char* subscriber_address) {
    // check if address is subscribed to live ticker
    bool address_is_subscribed = false;
    char message[10] = "TEST";

    for(int i = 0; i < LIVE_TICKER_SUBSCRIBER_COUNT && !address_is_subscribed; i++) {
        if(live_ticker_subscriber_list[i] && strcmp(live_ticker_subscriber_list[i]->ticker_address, subscriber_address) == 0) {
            address_is_subscribed == true;
            // sending notification to subscriber
            send(live_ticker_subscriber_list[i]->socket, message, sizeof(message), 0);

            //free(live_ticker_subscriber_list[i]->ticker_address);
            free(live_ticker_subscriber_list[i]);
        }
    }

    return;
}