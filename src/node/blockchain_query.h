struct block_cluster {
    char *cluster;
    int cluster_length;
};

int create_new_block( char content[20268]) {

    MYSQL_BIND result_param[1];
    MYSQL_STMT* prev_block_stmt = mysql_prepared_query("SELECT id, hash_of_prev_block, content_for_receiver, content_for_sender, receiver_address, sender_address, UNIX_TIMESTAMP(timestamp) FROM blockchain ORDER BY id DESC LIMIT 1;", result_param);

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
    if (column_count != 7) /* validate column count */
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
    char result_content_for_sender[10001];
    char result_content_for_receiver[10001];
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
    result_bind[2].buffer = &result_content_for_receiver;
    result_bind[2].buffer_length = sizeof(result_content_for_receiver);
    result_bind[2].length = &result_len[2];
    result_bind[2].is_null = &result_is_null[2];

    result_bind[3].buffer_type = MYSQL_TYPE_MEDIUM_BLOB;
    result_bind[3].buffer = &result_content_for_sender;
    result_bind[3].buffer_length = sizeof(result_content_for_sender);
    result_bind[3].length = &result_len[3];
    result_bind[3].is_null = &result_is_null[3];

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

    result_bind[6].buffer_type = MYSQL_TYPE_VAR_STRING;
    result_bind[6].buffer = &result_timestamp;
    result_bind[6].buffer_length = sizeof(result_timestamp);
    result_bind[6].length = &result_len[6];
    result_bind[6].is_null = &result_is_null[6];

    if (mysql_stmt_bind_result(prev_block_stmt, result_bind)) {
        fprintf(stderr, "mysql_stmt_bind_Result(), failed. Error:%s\n", mysql_stmt_error(prev_block_stmt));
        exit(1);
    }

    mysql_stmt_fetch(prev_block_stmt);
         
    char prev_block[20414] = "";

    strcat(prev_block, result_id);
    strcat(prev_block, result_timestamp);
    strcat(prev_block, result_hash);
    strcat(prev_block, result_content_for_receiver);
    strcat(prev_block, result_content_for_sender);
    strcat(prev_block, result_receiver_address);
    strcat(prev_block, result_sender_address);

    printf("%s\n", prev_block);

    char *prev_block_hash = get_sha512_string(prev_block);

    char* query_string = "INSERT INTO blockchain(timestamp, content_for_receiver, content_for_sender, receiver_address, sender_address, hash_of_prev_block) VALUES(FROM_UNIXTIME(?), ?, ?, ?, ?, ?);";
    
    char timestamp[11], content_for_receiver[10001], content_for_sender[10001], receiver_address[129], sender_address[129];
    int content_len = (strnlen(content, 20268) - 266) / 2;

    strncpy(timestamp, content, 10);
    strncpy(receiver_address, content + 10, 128);
    strncpy(sender_address, content + 138, 128);
    strncpy(content_for_receiver, content + 266, content_len);
    strncpy(content_for_sender, content + 266 + content_len, content_len);

    long timestamp_length = 10;
    long content_for_receiver_length = content_len;
    long content_for_sender_length = content_len;
    long receiver_address_length = 128;
    long sender_address_length = 128;
    long prev_block_hash_length = 128;

    MYSQL_BIND param[6];
    param[0].buffer_type = MYSQL_TYPE_VARCHAR;
    param[0].buffer = timestamp;
    param[0].is_unsigned = 0;
    param[0].is_null = 0;
    param[0].length = &timestamp_length;

    param[1].buffer_type = MYSQL_TYPE_VARCHAR;
    param[1].buffer = content_for_receiver;
    param[1].is_unsigned = 0;
    param[1].is_null = 0;
    param[1].length = &content_for_receiver_length;

    param[2].buffer_type = MYSQL_TYPE_VARCHAR;
    param[2].buffer = content_for_sender;
    param[2].is_unsigned = 0;
    param[2].is_null = 0;
    param[2].length = &content_for_sender_length;

    param[3].buffer_type = MYSQL_TYPE_VARCHAR;
    param[3].buffer = receiver_address;
    param[3].is_unsigned = 0;
    param[3].is_null = 0;
    param[3].length = &receiver_address_length;

    param[4].buffer_type = MYSQL_TYPE_VARCHAR;
    param[4].buffer = sender_address;
    param[4].is_unsigned = 0;
    param[4].is_null = 0;
    param[4].length = &sender_address_length;

    param[5].buffer_type = MYSQL_TYPE_VARCHAR;
    param[5].buffer = prev_block_hash;
    param[5].is_unsigned = 0;
    param[5].is_null = 0;
    param[5].length = &prev_block_hash_length;

    mysql_prepared_query( query_string, param);


    return 0;

}

