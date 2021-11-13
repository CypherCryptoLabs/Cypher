struct block_cluster {
    char *cluster;
    int cluster_length;
};

struct return_data {
    int return_code;
    unsigned long data_num_of_bytes;
    unsigned char *data;
};

char *compile_to_packet_buffer(struct packet *block);
void notify_ticker_subscriber(char* subscriber_address, char *packet);
struct return_data forward_query(char *ip_address, struct packet *source_packet, char query_id, bool request_data);

int create_new_block( struct packet *block, MYSQL *dbc) {

    MYSQL_BIND result_param[1];
    MYSQL_STMT* prev_block_stmt = mysql_prepared_query("SELECT id, hash_of_prev_block, data_blob, receiver_address, sender_address, UNIX_TIMESTAMP(timestamp) FROM blockchain ORDER BY id DESC LIMIT 1;", result_param, dbc);

    /* Fetch result set meta information */
    MYSQL_RES* prepare_meta_result = mysql_stmt_result_metadata(prev_block_stmt);
    if (!prepare_meta_result)
    {
        fprintf(stderr, " mysql_stmt_result_metadata(), returned no meta information\n");
        fprintf(stderr, " %s\n", mysql_stmt_error(prev_block_stmt));
        exit(1);
    }

    /* Get total columns in the query */
    int column_count= mysql_num_fields(prepare_meta_result);
    if (column_count != 6) /* validate column count */
    {
        fprintf(stderr, " invalid column count returned by MySQL\n");
        exit(1);
    }

    /* Bind single result column, expected to be a double. */
    MYSQL_BIND result_bind[7];
    memset(result_bind, 0, sizeof(result_bind));

    char result_id[21];
    bool result_is_null[7];
    unsigned long result_len[7] = {0};
    char result_data_blob[10241];
    char result_receiver_address[129];
    char result_sender_address[129];
    char result_hash[129];
    char result_timestamp[11];

    result_bind[0].buffer_type = MYSQL_TYPE_VAR_STRING;
    result_bind[0].buffer = &result_id;
    result_bind[0].buffer_length = sizeof(result_id);
    result_bind[0].length = &result_len[0];
    result_bind[0].is_null = &result_is_null[0];

    result_bind[1].buffer_type = MYSQL_TYPE_VAR_STRING;
    result_bind[1].buffer = &result_hash;
    result_bind[1].buffer_length = sizeof(result_hash);
    result_bind[1].length = &result_len[1];
    result_bind[1].is_null = &result_is_null[1];

    result_bind[2].buffer_type = MYSQL_TYPE_MEDIUM_BLOB;
    result_bind[2].buffer = &result_data_blob;
    result_bind[2].buffer_length = sizeof(result_data_blob);
    result_bind[2].length = &result_len[2];
    result_bind[2].is_null = &result_is_null[2];

    result_bind[4].buffer_type = MYSQL_TYPE_VAR_STRING;
    result_bind[4].buffer = &result_receiver_address;
    result_bind[4].buffer_length = sizeof(result_receiver_address);
    result_bind[4].length = &result_len[3];
    result_bind[4].is_null = &result_is_null[3];

    result_bind[5].buffer_type = MYSQL_TYPE_VAR_STRING;
    result_bind[5].buffer = &result_sender_address;
    result_bind[5].buffer_length = sizeof(result_sender_address);
    result_bind[5].length = &result_len[4];
    result_bind[5].is_null = &result_is_null[4];

    result_bind[6].buffer_type = MYSQL_TYPE_VAR_STRING;
    result_bind[6].buffer = &result_timestamp;
    result_bind[6].buffer_length = sizeof(result_timestamp);
    result_bind[6].length = &result_len[5];
    result_bind[6].is_null = &result_is_null[5];

    if (mysql_stmt_bind_result(prev_block_stmt, result_bind)) {
        fprintf(stderr, "mysql_stmt_bind_Result(), failed. Error:%s\n", mysql_stmt_error(prev_block_stmt));
        exit(1);
    }

    mysql_stmt_fetch(prev_block_stmt);
         
    char prev_block[10521] = "";

    memcpy(prev_block, result_id, 21);
    memcpy(prev_block + 21, result_timestamp, 10);
    memcpy(prev_block + 31, result_hash, 128);
    memcpy(prev_block + 159, result_sender_address, 128);
    memcpy(prev_block + 287, result_receiver_address, 128);
    memcpy(prev_block + 415, result_data_blob, result_len[2]);

    //printf("%s\n", prev_block);
    mysql_stmt_close(prev_block_stmt);

    char *prev_block_hash = get_sha512_string(prev_block, 415 + result_len[2]);

    char* query_string = "INSERT INTO blockchain(timestamp, data_blob, receiver_address, sender_address, hash_of_prev_block) VALUES(FROM_UNIXTIME(?), ?, ?, ?, ?);";
    
    long timestamp_length = 10;
    long data_blob_length = block->data_blob_length;
    long receiver_address_length = 128;
    long sender_address_length = 128;
    long prev_block_hash_length = 128;

    MYSQL_BIND param[5];
    param[0].buffer_type = MYSQL_TYPE_STRING;
    param[0].buffer = block->timestamp;
    param[0].is_unsigned = 0;
    param[0].is_null = 0;
    param[0].length = &timestamp_length;

    param[1].buffer_type = MYSQL_TYPE_STRING;
    param[1].buffer = block->data_blob;
    param[1].is_unsigned = 0;
    param[1].is_null = 0;
    param[1].length = &data_blob_length;

    param[2].buffer_type = MYSQL_TYPE_STRING;
    param[2].buffer = block->receiver_address;
    param[2].is_unsigned = 0;
    param[2].is_null = 0;
    param[2].length = &receiver_address_length;

    param[3].buffer_type = MYSQL_TYPE_STRING;
    param[3].buffer = block->sender_address;
    param[3].is_unsigned = 0;
    param[3].is_null = 0;
    param[3].length = &sender_address_length;

    param[4].buffer_type = MYSQL_TYPE_STRING;
    param[4].buffer = prev_block_hash;
    param[4].is_unsigned = 0;
    param[4].is_null = 0;
    param[4].length = &prev_block_hash_length;

    mysql_prepared_query( query_string, param, dbc);
    char *block_as_packet = compile_to_packet_buffer(block);
    notify_ticker_subscriber(block->receiver_address, block_as_packet);

    return 0;

}

