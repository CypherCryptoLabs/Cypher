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

int register_to_network() {
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

    unsigned char *encrypted_buffer = malloc(1024);
    int encrypted_buffer_size = private_encrypt(pub_key_hash, pub_key_hash_num_bytes, privkey_buffer, encrypted_buffer);

    if(encrypted_buffer_size == -1){
        print_rsa_error("Private Decrypt failed ");
        exit(0);
    }

    int num_of_null_bytes = 0;
    for(int i = 0; i < encrypted_buffer_size; i++) {
        if(encrypted_buffer[i] == '\x00') {
            num_of_null_bytes++;
        }
    }

    int offset = 0;
    unsigned char *encrypted_buffer_escaped = malloc(encrypted_buffer_size + num_of_null_bytes);
    for(int i = 0; i < encrypted_buffer_size + num_of_null_bytes; i++) {
        if(encrypted_buffer[i] == '\x00') {
            encrypted_buffer_escaped[i + offset] = '\\';
            offset++;
            encrypted_buffer_escaped[i + offset] = '\x00';
        } else {
            encrypted_buffer_escaped[i + offset] = encrypted_buffer[i];
        }
    }

    unsigned char *decrypted_buffer = malloc(encrypted_buffer_size);
    int decrypted_buffer_size = public_decrypt(encrypted_buffer, encrypted_buffer_size, pubkey_buffer, decrypted_buffer);

    if(decrypted_buffer_size == -1){
        print_rsa_error("Private Decrypt failed ");
        exit(0);
    }

    if(strcmp(decrypted_buffer, pub_key_hash) == 0) {
        printf("encryption and decryption successful!\n");
    } else {
        printf("ERROR: Something went wrong! decrypted_buffer != encrypted_buffer\n");
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
    memcpy(packet_buffer + 267 + pubkey_numbytes, encrypted_buffer_escaped, encrypted_buffer_size + offset);

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
    if(inet_pton(AF_INET, "192.168.2.130", &serv_addr.sin_addr)<=0) 
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

    valread = read( sock , buffer, 1024);
    int return_code;
    unsigned long data_num_of_bytes;

    memcpy(&return_code, buffer, sizeof(int));
    memcpy(&data_num_of_bytes, buffer + sizeof(int), sizeof(unsigned long));
    char status = 1;

    if(return_code == 0 && data_num_of_bytes != 0) {
        status = 0;
        send(sock, &status, 1, 0);

        char *db_buffer = malloc(data_num_of_bytes);
        read( sock , db_buffer, data_num_of_bytes - 1);
        
        // parsing data received from node
        int null_byte_index = 0;
        int num_of_null_bytes = 0;
        char node_id[128] = {0};
        char node_ip_address[16] = {0};
        char node_public_key[10000] = {0};
        unsigned long node_field_length[3];
        MYSQL *dbc = connecto_to_db();

        for(int i =143; i < data_num_of_bytes; i++) {

            if(db_buffer[i] == '\0'){

                node_field_length[0] = 128;
                node_field_length[1] = 15;
                node_field_length[2] = (i - null_byte_index) - 15 - 128;

                memcpy(node_id, db_buffer + null_byte_index, 128);
                memcpy(node_ip_address, db_buffer + null_byte_index + 128, 15);
                memcpy(node_public_key, db_buffer + null_byte_index + 128 + 15, node_field_length[2]);

                char *query_string = "REPLACE INTO node VALUES(?, ?, ?);"; 
                MYSQL_BIND param_uoi[3];

                param_uoi[0].buffer_type = MYSQL_TYPE_VARCHAR;
                param_uoi[0].buffer = node_id;
                param_uoi[0].is_unsigned = 0;
                param_uoi[0].is_null = 0;
                param_uoi[0].length = &node_field_length[0];

                param_uoi[1].buffer_type = MYSQL_TYPE_VARCHAR;
                param_uoi[1].buffer = node_ip_address;
                param_uoi[1].is_unsigned = 0;
                param_uoi[1].is_null = 0;
                param_uoi[1].length = &node_field_length[1];

                param_uoi[2].buffer_type = MYSQL_TYPE_VARCHAR;
                param_uoi[2].buffer = node_public_key;
                param_uoi[2].is_unsigned = 0;
                param_uoi[2].is_null = 0;
                param_uoi[2].length = &node_field_length[2];

                MYSQL_STMT* update_or_insert_stmt = mysql_prepared_query(query_string, param_uoi, dbc);
                mysql_stmt_close(update_or_insert_stmt);

                null_byte_index = i + 1;
                i += 144;

            }

        }

        mysql_close(dbc);
        free(db_buffer);

    } else {
        printf("[!] init_node.h: Something went wrong on the nodes side.\n");
        send(sock, &status, 1, 0);
        return -1;
    }

    return 0;
}

int setup_node_list() {

    // get number of registered nodes in the network

    char query_string[500] = "SELECT ip_address FROM node WHERE id != ?;";
    MYSQL_BIND param[1];
    FILE    *pubkey_infile;
    unsigned char    *pubkey_buffer;
    long    pubkey_numbytes;

    pubkey_infile = fopen("public.pem", "r");
    if(pubkey_infile == NULL)
        return 1;

    fseek(pubkey_infile, 0L, SEEK_END);
    pubkey_numbytes = ftell(pubkey_infile);

    fseek(pubkey_infile, 0L, SEEK_SET);	

    pubkey_buffer = (char*)calloc(pubkey_numbytes, sizeof(char));

    if(pubkey_buffer == NULL)
        return 1;

    fread(pubkey_buffer, sizeof(char), pubkey_numbytes, pubkey_infile);
    fclose(pubkey_infile);

    char *pub_key_hash = get_sha512_string(pubkey_buffer, pubkey_numbytes);
    unsigned long pub_key_hash_num_bytes = 128;

    param[0].buffer_type = MYSQL_TYPE_VARCHAR;
    param[0].buffer = pub_key_hash;
    param[0].is_unsigned = 0;
    param[0].is_null = 0;
    param[0].length = &pub_key_hash_num_bytes;

    MYSQL *dbc = connecto_to_db();
    MYSQL_STMT* prev_block_stmt = mysql_prepared_query(query_string, param, dbc);

    MYSQL_RES* prepare_meta_result = mysql_stmt_result_metadata(prev_block_stmt);
    if (!prepare_meta_result)
    {
        fprintf(stderr, " mysql_stmt_result_metadata(), returned no meta information\n");
        fprintf(stderr, " %s\n", mysql_stmt_error(prev_block_stmt));
        return 1;
    // use bind structure and query_string to get data from query
    }

    int column_count= mysql_num_fields(prepare_meta_result);
    if (column_count != 1)
    {
        fprintf(stderr, " invalid column count returned by MySQL\n");
        return 1;
    }

    MYSQL_BIND result_bind[1];
    memset(result_bind, 0, sizeof(result_bind));

    char node_ip_address[16] = {0};
    long unsigned result_len;
    bool result_is_null;

    result_bind[0].buffer_type = MYSQL_TYPE_VAR_STRING;
    result_bind[0].buffer = node_ip_address;
    result_bind[0].buffer_length = sizeof(node_ip_address);
    result_bind[0].length = &result_len;
    result_bind[0].is_null = &result_is_null;

    if (mysql_stmt_bind_result(prev_block_stmt, result_bind)) {
        fprintf(stderr, "mysql_stmt_bind_Result(), failed. Error:%s\n", mysql_stmt_error(prev_block_stmt));
        exit(1);
    }

    mysql_stmt_store_result(prev_block_stmt);
    int num_rows = mysql_stmt_num_rows(prev_block_stmt);

    node_list.length = num_rows;
    *node_list.node_address_list = malloc(num_rows * 16 * sizeof(char));

    for(int i = 0; i < num_rows; i++) {
        mysql_stmt_fetch(prev_block_stmt);
       
        char *ip_address_from_row = malloc(result_len + 1);
        memset(ip_address_from_row, 0, result_len + 1);
        memcpy(ip_address_from_row, node_ip_address, result_len);

        node_list.node_address_list[i] = ip_address_from_row;

    }

    return 0;

}

void init_node() {
    // This function is used to set up everything needed by the node
    char *public_key_filename = "public.pem";
    char *private_key_filename = "private.pem";
    
    if(!file_exists(public_key_filename) || !file_exists(private_key_filename)) {
        printf("[i] Either public- or private key is missing. Generating new keypair!\n");
        generate_keypair();
    }

    register_to_network();
    setup_node_list();

}