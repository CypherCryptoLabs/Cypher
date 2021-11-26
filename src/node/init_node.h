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
    int local_key_hash_num_bytes = 128;

    unsigned char *encrypted_buffer = malloc(1024);
    int encrypted_buffer_size = private_encrypt(local_key_hash, local_key_hash_num_bytes, local_priv_key, encrypted_buffer);

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
    int decrypted_buffer_size = public_decrypt(encrypted_buffer, encrypted_buffer_size, local_pub_key, decrypted_buffer);

    if(decrypted_buffer_size == -1){
        print_rsa_error("Private Decrypt failed ");
        exit(0);
    }

    if(strcmp(decrypted_buffer, local_key_hash) == 0) {
        printf("encryption and decryption successful!\n");
    } else {
        printf("ERROR: Something went wrong! decrypted_buffer != encrypted_buffer\n");
    }

    struct packet *request_packet = malloc(sizeof(struct packet));
    memcpy(request_packet->data_blob, local_pub_key, local_pub_key_num_bytes);
    memcpy(request_packet->data_blob + local_pub_key_num_bytes, encrypted_buffer_escaped, encrypted_buffer_size + offset);
    request_packet->data_blob_length = local_pub_key_num_bytes + encrypted_buffer_size + offset;
    request_packet->query_id = 4;
    unsigned int timestamp = (unsigned int)time(NULL);
    sprintf(request_packet->timestamp, "%d", timestamp);
    memcpy(request_packet->receiver_address, local_key_hash, local_key_hash_num_bytes);
    memcpy(request_packet->sender_address, local_key_hash, local_key_hash_num_bytes);

    struct return_data request_answer = forward_query("192.168.178.25", request_packet, '\x04', 1);
        
    // parsing data received from node
    int null_byte_index = 0;
    //int num_of_null_bytes = 0;
    char node_id[129] = {0};
    char node_ip_address[16] = {0};
    char node_public_key[10000] = {0};
    unsigned long node_field_length[3];
    MYSQL *dbc = connecto_to_db();

    for(int i =143; i < request_answer.data_num_of_bytes; i++) {

        if(request_answer.data[i] == '\0'){

            node_field_length[0] = 128;
            node_field_length[1] = 15;
            node_field_length[2] = (i - null_byte_index) - 15 - 128;

            memcpy(node_id, request_answer.data + null_byte_index, 128);
            memcpy(node_ip_address, request_answer.data + null_byte_index + 128, 15);
            memcpy(node_public_key, request_answer.data + null_byte_index + 128 + 15, node_field_length[2]);

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
    free(request_packet);

    return 0;
}

int setup_node_list() {

    // get number of registered nodes in the network

    char query_string[500] = "SELECT ip_address FROM node WHERE id != ?;";
    MYSQL_BIND param[1];
    unsigned long local_key_hash_num_bytes = 128;

    param[0].buffer_type = MYSQL_TYPE_VARCHAR;
    param[0].buffer = local_key_hash;
    param[0].is_unsigned = 0;
    param[0].is_null = 0;
    param[0].length = &local_key_hash_num_bytes;

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
        memcpy(ip_address_from_row, node_ip_address, result_len);

        node_list.node_address_list[i] = ip_address_from_row;

    }

    return 0;

}

int setup_local_keys() {
    FILE    *pubkey_infile;
    FILE    *privkey_infile;

    pubkey_infile = fopen("public.pem", "r");
    if(pubkey_infile == NULL)
        return 1;

    privkey_infile = fopen("private.pem", "r");
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

void init_node() {
    // This function is used to set up everything needed by the node
    char *public_key_filename = "public.pem";
    char *private_key_filename = "private.pem";
    
    if(!file_exists(public_key_filename) || !file_exists(private_key_filename)) {
        printf("[i] Either public- or private key is missing. Generating new keypair!\n");
        generate_keypair();
    }

    setup_local_keys();
    register_to_network();
    setup_node_list();
    request_blockchain_sync("192.168.178.25");

}