#include<stdio.h>
#include<stdlib.h>
#include<string.h>
#include"gol.h"
int main(int argc, char *argv[]){
	int number_of_generations = 5;
	int print_stats = 0;
	int torus_topology = 0;
	FILE *input_file = stdin;
	FILE *output_file = stdout;
	char *iFile = NULL;
	char *oFile = NULL;
	int gUsed = 0;
	for(int i = 1; i < argc; i++) {
		if(argv[i][0] != '-' || strlen(argv[i]) < 2) {
			fprintf(stderr, "Bad flag '%s' in args\n", argv[i]);
			exit(100);
		}
		switch(argv[i][1]) {
			case 'i':
				if(i + 1 < argc) {
					if(iFile != NULL && strcmp(argv[i + 1], iFile) != 0) {
						fprintf(stderr, "Conflicting -i flag given.\n");
						exit(100);
					}
					iFile = argv[i + 1];
					input_file = fopen(iFile, "r");
					if(input_file == NULL) {
						fprintf(stderr, "Input file could not be opened.\n");
						exit(100);
					}
					i++;
				}
				else {
					fprintf(stderr, "-i flag requires an input file to be provided.\n");
					exit(100);
				}
				break;
			case 'o':
				if(i + 1 < argc) {
					if(oFile != NULL && strcmp(argv[i + 1], oFile) != 0) {
						fprintf(stderr, "Conflicting -o flag given.\n");
						exit(100);
					}
					oFile = argv[i + 1];
					output_file = fopen(argv[i + 1], "w");
					if(output_file == NULL) {
						fprintf(stderr, "Output file could not be opened.\n");
						exit(100);
					}
					i++;
				}
				else {
					fprintf(stderr, "-o flag requires an output file to be provided.\n");
					exit(100);
				}
				break;
			case 'g':
				if(i + 1 < argc) {
					char *temp;
					int n = (int) strtol(argv[i + 1], &temp, 10);
					if(*temp == '\0') {
						if(gUsed && n != number_of_generations) {
							fprintf(stderr, "Conflicting -g flag given.\n");
							exit(100);
						}
						number_of_generations = n;
						gUsed = 1;
					}
					else {
						fprintf(stderr, "Invalid number given with -g flag. Correct syntax is -g <int>.\n");
						exit(100);
					}
					i++;
				}
				else {
					fprintf(stderr, "-g flag requires a number of generations to be provided.\n");
					exit(100);
				}
				break;
			case 's':
				print_stats = 1;
				break;
			case 't':
				torus_topology = 1;
				break;
		}		
	}
	struct universe v;
	read_in_file(input_file, &v);
	for(int i = 0; i < number_of_generations; i++) {
		evolve(&v, torus_topology ? will_be_alive_torus : will_be_alive);
	}
	write_out_file(output_file, &v);
	if(print_stats) {
		print_statistics(&v);
	}
	fclose(input_file);
	fclose(output_file);
	return 0;
}
