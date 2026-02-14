SHELL := /bin/bash

APP_NAME := rt-backend
PORT ?= 3000
NODE_VERSION ?= 20

.PHONY: help
help:
	@echo "Common targets:"
	@echo "  make install           # npm ci"
	@echo "  make dev               # start dev with nodemon"
	@echo "  make build             # compile TypeScript"
	@echo "  make start             # run built app"
	@echo "  make prisma-generate   # generate Prisma client"
	@echo "  make prisma-migrate    # prisma migrate dev"
	@echo "  make prisma-studio     # open Prisma Studio"
	@echo "  make docker-build      # build Docker image"
	@echo "  make docker-run        # run Docker container"
	@echo "  make docker-shell      # open shell in running container"
	@echo "  make compose-up        # docker compose up -d"
	@echo "  make compose-down      # docker compose down"
	@echo "  make db-up             # start postgres db container"
	@echo "  make db-restore        # restore database from supabase_backup.sql"
	@echo "  make db-shell          # open psql shell in db container"

.PHONY: install
install:
	npm ci

.PHONY: dev
dev:
	npm run dev

.PHONY: db-up
db-up:
	docker compose up -d db --wait

.PHONY: db-restore
db-restore:
	docker compose exec -T -e PGPASSWORD=password db psql -U postgres -d rt-backend < supabase_backup.sql

.PHONY: db-shell
db-shell:
	docker compose exec -e PGPASSWORD=password db psql -U postgres -d rt-backend

.PHONY: build
build:
	npx prisma generate
	npx tsc

.PHONY: start
start:
	node dist/app.js

.PHONY: prisma-generate
prisma-generate:
	npx prisma generate

.PHONY: prisma-migrate
prisma-migrate:
	@if [ -z "$(name)" ]; then echo "Usage: make prisma-migrate name=add_users" && exit 1; fi
	npx prisma migrate dev --name "$(name)"

.PHONY: prisma
prisma:
	npx prisma studio

.PHONY: docker-build
docker-build:
	docker build -t $(APP_NAME):latest .

.PHONY: docker-run
docker-run:
	docker run --rm -p $(PORT):3000 --env-file .env --name $(APP_NAME) $(APP_NAME):latest

.PHONY: docker-shell
docker-shell:
	docker exec -it $(APP_NAME) sh

.PHONY: compose-up
compose-up:
	docker compose up -d --build

.PHONY: compose-down
compose-down:
	docker compose down

.PHONY: generate-types
generate-types:
	npm run docs:emit
	npm run types:openapi