struct return_data search_blockchain( struct packet *needle) {

    struct return_data return_data_struct;
 
    //char timestamp[11], content_for_receiver[10001], content_for_sender[10001], receiver_address[129], sender_address[129], prev_block_hash[129];
    //unsigned long content_len = strnlen(content + 394, 20000) / 2;
    char zero_buffer[128] = {0};
    int num_of_parameters = 0;
    long prev_block_hash_length = 128;
    unsigned long timestamp_length = 10;
    char timestamp_needle[11], hash_of_prev_blobk_needle[129], receiver_address_needle[129], sender_address_needle[129];

    memcpy(timestamp_needle, needle->data_blob, 10);
    memcpy(hash_of_prev_blobk_needle, needle->data_blob + 10, 128);
    memcpy(receiver_address_needle, needle->data_blob + 138, 128);
    memcpy(sender_address_needle, needle->data_blob + 266, 128);

    char query_string[500] = "SELECT UNIX_TIMESTAMP(timestamp), hash_of_prev_block, data_blob, receiver_address, sender_address, LENGTH(data_blob) FROM blockchain";
    MYSQL_BIND param[4];

    if(memcmp(zero_buffer, timestamp_needle, 10) != 0) {

        strcat(query_string, " WHERE timestamp = FROM_UNIXTIME(?)");

        param[num_of_parameters].buffer_type = MYSQL_TYPE_VARCHAR;
        param[num_of_parameters].buffer = timestamp_needle;
        param[num_of_parameters].is_unsigned = 0;
        param[num_of_parameters].is_null = 0;
        param[num_of_parameters].length = &timestamp_length;

        num_of_parameters++;

    }

    if(memcmp(zero_buffer, hash_of_prev_blobk_needle, 128) != 0) {

        if(num_of_parameters > 0) {
            strcat(query_string, " AND");
        } else {
            strcat(query_string, " WHERE");
        }

        strcat(query_string, " hash_of_prev_block = ?");
        
        unsigned long  prev_block_hash_length = 128;
        
        param[num_of_parameters].buffer_type = MYSQL_TYPE_VARCHAR;
        param[num_of_parameters].buffer = hash_of_prev_blobk_needle;
        param[num_of_parameters].is_unsigned = 0;
        param[num_of_parameters].is_null = 0;
        param[num_of_parameters].length = &prev_block_hash_length;

        num_of_parameters++;

    }

    if(memcmp(zero_buffer, receiver_address_needle, 128) != 0) {

        if(num_of_parameters > 0) {
            strcat(query_string, " AND");
        } else {
            strcat(query_string, " WHERE");
        }
        
        strcat(query_string, " receiver_address = ?");

        unsigned long  receiver_address_length = 128;
        
        param[num_of_parameters].buffer_type = MYSQL_TYPE_VARCHAR;
        param[num_of_parameters].buffer = receiver_address_needle;
        param[num_of_parameters].is_unsigned = 0;
        param[num_of_parameters].is_null = 0;
        param[num_of_parameters].length = &receiver_address_length;

        num_of_parameters++;

    }

