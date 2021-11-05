static MYSQL* connecto_to_db() {

    MYSQL *con = malloc(sizeof(MYSQL));
    con = mysql_init(NULL);

    if (con == NULL){
        printf("%s\n", mysql_error(con));
        exit(1);
    }

    if (mysql_real_connect(con, MYSQL_HOST, MYSQL_USER, MYSQL_PASSWD, MYSQL_DB, 0, NULL, 0) == NULL) {
        printf("%s\n", mysql_error(con));
        mysql_close(con);
        exit(1);
    }

    return con;

}

MYSQL_STMT* mysql_prepared_query(char *query_string, MYSQL_BIND* param, MYSQL *dbc) {

    MYSQL_STMT *stmt;

    // Allocate a statement handle
    stmt = mysql_stmt_init(dbc);
    if(stmt == NULL) {
        printf("%s\n", mysql_error(dbc));
        printf("%s\n", mysql_stmt_error(stmt));
        printf("Unable to create new session: Could not init statement handle\n");
    }

    // Init
    if(mysql_stmt_prepare(stmt, query_string, strlen(query_string)) != 0) {
        printf("%s\n", mysql_error(dbc));
        printf("%s\n", mysql_stmt_error(stmt));
        printf("Unable to create new session: Could not prepare statement\n");
    }

    // Bind param structure to statement
    if(mysql_stmt_bind_param(stmt, param) != 0) {
        printf("%s\n", mysql_error(dbc));
        printf("%s\n", mysql_stmt_error(stmt));
        printf("Unable to create new session: Could not bind parameters\n");
    }

    // Execute prepared statement
    if(mysql_stmt_execute(stmt) != 0) {
        printf("%s\n", mysql_error(dbc));
        printf("Unable to create new session: Could not execute statement\n");
        printf("%s\n", mysql_stmt_error(stmt));
    }

    //mysql_stmt_close(stmt);
    //mysql_stmt_free_result(stmt);

    return stmt;
   
}