.PHONY:
	clean \
	check \
	test


#SRC = $(wildcard src/**/*.js)
SRC= $(shell find src -name '*.js')
LIB = $(SRC:src/%.js=lib/%.js)
LIBDIR = lib

all: lib

check:
	@./node_modules/.bin/eslint --ext .js,.jsx ./src

test: node_modules check
	@./node_modules/.bin/karma start --single-run

clean:
	@rm -rf $(LIBDIR)

lib: $(LIB)
lib/%.js: src/%.js
#	@echo babel	$@...
	@mkdir -p $(@D)
	./node_modules/.bin/babel $< -o $@