    if(memcmp(zero_buffer, sender_address_needle, 128) != 0) {

        if(num_of_parameters > 0) {
            strcat(query_string, " AND");
        } else {
            strcat(query_string, " WHERE");
        }
        
        strcat(query_string, " sender_address = ?");

        unsigned long  sender_address_length = 128;
        
        param[num_of_parameters].buffer_type = MYSQL_TYPE_VARCHAR;
        param[num_of_parameters].buffer = sender_address_needle;
        param[num_of_parameters].is_unsigned = 0;
        param[num_of_parameters].is_null = 0;
        param[num_of_parameters].length = &sender_address_length;

        num_of_parameters++;

    }

    strcat(query_string, ";");

    // use bind structure and query_string to get data from query
    MYSQL *dbc = connecto_to_db();
    MYSQL_STMT* prev_block_stmt = mysql_prepared_query(query_string, param, dbc);

    MYSQL_RES* prepare_meta_result = mysql_stmt_result_metadata(prev_block_stmt);
    if (!prepare_meta_result)
    {
        fprintf(stderr, " mysql_stmt_result_metadata(), returned no meta information\n");
        fprintf(stderr, " %s\n", mysql_stmt_error(prev_block_stmt));
        return_data_struct.return_code = 1;
        return return_data_struct;
    // use bind structure and query_string to get data from query
    }

    int column_count= mysql_num_fields(prepare_meta_result);
    if (column_count != 6)
    {
        fprintf(stderr, " invalid column count returned by MySQL\n");
        return_data_struct.return_code = 1;
        return return_data_struct;
    }

    MYSQL_BIND result_bind[9];
    memset(result_bind, 0, sizeof(result_bind));

    bool result_is_null[8];
    unsigned long result_len[8] = {0};
    char result_receiver_address[129] = {0};
    char result_sender_address[129] = {0};
    char result_data_blob[129] = {0};
    char result_hash[129] = {0};
    char result_timestamp[11] = {0};
    int result_data_blob_length;

    result_bind[1].buffer_type = MYSQL_TYPE_VAR_STRING;
    result_bind[1].buffer = &result_timestamp;
    result_bind[1].buffer_length = sizeof(result_timestamp);
    result_bind[1].length = &result_len[6];
    result_bind[1].is_null = &result_is_null[6];

    result_bind[2].buffer_type = MYSQL_TYPE_VAR_STRING;
    result_bind[2].buffer = &result_hash;
    result_bind[2].buffer_length = sizeof(result_hash);
    result_bind[2].length = &result_len[1];
    result_bind[2].is_null = &result_is_null[1];

    result_bind[3].buffer_type = MYSQL_TYPE_MEDIUM_BLOB;
    result_bind[3].buffer = &result_data_blob;
    result_bind[3].buffer_length = sizeof(result_data_blob);
    result_bind[3].length = &result_len[2];
    result_bind[3].is_null = &result_is_null[2];

    result_bind[4].buffer_type = MYSQL_TYPE_VAR_STRING;
    result_bind[4].buffer = &result_receiver_address;
    result_bind[4].buffer_length = sizeof(result_receiver_address);
    result_bind[4].length = &result_len[4];
    result_bind[4].is_null = &result_is_null[4];

    result_bind[5].buffer_type = MYSQL_TYPE_VAR_STRING;
    result_bind[5].buffer = &result_sender_address;
    result_bind[5].buffer_length = sizeof(result_sender_address);
    result_bind[5].length = &result_len[5];
    result_bind[5].is_null = &result_is_null[5];

    result_bind[6].buffer_type = MYSQL_TYPE_LONG;
    result_bind[6].buffer = &result_data_blob_length;
    result_bind[6].buffer_length = sizeof(result_data_blob_length);
    result_bind[6].length = &result_len[7];
    result_bind[6].is_null = &result_is_null[7];

    if (mysql_stmt_bind_result(prev_block_stmt, result_bind)) {
        fprintf(stderr, "mysql_stmt_bind_Result(), failed. Error:%s\n", mysql_stmt_error(prev_block_stmt));
        exit(1);
    }

    mysql_stmt_store_result(prev_block_stmt);
    int num_rows = mysql_stmt_num_rows(prev_block_stmt);

