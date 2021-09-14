struct filtered_queue {
    int queue_length;
    char *queue[BLOCK_QUEUE_LENGTH];
};

struct filtered_queue sort_queue_by_timestamp( char *timestamp ) {

    // filtering block_queue for all blocks with specified timestamp

    char** filtered_block_queue = malloc(sizeof(char*) * BLOCK_QUEUE_LENGTH);
    memset(filtered_block_queue, 0, sizeof(**filtered_block_queue));
    int filtered_block_queue_index = 0;
    char block_queue_timestamp[10] = {0};

    for(int i = 0; i < BLOCK_QUEUE_LENGTH; i++) {
        if(block_queue[i]) {
            if(strncmp(block_queue[i], timestamp, 10) == 0) {
                filtered_block_queue[filtered_block_queue_index] = block_queue[i];
                filtered_block_queue_index++;
                //printf("--%s\n", filtered_block_queue[filtered_block_queue_index-1]);
            }
        }
    }

    // sorting filtered_block_queue
    char temp[14701] = "";

    for(int i=0;i<filtered_block_queue_index-1;i++) {
        for(int j=i+1;j<=filtered_block_queue_index-1;j++){
            if(strcmp(filtered_block_queue[i],filtered_block_queue[j])>0){
                strcpy(temp,filtered_block_queue[i]);
                strcpy(filtered_block_queue[i],filtered_block_queue[j]);
                strcpy(filtered_block_queue[j],temp);
            }
        }
    }

    struct filtered_queue queue;

    queue.queue_length = filtered_block_queue_index;
    *queue.queue = *filtered_block_queue;

    return queue;

}

void clean_queue(char *timestamp) {

    for (int i = 0; i < BLOCK_QUEUE_LENGTH; i++){
        if(block_queue[i] && strncmp(block_queue[i], timestamp, 10) <= 0) {
            block_queue[i] = NULL;
        }
    } 
    
}