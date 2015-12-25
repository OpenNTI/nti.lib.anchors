.PHONY:
	clean \
	check


#SRC = $(wildcard src/**/*.js)
SRC= $(shell find src -name '*.js')
LIB = $(SRC:src/%.js=lib/%.js)
LIBDIR = lib

all: node_modules lib

node_modules: package.json
	@rm -rf node_modules
	@npm install
	@touch $@

check:
	@eslint --ext .js,.jsx ./src

clean:
	@rm -rf $(LIBDIR)

lib: $(LIB)
lib/%.js: src/%.js
#	@echo babel	$@...
	@mkdir -p $(@D)
	babel $< -o $@
