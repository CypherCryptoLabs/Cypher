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
    struct return_data return_data_struct;

    if(parsed_packet->query_id != -1) {
        switch (parsed_packet->query_id)
        {
        case 1:

            // add new blobk to blockchain
            printf("[i] Client send request to create a new Block (query_id = '%X')\n", parsed_packet->query_id);
            return_data_struct = add_block_to_queue(parsed_packet, 1);
            break;

        case 2:
        
            // search for block matching metadata
            printf("[i] Client send request search for Block in blockchain (query_id = '%X')\n", *client_packet);
            return_data_struct = search_blockchain(parsed_packet);
            break;
            
        case 3:
        
            printf("[i] Client send request to create a live ticker (query_id = '%X')\n", *client_packet);
            return_data_struct = subscribe_to_live_ticker(parsed_packet->sender_address, socket);
            break;

        case 4:

            printf("[i] Request to register new Node (query_id = '%X')\n", *client_packet);
            return_data_struct = register_new_node(inet_ntoa(arguments.address.sin_addr), parsed_packet);
            break;

        case 5:

            // add new blobk to blockchain without alerting other nodes.
            // need some other way of doing this, this could be exploited to desync nodes
            printf("[i] Client send request to create a new Block (query_id = '%X')\n", parsed_packet->query_id);
            return_data_struct = add_block_to_queue(parsed_packet, 0);
            break;

        case 6:

            printf("[i] Client send request to sync blockchain (query_id = '%X')\n", parsed_packet->query_id);
            return_data_struct = send_blockchain(parsed_packet);
            break;
        
        default:
            printf("[!] query_id '%u' is invalid!\n", parsed_packet->query_id);
            return_data_struct.return_code = 255;
            break;
        }
    } else {
        return_data_struct.return_code = 128;
    }

    char *client_status;
    char status_message[sizeof(int) + sizeof(unsigned long)];

    memcpy(status_message, &return_data_struct.return_code, sizeof(int));
    memcpy(status_message + sizeof(int), &return_data_struct.data_num_of_bytes, sizeof(unsigned long));

    send(socket, &status_message, sizeof(int) + sizeof(unsigned long), 0 );
    read(socket, client_status, 1);

    if(client_status == 0) {
        send(socket, return_data_struct.data, return_data_struct.data_num_of_bytes, 0);
    }

    // DEBUG

    /*printf("%d %ld\n", return_data_struct.return_code, return_data_struct.data_num_of_bytes);
    
    for(int i = 0; i < (sizeof(int) + sizeof(unsigned long)); i++) {
        printf("%02x", status_message[i]);
    }
    printf("\n");*/

    for(int i = 0; i < return_data_struct.data_num_of_bytes; i++) {
        printf("%02x", return_data_struct.data[i]);
    }
    printf("\n");

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

    char *packet = malloc(267 + block->data_blob_length);
    memset(packet, 0, 267 + block->data_blob_length);

    memcpy(packet + 1, block->timestamp, 10);
    memcpy(packet + 11, block->sender_address, 128);
    memcpy(packet + 139, block->receiver_address, 128);
    memcpy(packet + 267, block->data_blob, block->data_blob_length);

    return packet;

}

struct return_data forward_query(char *ip_address, struct packet *source_packet, char query_id, bool request_data) {

    struct return_data return_data_struct;
    printf("[i] connecting to node...\n");

    int sock = 0, valread;
    struct sockaddr_in serv_addr;
    char *blockchain_name = "Cypher Blockchain";
    char buffer[20269] = {0};
    if ((sock = socket(AF_INET, SOCK_STREAM, 0)) < 0)
    {
        printf("[!] Socket creation error \n");
        return_data_struct.return_code = -1;
        return return_data_struct;
    }
   
    serv_addr.sin_family = AF_INET;
    serv_addr.sin_port = htons(PORT);
       
    // Convert IPv4 and IPv6 addresses from text to binary form
    if(inet_pton(AF_INET, ip_address, &serv_addr.sin_addr)<=0) 
    {
        printf("[!] Invalid address/ Address not supported \n");
        return_data_struct.return_code = -1;
        return return_data_struct;
    }
   
    if (connect(sock, (struct sockaddr *)&serv_addr, sizeof(serv_addr)) < 0)
    {
        printf("[!] Connection Failed \n");
        return_data_struct.return_code = -1;
        return return_data_struct;
    }
    send(sock , blockchain_name , strlen(blockchain_name) , 0 );
    printf("[i] Blockchain Name sent\n");
    valread = read( sock , buffer, 1024);
    printf("[i] Node answered '%s'\n",buffer );
    int return_code = 0;

    if(strcmp(blockchain_name, buffer) == 0) {

        char *compiled_packet_buffer = compile_to_packet_buffer(source_packet);
        compiled_packet_buffer[0] = query_id;

        send(sock, compiled_packet_buffer, 268 + source_packet->data_blob_length, 0);
        read( sock , buffer, 1024);

        if(buffer[0] != '\0') {
            return_code = 1;
        }

        char status = !request_data;
        send(sock, &status, 1, 0);

        if(request_data) {
            unsigned long buffer_size;
            memcpy(&buffer_size, buffer + sizeof(int), sizeof(unsigned long));
            unsigned char *data_buffer = malloc(buffer_size);
            int recv_bytes = 0;

            while(recv_bytes < buffer_size) {
                recv_bytes += recv(sock, data_buffer + (recv_bytes), buffer_size, 0);
            }
            
            return_data_struct.data = data_buffer;
            return_data_struct.data_num_of_bytes = buffer_size;

            for(int i = 0; i < buffer_size; i ++) {
                printf("%02x", data_buffer[i]);
            }
            printf("\n");
        }

        free(compiled_packet_buffer);
    }

    return_data_struct.return_code = return_code;
    return return_data_struct;
}