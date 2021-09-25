struct filtered_queue {
    int queue_length;
    struct packet *queue[BLOCK_QUEUE_LENGTH];
};

static int packetcmp(struct packet *packet_1, struct packet *packet_2) {

    int return_value = 0; // will be negative when packet_1 has higher value, positive when packet_2 has the higher value, and 0 when they have the same value

    return_value = strcmp(packet_1->sender_address, packet_2->sender_address);

    if(return_value == 0)
        return_value = strcmp(packet_1->receiver_address, packet_2->receiver_address);
    
    if(return_value == 0)
        return_value = strcmp(packet_1->sender_content, packet_2->sender_content);
    
    if(return_value == 0)
        return_value = strcmp(packet_1->receiver_content, packet_2->receiver_content);

    return return_value;    

}

struct filtered_queue *sort_queue_by_timestamp( char *timestamp ) {

    // filtering block_queue for all blocks with specified timestamp

    struct packet *filtered_block_queue[BLOCK_QUEUE_LENGTH] = {0};
    //memset(filtered_block_queue, 0, sizeof(*filtered_block_queue));
    int filtered_block_queue_index = 0;
    char block_queue_timestamp[10] = {0};

    for(int i = 0; i < BLOCK_QUEUE_LENGTH; i++) {
        if(block_queue[i]) {
            if(strncmp(block_queue[i]->timestamp, timestamp, 10) == 0) {
                filtered_block_queue[filtered_block_queue_index] = block_queue[i];
                filtered_block_queue_index++;
            }
        }
    }

    // sorting filtered_block_queue
    struct packet *temp = {0};

    for(int i=0;i<filtered_block_queue_index-1;i++) {
        for(int j=i+1;j<=filtered_block_queue_index-1;j++){
            if(packetcmp(filtered_block_queue[i],filtered_block_queue[j])>0){
                temp = filtered_block_queue[i];
                filtered_block_queue[i] = filtered_block_queue[j];
                filtered_block_queue[j] = temp;
            }
        }
    }

    struct filtered_queue *queue = malloc(sizeof(struct filtered_queue));
    memset(queue, 0, sizeof(queue));

    queue->queue_length = filtered_block_queue_index;
    *queue->queue = *filtered_block_queue;

    return queue;

}

void clean_queue(char *timestamp) {

    /*for (int i = 0; i < BLOCK_QUEUE_LENGTH; i++){
        if(block_queue[i] && strncmp(block_queue[i], timestamp, 10) <= 0) {
            block_queue[i] = NULL;
        }
    } */
    
}