bool is_cypher_transaction(struct packet *block) {

    char *block_protocol_identifyier = malloc(5);
    memcpy(block_protocol_identifyier, block->data_blob, 4);

    if(strcmp(block_protocol_identifyier, "CPHR") == 0 && block->data_blob_length == 9) {
        return 1;
    }

    return 0;

}

bool verify_cypher_transaction(struct packet *block) {
    
    double balance_for_address = 0;
    

}