    char *block_cluster = malloc(396 * num_rows);
    memset(block_cluster, 0, 396 * num_rows);
    int cluster_length = 0;

    for(int i = 0; i < num_rows; i++) {

        mysql_stmt_fetch(prev_block_stmt);

        memcpy(block_cluster + cluster_length, result_timestamp, 10);
        cluster_length += 10;
        memcpy(block_cluster + cluster_length, result_hash, 128);
        cluster_length += 128;
        memcpy(block_cluster + cluster_length, result_sender_address, 128);
        cluster_length += 128;
        memcpy(block_cluster + cluster_length, result_receiver_address, 128);
        cluster_length += 128;
        memcpy(block_cluster + cluster_length, result_data_blob, result_data_blob_length);
        cluster_length += result_data_blob_length + 1;
        
    }

    return_data_struct.data = block_cluster;
    return_data_struct.data_num_of_bytes = cluster_length;
    return_data_struct.return_code = 0;

    free(block_cluster);

    return return_data_struct;

}

struct return_data add_block_to_queue(struct packet *source_packet, bool alert_network) {

    struct return_data return_data_struct;

    int i = 0;
    bool block_added = false;

    // notify other nodes that a new block has been requested

    if(alert_network) {
        for(int i = 0; i < node_list.length; i++) {

            if(forward_query(node_list.node_address_list[i], source_packet, 0x5, 0).return_code == 1) {
                return_data_struct.return_code = 1;
                return return_data_struct;
            }

        }
    }

    // adding block to local queue
    while(i < BLOCK_QUEUE_LENGTH && !block_added){
        if(!block_queue[i]) {
            block_added = true;
            block_queue[i] = source_packet;
        }
        i++;
    }

    if(!block_added) {
        
        printf("[!] Queue is full!\n");
        return_data_struct.return_code = 1;
        return return_data_struct;

    }

    return_data_struct.return_code = 0;
    return_data_struct.data_num_of_bytes = 0;
    return return_data_struct;

}

struct return_data subscribe_to_live_ticker(char* subscriber_address, int communication_socket) {

    struct return_data return_data_struct;

    struct live_ticker_subscriber *new_subscriber = malloc(sizeof(struct live_ticker_subscriber));
    new_subscriber->socket = communication_socket;
    new_subscriber->ticker_address = subscriber_address;
    bool is_subscribed = false;

    for(int i = 0; i < LIVE_TICKER_SUBSCRIBER_COUNT && !is_subscribed; i++) {
        if(!live_ticker_subscriber_list[i]) {
            live_ticker_subscriber_list[i] = new_subscriber;
            is_subscribed = true;
        }
    }

    return_data_struct.data_num_of_bytes = 0;
    return_data_struct.return_code = !is_subscribed;
    return return_data_struct;

}

struct return_data register_new_node(char *ip_address, struct packet *source_packet) {

    struct return_data return_data_struct;
    long unsigned int ip_address_len = strlen(ip_address);
    char *data_blob = source_packet->data_blob;
    int data_blob_length = source_packet->data_blob_length;

    char *end_of_pub_key = strstr(data_blob, "-----END RSA PUBLIC KEY-----");
    if(end_of_pub_key != NULL) {
        end_of_pub_key += 29;
    } else {
        return_data_struct.return_code = 1;
        return return_data_struct;
    }

    long unsigned int pub_key_len = end_of_pub_key - data_blob;
    char *hashed_pub_key =  get_sha512_string(data_blob, pub_key_len);
    char *pub_key = malloc(pub_key_len + 1);
    memcpy(pub_key, data_blob, pub_key_len);
    unsigned char decrypted_hash[129];
    unsigned char *signature_unescaped = malloc(data_blob_length - pub_key_len);
    int offset = 0;

    for(int i = 0; i < data_blob_length - pub_key_len; i++) {
        if(data_blob[i + pub_key_len] == '\0' && data_blob[i + pub_key_len - 1] == '\\') {
            signature_unescaped[i - 1] = '\0';
            offset++;
        }
        
        signature_unescaped[i - offset] = data_blob[i + pub_key_len];
    }

    long unsigned int decrypted_size = public_decrypt(signature_unescaped, data_blob_length - pub_key_len - offset, pub_key, decrypted_hash);
    if(decrypted_size == -1){
        return_data_struct.return_code = 1;
        return return_data_struct;
    }

    // signature does not match key
    if(strcmp(hashed_pub_key, decrypted_hash) != 0) {
        return_data_struct.return_code = 1;
        return return_data_struct;
    }

    char *search_query_string = "SELECT id FROM node WHERE id = ?;";
    MYSQL_BIND param[1];