struct block_cluster search_blockchain( char content[20396]) {
 
    char timestamp[11], content_for_receiver[10001], content_for_sender[10001], receiver_address[129], sender_address[129], prev_block_hash[129];
    unsigned long content_len = strnlen(content + 394, 20000) / 2;
    char zero_buffer[128] = {0};
    int num_of_parameters = 0;
    long prev_block_hash_length = 128;

    memcpy(timestamp, content, 10);
    memcpy(prev_block_hash, content + 10, 128);
    memcpy(receiver_address, content + 138, 128);
    memcpy(sender_address, content + 266, 128);
    memcpy(content_for_receiver, content + 394, content_len);
    memcpy(content_for_sender, content + 394 + content_len, content_len);

    unsigned long timestamp_length = 10;

    char query_string[500] = "SELECT id, UNIX_TIMESTAMP(timestamp), hash_of_prev_block, content_for_receiver, content_for_sender, receiver_address, sender_address, LENGTH(content_for_receiver), LENGTH(content_for_sender) FROM blockchain";
    MYSQL_BIND param[6];

    if(memcmp(zero_buffer, timestamp, 10) != 0) {

        strcat(query_string, " WHERE timestamp = FROM_UNIXTIME(?)");

        param[num_of_parameters].buffer_type = MYSQL_TYPE_VARCHAR;
        param[num_of_parameters].buffer = timestamp;
        param[num_of_parameters].is_unsigned = 0;
        param[num_of_parameters].is_null = 0;
        param[num_of_parameters].length = &timestamp_length;

        num_of_parameters++;

    }

    if(memcmp(zero_buffer, prev_block_hash, 128) != 0) {

        if(num_of_parameters > 0) {
            strcat(query_string, " AND");
        } else {
            strcat(query_string, " WHERE");
        }

        strcat(query_string, " hash_of_prev_block = ?");
        
        unsigned long  prev_block_hash_length = 128;
        
        param[num_of_parameters].buffer_type = MYSQL_TYPE_VARCHAR;
        param[num_of_parameters].buffer = prev_block_hash;
        param[num_of_parameters].is_unsigned = 0;
        param[num_of_parameters].is_null = 0;
        param[num_of_parameters].length = &prev_block_hash_length;

        num_of_parameters++;

    }

    if(memcmp(zero_buffer, receiver_address, 128) != 0) {

        if(num_of_parameters > 0) {
            strcat(query_string, " AND");
        } else {
            strcat(query_string, " WHERE");
        }
        
        strcat(query_string, " receiver_address = ?");

        unsigned long  receiver_address_length = 128;
        
        param[num_of_parameters].buffer_type = MYSQL_TYPE_VARCHAR;
        param[num_of_parameters].buffer = receiver_address;
        param[num_of_parameters].is_unsigned = 0;
        param[num_of_parameters].is_null = 0;
        param[num_of_parameters].length = &receiver_address_length;

        num_of_parameters++;

    }

    if(memcmp(zero_buffer, sender_address, 128) != 0) {

        if(num_of_parameters > 0) {
            strcat(query_string, " AND");
        } else {
            strcat(query_string, " WHERE");
        }
        
        strcat(query_string, " sender_address = ?");

        unsigned long  sender_address_length = 128;
        
        param[num_of_parameters].buffer_type = MYSQL_TYPE_VARCHAR;
        param[num_of_parameters].buffer = sender_address;
        param[num_of_parameters].is_unsigned = 0;
        param[num_of_parameters].is_null = 0;
        param[num_of_parameters].length = &sender_address_length;

        num_of_parameters++;

    }
    
