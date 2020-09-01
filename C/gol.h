struct universe {
	int width;
	int height;
	int generation;
	int *alive_per_generation;
	int alive_per_generation_size;
	char **grid;
};

/*Do not modify the next seven lines*/
void read_in_file(FILE *infile, struct universe *u);
void write_out_file(FILE *outfile, struct universe *u);
int is_alive(struct universe *u, int column, int row);
int will_be_alive(struct universe *u, int column, int row);
int will_be_alive_torus(struct universe *u,  int column, int row);
void evolve(struct universe *u, int (*rule)(struct universe *u, int column, int row));
void print_statistics(struct universe *u);
/*You can modify after this line again*/

typedef struct universe Universe;

