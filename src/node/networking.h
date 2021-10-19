#define PORT 50000

struct handle_request_arg{
    int socket;
    struct sockaddr_in address;
};

struct packet parse_packet(char *source_buffer) {

    struct packet *destination = malloc(sizeof(struct packet));
    memset(destination, 0, sizeof(destination));

    destination->data_blob_length = -1;

    destination->query_id = source_buffer[0];
    memcpy(destination->timestamp, source_buffer + 1, 10);
    memcpy(destination->sender_address, source_buffer + 11, 128);
    memcpy(destination->receiver_address, source_buffer + 139, 128);

    if(source_buffer[267] == '\0') {
        destination->data_blob_length = 0;
    }

    for(int i = 1; i < 10240 && destination->data_blob_length == -1; i++) {
        if(source_buffer[267 + i] == '\0' && source_buffer[267 + i -1] != '\\') {
            destination->data_blob_length = i;
        }
    }

    memcpy(destination->data_blob, source_buffer + 267, destination->data_blob_length);

    bool packet_contains_invalid_data = false;
    char timestamp_as_string[11];
    unsigned int timestamp = (unsigned int)time(NULL) - BLOCK_QUEUE_DELAY;
    sprintf(timestamp_as_string, "%d", timestamp);

    if(memcmp(timestamp_as_string, destination->timestamp, 10) > 0) {
        packet_contains_invalid_data = !packet_contains_invalid_data;
    }

    for(int i = 0; i < 128 && !packet_contains_invalid_data; i++) {
        if(!isxdigit(destination->sender_address[i])) {
            packet_contains_invalid_data = !packet_contains_invalid_data;
        }
    }

    for(int i = 0; i < 128 && !packet_contains_invalid_data; i++) {
        if(!isxdigit(destination->receiver_address[i])) {
            packet_contains_invalid_data = !packet_contains_invalid_data;
        }
    }

    if(!packet_contains_invalid_data && (destination->data_blob_length > 0 || destination->query_id == 3)) {
        return *destination;
    } else {
        destination->query_id = -1;
        return *destination;
    }

}

void * handle_request( void* args ) {

    struct handle_request_arg arguments = *(struct handle_request_arg*)args;
    int packet_size = sizeof(struct packet);
    //printf("%d\n", packet_size);

    int socket = arguments.socket;
    char client_packet[packet_size];
    memset(client_packet, 0, sizeof(char) + packet_size);

    read(socket, client_packet, packet_size);

    struct packet *parsed_packet = malloc(sizeof(struct packet));
    memset(parsed_packet, 0, sizeof(parsed_packet));

    *parsed_packet = parse_packet(client_packet);

    //TODO: tell the client in coherent way the result of the query
    unsigned char status = 0;
    struct block_cluster data_to_send;

    if(parsed_packet->query_id != -1) {
        switch (parsed_packet->query_id)
        {
        case 1:

            // add new blobk to blockchain
            printf("[i] Client send request to create a new Block (query_id = '%X')\n", parsed_packet->query_id);
            status = add_block_to_queue(parsed_packet);

            break;

        case 2:
        
            // search for block matching metadata
            printf("[i] Client send request search for Block in blockchain (query_id = '%X')\n", *client_packet);
            data_to_send = search_blockchain(parsed_packet);

            break;
            
        case 3:
        
            printf("[i] Client send request to create a live ticker (query_id = '%X')\n", *client_packet);
            status = subscribe_to_live_ticker(parsed_packet->sender_address, socket);

            break;

        case 4:

            printf("[i] Request to register new Node (query_id = '%X')\n", *client_packet);
            status = register_new_node(inet_ntoa(arguments.address.sin_addr), parsed_packet->data_blob, parsed_packet->data_blob_length);
            
            break;
        
        default:
            printf("[!] query_id '%u' is invalid!\n", parsed_packet->query_id);
            status = '\x64';
            break;
        }
    } else {
        unsigned char status = '\x64';
    }
    send(socket , &status , 1 , 0 );
    send(socket , data_to_send.cluster , data_to_send.cluster_length , 0 );

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

        if(strcmp(blockchain_name, buffer) == 0) {

            send(new_socket , blockchain_name , strlen(blockchain_name) , 0 );

            pthread_t ptid;
  
            // Creating a new thread
            struct handle_request_arg* arg = malloc(sizeof(struct handle_request_arg));
            arg->socket = new_socket;
            arg->address = address;
            pthread_create(&ptid, 0, handle_request, arg);
            
        }

    }
    
}

void notify_ticker_subscriber(char* subscriber_address, char *packet) {

    // check if address is subscribed to live ticker
    bool address_is_subscribed = false;

    for(int i = 0; i < LIVE_TICKER_SUBSCRIBER_COUNT; i++) {
        if(!address_is_subscribed && live_ticker_subscriber_list[i] && strcmp(live_ticker_subscriber_list[i]->ticker_address, subscriber_address) == 0) {
            address_is_subscribed == true;
            // sending notification to subscriber
            send(live_ticker_subscriber_list[i]->socket, packet, sizeof(struct packet), 0);
            live_ticker_subscriber_list[i] = 0;
            free(live_ticker_subscriber_list[i]);
        }
    }

    return;
}

char *compile_to_packet_buffer(struct packet *block) {

    char *packet = malloc(sizeof(struct packet));
    memset(packet, 0, sizeof(struct packet));

    memcpy(packet + 1, block->timestamp, 10);
    memcpy(packet + 11, block->sender_address, 128);
    memcpy(packet + 139, block->receiver_address, 128);
    memcpy(packet + 267, block->data_blob, block->data_blob_length);

    return packet;

}