    param[0].buffer_type = MYSQL_TYPE_VARCHAR;
    param[0].buffer = decrypted_hash;
    param[0].is_unsigned = 0;
    param[0].is_null = 0;
    param[0].length = &decrypted_size;

    MYSQL *dbc = connecto_to_db();
    MYSQL_STMT* search_stmt = mysql_prepared_query(search_query_string, param, dbc);

    MYSQL_RES* prepare_meta_result = mysql_stmt_result_metadata(search_stmt);
    if (!prepare_meta_result)
    {
        fprintf(stderr, " mysql_stmt_result_metadata(), returned no meta information\n");
        fprintf(stderr, " %s\n", mysql_stmt_error(search_stmt));
        return_data_struct.return_code = 1;
        return return_data_struct;
    // use bind structure and query_string to get data from query
    }

    int column_count= mysql_num_fields(prepare_meta_result);
    if (column_count != 1)
    {
        fprintf(stderr, " invalid column count returned by MySQL\n");
        return_data_struct.return_code = 1;
        return return_data_struct;
    }

    mysql_stmt_store_result(search_stmt);
    int num_rows = mysql_stmt_num_rows(search_stmt);
    mysql_stmt_close(search_stmt);

    char *query_string;
    MYSQL_BIND param_uoi[3];

    query_string = "REPLACE INTO node VALUES(?, ?, ?);";

    param_uoi[0].buffer_type = MYSQL_TYPE_VARCHAR;
    param_uoi[0].buffer = decrypted_hash;
    param_uoi[0].is_unsigned = 0;
    param_uoi[0].is_null = 0;
    param_uoi[0].length = &decrypted_size;

    param_uoi[1].buffer_type = MYSQL_TYPE_VARCHAR;
    param_uoi[1].buffer = ip_address;
    param_uoi[1].is_unsigned = 0;
    param_uoi[1].is_null = 0;
    param_uoi[1].length = &ip_address_len;

    param_uoi[2].buffer_type = MYSQL_TYPE_VARCHAR;
    param_uoi[2].buffer = pub_key;
    param_uoi[2].is_unsigned = 0;
    param_uoi[2].is_null = 0;
    param_uoi[2].length = &pub_key_len;

    MYSQL_STMT* update_or_insert_stmt = mysql_prepared_query(query_string, param_uoi, dbc);
    mysql_stmt_close(update_or_insert_stmt);

    MYSQL_BIND result_param[1];
    MYSQL_STMT* node_table_size_stmt = mysql_prepared_query("SELECT SUM(LENGTH(id) + LENGTH(public_key) + LENGTH(ip_address) + 3) AS table_size FROM node;", result_param, dbc);

    MYSQL_RES* prepare_meta_result_node_len = mysql_stmt_result_metadata(node_table_size_stmt);
    if (!prepare_meta_result_node_len)
    {
        fprintf(stderr, " mysql_stmt_result_metadata(), returned no meta information\n");
        fprintf(stderr, " %s\n", mysql_stmt_error(node_table_size_stmt));
        return_data_struct.return_code = 1;
        return return_data_struct;
    }

    int column_count_node_len= mysql_num_fields(prepare_meta_result_node_len);
    if (column_count_node_len != 1)
    {
        fprintf(stderr, " invalid column count returned by MySQL\n");
        return_data_struct.return_code = 1;
        return return_data_struct;
    }

    MYSQL_BIND result_bind[1];
    memset(result_bind, 0, sizeof(result_bind));

    bool result_is_null;
    unsigned long result_len;
    unsigned long long result_node_len;

    result_bind[0].buffer_type = MYSQL_TYPE_LONGLONG;
    result_bind[0].buffer = &result_node_len;
    result_bind[0].buffer_length = sizeof(result_node_len);
    result_bind[0].length = &result_len;
    result_bind[0].is_null = &result_is_null;

    if (mysql_stmt_bind_result(node_table_size_stmt, result_bind)) {
        fprintf(stderr, "mysql_stmt_bind_Result(), failed. Error:%s\n", mysql_stmt_error(node_table_size_stmt));
        return_data_struct.return_code = 1;
        return return_data_struct;
    }

    mysql_stmt_fetch(node_table_size_stmt);
    mysql_stmt_close(node_table_size_stmt);

    MYSQL_BIND node_table_fields_param[1];
    MYSQL_STMT* node_table_fields_stmt = mysql_prepared_query("SELECT * FROM node;", node_table_fields_param, dbc);

