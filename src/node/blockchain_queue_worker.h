void * queue_worker() {    

    char timestamp_as_string[10];
    unsigned int timestamp = (unsigned int)time(NULL) - BLOCK_QUEUE_DELAY;
    sprintf(timestamp_as_string, "%d", timestamp);
    struct filtered_queue *queue = sort_queue_by_timestamp(timestamp_as_string);

    MYSQL *dbc = connecto_to_db();

    for(int i = 0; i < queue->queue_length; i++) {
        if(queue->queue[i]) {
            create_new_block(queue->queue[i], dbc);
        }
    }
    
    clean_queue(timestamp_as_string);

}

void * queue_handler() {

    printf("[i] block_queue pointer: %p\n", block_queue);

    while(1) {
        sleep(BLOCK_QUEUE_WORKER_INTERVAL);

        pthread_t queue_filter_ptid;
        pthread_create(&queue_filter_ptid, 0, queue_worker, NULL);

    }

}