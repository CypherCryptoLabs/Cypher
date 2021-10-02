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

void init_node() {
    // This function is used to set up everything needed by the node
    char *public_key_filename = "public.pem";
    char *private_key_filename = "private.pem";
    
    if(!file_exists(public_key_filename) || !file_exists(private_key_filename)) {
        printf("[i] Either public- or private key is missing. Generating new keypair!\n");
        generate_keypair();
    }

}