    MYSQL_RES* prepare_meta_result_node_fields = mysql_stmt_result_metadata(node_table_fields_stmt);
    if (!prepare_meta_result_node_fields)
    {
        fprintf(stderr, " mysql_stmt_result_metadata(), returned no meta information\n");
        fprintf(stderr, " %s\n", mysql_stmt_error(node_table_fields_stmt));
        return_data_struct.return_code = 1;
        return return_data_struct;
    }

    int column_count_node_fields= mysql_num_fields(prepare_meta_result_node_fields);
    if (column_count_node_fields != 3)
    {
        fprintf(stderr, " invalid column count returned by MySQL\n");
        return_data_struct.return_code = 1;
        return return_data_struct;
    }

    MYSQL_BIND node_fields_bind[3];
    memset(node_fields_bind, 0, sizeof(node_fields_bind));

    bool node_fields_is_null[3];
    unsigned long node_fields_len[3];
    char node_fields_id[129];
    char node_fields_ip_addr[16];
    char node_fields_pub_key[10000];

    node_fields_bind[0].buffer_type = MYSQL_TYPE_VAR_STRING;
    node_fields_bind[0].buffer = &node_fields_id;
    node_fields_bind[0].buffer_length = sizeof(node_fields_id);
    node_fields_bind[0].length = &node_fields_len[0];
    node_fields_bind[0].is_null = &node_fields_is_null[0];

    node_fields_bind[1].buffer_type = MYSQL_TYPE_VAR_STRING;
    node_fields_bind[1].buffer = &node_fields_ip_addr;
    node_fields_bind[1].buffer_length = sizeof(node_fields_ip_addr);
    node_fields_bind[1].length = &node_fields_len[1];
    node_fields_bind[1].is_null = &node_fields_is_null[1];

    node_fields_bind[2].buffer_type = MYSQL_TYPE_MEDIUM_BLOB;
    node_fields_bind[2].buffer = &node_fields_pub_key;
    node_fields_bind[2].buffer_length = sizeof(node_fields_pub_key);
    node_fields_bind[2].length = &node_fields_len[2];
    node_fields_bind[2].is_null = &node_fields_is_null[2];

    if (mysql_stmt_bind_result(node_table_fields_stmt, node_fields_bind)) {
        fprintf(stderr, "mysql_stmt_bind_Result(), failed. Error:%s\n", mysql_stmt_error(node_table_fields_stmt));
        return_data_struct.return_code = 1;
        return return_data_struct;
    }

    mysql_stmt_store_result(node_table_fields_stmt);
    int num_rows_node_fields = mysql_stmt_num_rows(node_table_fields_stmt);

    char *block_cluster = malloc(result_node_len);
    memset(block_cluster, 0, result_node_len);
    int cluster_length = 0;

    for(int i = 0; i < num_rows_node_fields; i++) {

        mysql_stmt_fetch(node_table_fields_stmt);

        memcpy(block_cluster + cluster_length, node_fields_id, node_fields_len[0]);
        cluster_length += 128;
        memcpy(block_cluster + cluster_length, node_fields_ip_addr, node_fields_len[1]);
        cluster_length += 15;
        memcpy(block_cluster + cluster_length, node_fields_pub_key, node_fields_len[2]);
        cluster_length += node_fields_len[2] + 1;
        
    }

    mysql_stmt_fetch(node_table_fields_stmt);
    mysql_stmt_close(node_table_fields_stmt);

    mysql_close(dbc);

    return_data_struct.return_code = 0;
    return_data_struct.data_num_of_bytes = result_node_len;
    return_data_struct.data = block_cluster;
    
    return return_data_struct;

}

struct return_data sync_blockchain() {

    // getting size of blockchain table
    struct return_data return_data_struct;
    MYSQL *dbc = connecto_to_db();

    MYSQL_BIND result_param[1];
    MYSQL_STMT* blockchain_table_size_stmt = mysql_prepared_query("SELECT SUM(LENGTH(timestamp) + LENGTH(hash_of_prev_block) + LENGTH(data_blob) + LENGTH(receiver_address) + LENGTH(sender_address) + 9) AS table_size FROM blockchain;", result_param, dbc);

    MYSQL_RES* prepare_meta_result_blockchain_len = mysql_stmt_result_metadata(blockchain_table_size_stmt);
    if (!prepare_meta_result_blockchain_len)
    {
        fprintf(stderr, " mysql_stmt_result_metadata(), returned no meta information\n");
        fprintf(stderr, " %s\n", mysql_stmt_error(blockchain_table_size_stmt));
        return_data_struct.return_code = 1;
        return return_data_struct;
    }

