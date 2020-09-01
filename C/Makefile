CFLAGS := -Wall -Wextra -pedantic -std=c11
NAME := gol
CMDNAME := gameoflife

all: $(CMDNAME).c lib$(NAME).so
	gcc -L. $(CFLAGS) -o $(CMDNAME) $(CMDNAME).c -l$(NAME)

$(NAME).o: $(NAME).c $(NAME).h
	gcc -c $(NAME).c $(CFLAGS) -Werror -fpic -o $(NAME).o

lib$(NAME).so: $(NAME).o
	gcc -shared $(CFLASGS) -o lib$(NAME).so $(NAME).o

clean:
	rm -rf $(CMDNAME) lib$(NAME).so $(NAME).o