    if(memcmp(zero_buffer, content_for_receiver, content_len) != 0) {

        if(num_of_parameters > 0) {
            strcat(query_string, " AND");
        } else {
            strcat(query_string, " WHERE");
        }
        
        strcat(query_string, " content_for_receiver = ?");
        
        param[num_of_parameters].buffer_type = MYSQL_TYPE_VARCHAR;
        param[num_of_parameters].buffer = content_for_receiver;
        param[num_of_parameters].is_unsigned = 0;
        param[num_of_parameters].is_null = 0;
        param[num_of_parameters].length = &content_len;

        num_of_parameters++;

    }

    if(memcmp(zero_buffer, content_for_sender, content_len) != 0) {

        if(num_of_parameters > 0) {
            strcat(query_string, " AND");
        } else {
            strcat(query_string, " WHERE");
        }
        
        strcat(query_string, " content_for_sender = ?");
                
        param[num_of_parameters].buffer_type = MYSQL_TYPE_VARCHAR;
        param[num_of_parameters].buffer = content_for_sender;
        param[num_of_parameters].is_unsigned = 0;
        param[num_of_parameters].is_null = 0;
        param[num_of_parameters].length = &content_len;

        num_of_parameters++;

    }

    strcat(query_string, ";");
    printf("%s\n", query_string);

    // use bind structure and query_string to get data from query
    MYSQL_STMT* prev_block_stmt = mysql_prepared_query(query_string, param);

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
    if (column_count != 9) /* validate column count */
    {
        fprintf(stderr, " invalid column count returned by MySQL\n");
        exit(1);
    }

    /* Bind single result column, expected to be a double. */
    MYSQL_BIND result_bind[9];
    memset(result_bind, 0, sizeof(result_bind));

    char result_id[21] = {0};
    bool result_is_null[8];
    unsigned long result_len[8] = {0};
    char result_content_for_sender[10001] = {0};
    char result_content_for_receiver[10001] = {0};
    char result_receiver_address[129] = {0};
    char result_sender_address[129] = {0};
    char result_hash[129] = {0};
    char result_timestamp[11] = {0};
    int content_for_receiver_length;
    int content_for_sender_length;

    result_bind[0].buffer_type = MYSQL_TYPE_VAR_STRING;
    result_bind[0].buffer = &result_id;
    result_bind[0].buffer_length = sizeof(result_id);
    result_bind[0].length = &result_len[0];
    result_bind[0].is_null = &result_is_null[0];

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
    result_bind[3].buffer = &result_content_for_receiver;
    result_bind[3].buffer_length = sizeof(result_content_for_receiver);
    result_bind[3].length = &result_len[2];
    result_bind[3].is_null = &result_is_null[2];

    result_bind[4].buffer_type = MYSQL_TYPE_MEDIUM_BLOB;
    result_bind[4].buffer = &result_content_for_sender;
    result_bind[4].buffer_length = sizeof(result_content_for_sender);
    result_bind[4].length = &result_len[3];
    result_bind[4].is_null = &result_is_null[3];

    result_bind[5].buffer_type = MYSQL_TYPE_VAR_STRING;
    result_bind[5].buffer = &result_receiver_address;
    result_bind[5].buffer_length = sizeof(result_receiver_address);
    result_bind[5].length = &result_len[4];
    result_bind[5].is_null = &result_is_null[4];

    result_bind[6].buffer_type = MYSQL_TYPE_VAR_STRING;
    result_bind[6].buffer = &result_sender_address;
    result_bind[6].buffer_length = sizeof(result_sender_address);
    result_bind[6].length = &result_len[5];
    result_bind[6].is_null = &result_is_null[5];

    result_bind[7].buffer_type = MYSQL_TYPE_LONG;
    result_bind[7].buffer = &content_for_receiver_length;
    result_bind[7].buffer_length = sizeof(content_for_receiver_length);
    result_bind[7].length = &result_len[6];
    result_bind[7].is_null = &result_is_null[6];