    int column_count_node_len= mysql_num_fields(prepare_meta_result_blockchain_len);
    if (column_count_node_len != 1)
    {
        fprintf(stderr, " invalid column count returned by MySQL\n");
        return_data_struct.return_code = 1;
        return return_data_struct;
    }

    MYSQL_BIND blockchain_len_result_bind[1];
    memset(blockchain_len_result_bind, 0, sizeof(blockchain_len_result_bind));

    bool blockchain_result_is_null;
    unsigned long blockchain_result_len;
    unsigned long long result_blockchain_len;

    blockchain_len_result_bind[0].buffer_type = MYSQL_TYPE_LONGLONG;
    blockchain_len_result_bind[0].buffer = &result_blockchain_len;
    blockchain_len_result_bind[0].buffer_length = sizeof(result_blockchain_len);
    blockchain_len_result_bind[0].length = &blockchain_result_len;
    blockchain_len_result_bind[0].is_null = &blockchain_result_is_null;

    if (mysql_stmt_bind_result(blockchain_table_size_stmt, blockchain_len_result_bind)) {
        fprintf(stderr, "mysql_stmt_bind_Result(), failed. Error:%s\n", mysql_stmt_error(blockchain_table_size_stmt));
        return_data_struct.return_code = 1;
        return return_data_struct;
    }

    mysql_stmt_fetch(blockchain_table_size_stmt);
    mysql_stmt_close(blockchain_table_size_stmt);

    char *block_cluster = malloc(result_blockchain_len);
    memset(block_cluster, 0, result_blockchain_len);

    // building block_cluster
    char query_string[500] = "SELECT UNIX_TIMESTAMP(timestamp), hash_of_prev_block, data_blob, receiver_address, sender_address, id FROM blockchain";
    MYSQL_BIND param[4];

    // use bind structure and query_string to get data from query
    MYSQL_STMT* prev_block_stmt = mysql_prepared_query(query_string, param, dbc);

    MYSQL_RES* prepare_meta_result = mysql_stmt_result_metadata(prev_block_stmt);
    if (!prepare_meta_result)
    {
        fprintf(stderr, " mysql_stmt_result_metadata(), returned no meta information\n");
        fprintf(stderr, " %s\n", mysql_stmt_error(prev_block_stmt));
        return_data_struct.return_code = 1;
        return return_data_struct;
    // use bind structure and query_string to get data from query
    }

    int column_count= mysql_num_fields(prepare_meta_result);
    if (column_count != 6)
    {
        fprintf(stderr, " invalid column count returned by MySQL\n");
        return_data_struct.return_code = 1;
        return return_data_struct;
    }

    MYSQL_BIND result_bind[9];
    memset(result_bind, 0, sizeof(result_bind));

    bool result_is_null[8];
    unsigned long result_len[8] = {0};
    char result_receiver_address[129] = {0};
    char result_sender_address[129] = {0};
    char result_data_blob[129] = {0};
    char result_hash[129] = {0};
    char result_timestamp[11] = {0};
    unsigned long result_id;

    result_bind[1].buffer_type = MYSQL_TYPE_VAR_STRING;
    result_bind[1].buffer = &result_timestamp;
    result_bind[1].buffer_length = sizeof(result_timestamp);
    result_bind[1].length = &result_len[6];
    result_bind[1].is_null = &result_is_null[6];

    result_bind[2].buffer_type = MYSQL_TYPE_VAR_STRING;
    result_bind[2].buffer = &result_hash;
    result_bind[2].buffer_length = sizeof(result_hash);
    result_bind[2].length = &result_len[1];
    result_bind[2].is_null = &result_is_null[1];

    result_bind[3].buffer_type = MYSQL_TYPE_MEDIUM_BLOB;
    result_bind[3].buffer = &result_data_blob;
    result_bind[3].buffer_length = sizeof(result_data_blob);
    result_bind[3].length = &result_len[2];
    result_bind[3].is_null = &result_is_null[2];

    result_bind[4].buffer_type = MYSQL_TYPE_VAR_STRING;
    result_bind[4].buffer = &result_receiver_address;
    result_bind[4].buffer_length = sizeof(result_receiver_address);
    result_bind[4].length = &result_len[4];
    result_bind[4].is_null = &result_is_null[4];

    result_bind[5].buffer_type = MYSQL_TYPE_VAR_STRING;
    result_bind[5].buffer = &result_sender_address;
    result_bind[5].buffer_length = sizeof(result_sender_address);
    result_bind[5].length = &result_len[5];
    result_bind[5].is_null = &result_is_null[5];

