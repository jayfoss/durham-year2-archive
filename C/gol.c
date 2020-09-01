#include<stdio.h>
#include<stdlib.h>
#include<string.h>
#include<unistd.h>
#include "gol.h"
void read_in_file(FILE *infile, struct universe *u) {
	u->height = 0;
	u->width = 0;
	u->generation = 0;
	u->alive_per_generation_size = 0;
	u->alive_per_generation = NULL;
	u->grid = NULL;
	char buffer[512];
	char charBuffer;
	int loc = -1;
	int max_height = 1;
	while (fscanf(infile, "%c", &charBuffer) != EOF) {
		if(charBuffer != '\n' && charBuffer != '*' && charBuffer != '.') {
			fprintf(stderr, "Bad character %i in file, on row %i\n", charBuffer, u->height);
			exit(3);
		}
		if(charBuffer != '\n') {
			loc++;
			if(loc >= 512) {
				fprintf(stderr, "Row %i exceeds maximum column count of 512\n", u->height);
				exit(3);
			}
			buffer[loc] = charBuffer;
			continue;
		}
		u->height++;
		if(u->height == max_height) {
			int new_height = max_height * 2;
			char **new_grid = (char **) realloc(u->grid, new_height * sizeof(*(u->grid)));
			if(new_grid == NULL) {
				fprintf(stderr, "Failed to allocate memory\n");
				exit(1);
			}
			max_height = new_height;
			u->grid = new_grid;
		}
		if(u->height == 1) {
			u->width = loc + 1;
		}
		else {
			if(loc + 1 != u->width) {
				fprintf(stderr, "Found row of different length\n");
				exit(3);
			}
		}
		u->grid[u->height - 1] = (char *) malloc((loc + 1) * sizeof(char));
		if(u->grid[u->height - 1] == NULL) {
			fprintf(stderr, "Failed to allocate memory\n");
			exit(1);
		}
		memcpy(u->grid[u->height - 1], buffer, (loc + 1) * sizeof(char));
		loc = -1;
	}
	char **new_grid = (char **) realloc(u->grid, u->height * sizeof(*(u->grid)));
	if(new_grid == NULL) {
		fprintf(stderr, "Failed to allocate memory\n");
		exit(1);
	}
	u->grid = new_grid;
}

void write_out_file(FILE *outfile, struct universe *u) {
	for(int i = 0; i < u->height; i++) {
		for(int j = 0; j < u->width; j++) {
			fprintf(outfile, "%c", u->grid[i][j]);
	    }
		fprintf(outfile, "%s", "\n");
	}
}

int is_alive(struct universe *u, int column, int row) {
	if(column < 0 || column >= u->width) {
		fprintf(stderr, "Invalid column\n");
		exit(2);
	}
	if(row < 0 || row >= u->height) {
		fprintf(stderr, "Invalid row\n");
		exit(2);
	}
	return u->grid[row][column] == '*';
}

int will_be_alive(struct universe *u, int column, int row) {
	int alive_count = 0;
	for(int i = row - 1; i <= row + 1; i++) {
		for(int j = column - 1; j <= column + 1; j++) {
			if(i == row && j == column) continue;
			if(i < 0 || i >= u->height) continue;
			if(j < 0 || j >= u->width) continue;
			
			alive_count += is_alive(u, j, i);
		}
	}
	if(is_alive(u, column, row) && (alive_count == 2 || alive_count == 3)) return 1;
	if(!is_alive(u, column, row) && alive_count == 3) return 1;
	return 0;
}

int will_be_alive_torus(struct universe *u, int column, int row) {
	int alive_count = 0;
	for(int i = row - 1; i <= row + 1; i++) {
		for(int j = column - 1; j <= column + 1; j++) {
			if(i == row && j == column) continue;

			alive_count += is_alive(u, (j % u->width + u->width) % u->width, (i % u->height + u->height) % u->height);
		}
	}
	if(is_alive(u, column, row) && (alive_count == 2 || alive_count == 3)) return 1;
	if(!is_alive(u, column, row) && alive_count == 3) return 1;
	return 0;
}

void evolve(struct universe *u, int (*rule)(struct universe *u, int column, int row)) {
	char **new_grid = (char **) malloc(u->height * sizeof(*(u->grid)));
	if(new_grid == NULL) {
		fprintf(stderr, "Failed to allocate memory\n");
		exit(1);
	}
	for(int i = 0; i < u->height; i++) {
		new_grid[i] = (char *) malloc(u->width * sizeof(char));
		if(new_grid[i] == NULL) {
			fprintf(stderr, "Failed to allocate memory\n");
			exit(1);
		}
	}
	int alive_count = 0;
	for(int i = 0; i < u->height; i++) {
		for(int j = 0; j < u->width; j++) {
			new_grid[i][j] = (*rule)(u, j, i) ? '*' : '.';
			alive_count += is_alive(u, j, i);
		}
	}
	if(u->generation == u->alive_per_generation_size) {
		if(u->alive_per_generation_size == 0) {
			u->alive_per_generation_size = 1;
		}
		int *new_alive_per_generation = (int *) realloc(u->alive_per_generation, u->alive_per_generation_size * 2 * sizeof(int));
		if(new_alive_per_generation == NULL) {
			fprintf(stderr, "Failed to allocate memory\n");
			return;
		}
		u->alive_per_generation_size *= 2;
		u->alive_per_generation = new_alive_per_generation;
	}
	u->alive_per_generation[u->generation] = alive_count;
	for(int i = 0; i < u->height; i++) {
		free(u->grid[i]);
	}
	free(u->grid);
	u->generation += 1;
	u->grid = new_grid;
}

void print_statistics(struct universe *u) {
	int alive_count = 0;
	for(int i = 0; i < u->height; i++) {
		for(int j = 0; j < u->width; j++) {
			alive_count += is_alive(u, j, i);
		}
	}
	float alive_percent = (alive_count / ((float) u->width * (float) u->height)) * 100;
	float average_alive_percent = alive_percent;
	for(int i = 0; i < u->generation; i++) {
		average_alive_percent += ((u->alive_per_generation[i] / ((float) u->width * (float) u->height)) * 100);
	}
	average_alive_percent /= ((float) (u->generation + 1));
	printf("%3.3f%% %s\n", alive_percent, "of cells currently alive");
	printf("%3.3f%% %s\n", average_alive_percent, "of cells alive on average");
}
