SHELL := /bin/sh

.PHONY: dev build start lint format test seed docker-up

dev:
	npx nodemon --watch src --ext js,json src/server.js

build:
	@echo No build step (JavaScript runtime)

start:
	node src/server.js

lint:
	@echo skip

format:
	npx prettier --write .

test:
	@echo no tests

seed:
	node src/scripts/seed.js

docker-up:
	docker compose up --build