    result_bind[8].buffer_type = MYSQL_TYPE_LONG;
    result_bind[8].buffer = &content_for_sender_length;
    result_bind[8].buffer_length = sizeof(content_for_sender_length);
    result_bind[8].length = &result_len[7];
    result_bind[8].is_null = &result_is_null[7];

    if (mysql_stmt_bind_result(prev_block_stmt, result_bind)) {
        fprintf(stderr, "mysql_stmt_bind_Result(), failed. Error:%s\n", mysql_stmt_error(prev_block_stmt));
        exit(1);
    }

    mysql_stmt_store_result(prev_block_stmt);
    int num_rows = mysql_stmt_num_rows(prev_block_stmt);

    char *block_cluster = malloc(sizeof(char) * 40414 * num_rows);
    memset(block_cluster, 0, sizeof(char) * 20414 * num_rows);
    int cluster_length = 0;

    for(int i = 0; i < num_rows; i++) {

        mysql_stmt_fetch(prev_block_stmt);

        char result_content_for_receiver_escaped[content_for_receiver_length * 2];
        char result_content_for_sender_escaped[content_for_sender_length * 2];
        int result_content_for_receiver_escaped_offset = 0;
        int result_content_for_sender_escaped_offset = 0;

        memset(result_content_for_receiver_escaped, 0, content_for_receiver_length * 2);
        memset(result_content_for_sender_escaped, 0, content_for_sender_length * 2);

        for(int j = 0; j < content_for_receiver_length; j++) {
            if(result_content_for_receiver[j] != 0) {
                result_content_for_receiver_escaped[j + result_content_for_receiver_escaped_offset] = result_content_for_receiver[j];
            } else {
                result_content_for_receiver_escaped[j + result_content_for_receiver_escaped_offset] = 92;
                result_content_for_receiver_escaped_offset++;
                result_content_for_receiver_escaped[j + result_content_for_receiver_escaped_offset] = result_content_for_receiver[j];
            }
        }

        for(int j = 0; j < content_for_sender_length; j++) {
            if(result_content_for_sender[j] != 0) {
                result_content_for_sender_escaped[j + result_content_for_sender_escaped_offset] = result_content_for_sender[j];
            } else {
                result_content_for_sender_escaped[j + result_content_for_sender_escaped_offset] = 92;
                result_content_for_sender_escaped_offset++;
                result_content_for_sender_escaped[j + result_content_for_sender_escaped_offset] = result_content_for_sender[j];
            }
        }

        memcpy(block_cluster + cluster_length, result_timestamp, 10);
        memcpy(block_cluster + cluster_length + 11, result_hash, 128);
        memcpy(block_cluster + cluster_length + 140, result_receiver_address, 128);
        memcpy(block_cluster + cluster_length + 269, result_receiver_address, 128);
        memcpy(block_cluster + cluster_length + 398, result_content_for_receiver_escaped, content_for_receiver_length + result_content_for_receiver_escaped_offset);
        memcpy(block_cluster + cluster_length + 399 + content_for_receiver_length + result_content_for_receiver_escaped_offset, result_content_for_sender_escaped, content_for_sender_length + result_content_for_sender_escaped_offset);

        cluster_length += 400 + content_for_receiver_length + result_content_for_receiver_escaped_offset + content_for_sender_length + result_content_for_sender_escaped_offset;
        
    }

    struct block_cluster cluster;

    cluster.cluster = block_cluster;
    cluster.cluster_length = cluster_length;

    free(block_cluster);

    return cluster;

}

int add_block_to_queue(struct packet source_packet) {

    int i = 0;
    bool block_added = false;

    while(i < BLOCK_QUEUE_LENGTH && !block_added){
        if(!block_queue[i]) {
            block_added = true;

            block_queue[i] = &source_packet;

            printf("[i] Added block to queue!\n[i] block_queue_current_index: %d\n", i);

        }

        i++;
    }

    printf("%s\n", source_packet.timestamp);

    if(!block_added) {
        
        printf("[!] Queue is full!\n");
        return -1;

    }

    return 0;

}