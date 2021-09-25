char * get_sha512_string( char content[21024] ) {

    SHA512_CTX ctx;
    unsigned char buffer[21024] = {0};
    char *hash_as_string = (char *)malloc(SHA512_DIGEST_LENGTH * 2);
    int len = strnlen(content, 21024);

    strcpy(buffer,content);

    SHA512_Init(&ctx);
    SHA512_Update(&ctx, buffer, len);
    SHA512_Final(buffer, &ctx);

    for (int i = 0; i < SHA512_DIGEST_LENGTH; i++) {
        sprintf(&hash_as_string[2 * i], "%02x", buffer[i]);
    }

    return hash_as_string;

}