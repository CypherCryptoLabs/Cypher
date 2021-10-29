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

    unsigned char *encrypted_file = malloc(1024);
    int encrypted_buffer_size = private_encrypt(pub_key_hash, pub_key_hash_num_bytes, privkey_buffer, encrypted_file);

    if(encrypted_buffer_size == -1){
        printLastError("Private Decrypt failed ");
        exit(0);
    }

    int num_of_null_bytes = 0;
    for(int i = 0; i < encrypted_buffer_size; i++) {
        if(encrypted_file[i] == '\x00') {
            num_of_null_bytes++;
        }
    }

    int offset = 0;
    unsigned char *encrypted_file_escaped = malloc(encrypted_buffer_size + num_of_null_bytes);
    for(int i = 0; i < encrypted_buffer_size + num_of_null_bytes; i++) {
        if(encrypted_file[i] == '\x00') {
            encrypted_file_escaped[i + offset] = '\\';
            offset++;
            encrypted_file_escaped[i + offset] = '\x00';
        } else {
            encrypted_file_escaped[i + offset] = encrypted_file[i];
        }
    }

    unsigned char *decrypted_file = malloc(encrypted_buffer_size);
    int decrypted_buffer_size = public_decrypt(encrypted_file, encrypted_buffer_size, pubkey_buffer, decrypted_file);

    if(decrypted_buffer_size == -1){
        printLastError("Private Decrypt failed ");
        exit(0);
    }

    if(strcmp(decrypted_file, pub_key_hash) == 0) {
        printf("encryption and decryption successful!\n");
    } else {
        printf("ERROR: Something went wrong! decrypted_file != encrypted_file\n");
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
    memcpy(packet_buffer + 267 + pubkey_numbytes, encrypted_file_escaped, encrypted_buffer_size + offset);

    for (int i = 0; i < 268 + pubkey_numbytes + encrypted_buffer_size; i++) {
        printf("%02X", packet_buffer[i]);
    }
    printf("\n\n");

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

    // registering node to network
    register_to_network();

}