    result_bind[6].buffer_type = MYSQL_TYPE_LONG;
    result_bind[6].buffer = &result_id;
    result_bind[6].buffer_length = sizeof(result_id);
    result_bind[6].length = &result_len[7];
    result_bind[6].is_null = &result_is_null[7];

    if (mysql_stmt_bind_result(prev_block_stmt, result_bind)) {
        fprintf(stderr, "mysql_stmt_bind_Result(), failed. Error:%s\n", mysql_stmt_error(prev_block_stmt));
        exit(1);
    }

    mysql_stmt_store_result(prev_block_stmt);
    int num_rows = mysql_stmt_num_rows(prev_block_stmt);
    int cluster_length = 0;

    for(int i = 0; i < num_rows; i++) {

        mysql_stmt_fetch(prev_block_stmt);
        memcpy(block_cluster + cluster_length, &result_id, 8);
        cluster_length += 8;
        memcpy(block_cluster + cluster_length, result_timestamp, 10);
        cluster_length += 10;
        memcpy(block_cluster + cluster_length, result_hash, 128);
        cluster_length += 128;
        memcpy(block_cluster + cluster_length, result_sender_address, 128);
        cluster_length += 128;
        memcpy(block_cluster + cluster_length, result_receiver_address, 128);
        cluster_length += 128;
        memcpy(block_cluster + cluster_length, result_data_blob, result_len[7]);
        cluster_length += result_len[7] + 1;
        
    }

    return_data_struct.data = block_cluster;
    return_data_struct.data_num_of_bytes = cluster_length;
    return_data_struct.return_code = 0;

    //DEBUG
    for(int i = 0; i < cluster_length; i++) {
        printf("%02x", block_cluster[i]);
    }
    printf("\n");

    free(block_cluster);

    return return_data_struct;

    mysql_close(dbc);
    return_data_struct.return_code = 1;
    return return_data_struct;
}

struct return_data request_blockchain_sync(char *node_address) {

    // get hash of newest block
    struct return_data return_data_struct;
    MYSQL *dbc = connecto_to_db();
    MYSQL_BIND result_param[1];
    MYSQL_STMT* last_hash_stmt = mysql_prepared_query("SELECT hash_of_prev_block  FROM blockchain ORDER BY timestamp DESC LIMIT 1;", result_param, dbc);

    MYSQL_RES* prepare_meta_result_last_hash = mysql_stmt_result_metadata(last_hash_stmt);
    if (!prepare_meta_result_last_hash)
    {
        fprintf(stderr, " mysql_stmt_result_metadata(), returned no meta information\n");
        fprintf(stderr, " %s\n", mysql_stmt_error(last_hash_stmt));
        return_data_struct.return_code = 1;
        return return_data_struct;
    }

    int column_count_last_hash= mysql_num_fields(prepare_meta_result_last_hash);
    if (column_count_last_hash != 1)
    {
        fprintf(stderr, " invalid column count returned by MySQL\n");
        return_data_struct.return_code = 1;
        return return_data_struct;
    }

    MYSQL_BIND result_bind[1];
    memset(result_bind, 0, sizeof(result_bind));

    bool result_is_null;
    unsigned long result_len;
    char result_last_hash[129];

    result_bind[0].buffer_type = MYSQL_TYPE_STRING;
    result_bind[0].buffer = &result_last_hash;
    result_bind[0].buffer_length = sizeof(result_last_hash);
    result_bind[0].length = &result_len;
    result_bind[0].is_null = &result_is_null;

    if (mysql_stmt_bind_result(last_hash_stmt, result_bind)) {
        fprintf(stderr, "mysql_stmt_bind_Result(), failed. Error:%s\n", mysql_stmt_error(last_hash_stmt));
        return_data_struct.return_code = 1;
        return return_data_struct;
    }

    mysql_stmt_fetch(last_hash_stmt);
    mysql_stmt_close(last_hash_stmt);

    struct packet *request_packet = malloc(sizeof(struct packet));
    memcpy(request_packet->data_blob, result_last_hash, result_len);
    request_packet->data_blob_length = result_len;
    request_packet->query_id = 6;
    unsigned int timestamp = (unsigned int)time(NULL);
    sprintf(request_packet->timestamp, "%d", timestamp);
    memcpy(request_packet->receiver_address, local_key_hash, 128);
    memcpy(request_packet->sender_address, local_key_hash, 128);

    struct return_data request_answer = forward_query(node_address, request_packet, '\x06', 1);

    //DEBUG
    for(int i = 0; i < request_answer.data_num_of_bytes; i++) {
        printf("%02x", request_answer.data[i]);
    }
    printf("\n");

    return request_answer;

}