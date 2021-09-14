void write_to_blockcahin(char *data, int length, FILE* blockchain_file_pointer) {

    strcat(data, "\n");
    fwrite(data, length + 1, 1, blockchain_file_pointer);

    /*char* query_string = "INSERT INTO blockchain(timestamp, content_for_receiver, content_for_sender, receiver_address, sender_address) VALUES(FROM_UNIXTIME(?), ?, ?, ?, ?);";
    
    char* timestamp = "0000000001";
    char* content_for_receiver = "AAA";
    char* content_for_sender = "AAA";
    char* receiver_address = "AAA";
    char* sender_address = "AAA";

    long timestamp_length = strnlen(timestamp, 10);
    long content_for_receiver_length = strnlen(content_for_receiver, 1000);
    long content_for_sender_length = strnlen(content_for_sender, 1000);
    long receiver_address_length = strnlen(receiver_address, 64);
    long sender_address_length = strnlen(sender_address, 64);

    MYSQL_BIND param[5];
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
    
    mysql_prepared_query( query_string, param);*/

}

char * get_previous_block() {

    FILE *blockchain_file;
    char c;
    char *block = NULL;
    int block_len = 0;

    blockchain_file = fopen("blockchain.cypher", "r");
    fseek(blockchain_file, -2, SEEK_END);

    c = fgetc(blockchain_file);

    while(c != '\n') {

        fseek(blockchain_file, -2, SEEK_CUR);
        block_len++;
        c = fgetc(blockchain_file);

    }

    block = calloc(block_len+1, sizeof(char));
    fread(block, block_len, 1, blockchain_file);
    fclose(blockchain_file);

    return block;

}