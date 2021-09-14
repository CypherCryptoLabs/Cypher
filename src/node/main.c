#include "headers.h"

int main(int argc, char const *argv[]) {

    printf("CYPHER NODE V%d.%d.%d%s\n", RELEASE, PATCH, FIX, EXTRAVERSION);
    printf("MySQL client version: %s\n\n", mysql_get_client_info());
    printf("[i] Starting node... \n");

    printf("[i] Starting queue_worker...\n");
    pthread_t queue_handler_ptid;
    pthread_create(&queue_handler_ptid, 0, queue_handler, NULL);

    printf("[i] starting connection handler...\n");
    pthread_t connection_handler_ptid;
    pthread_create(&connection_handler_ptid, 0, connection_handler, NULL);
    
    pthread_join(connection_handler_ptid, NULL);
    pthread_join(queue_handler_ptid, NULL);

    return 0;

}