# Convenience targets that mirror CLAUDE.md and .github/workflows/ci.yml.
# Run `make` or `make help` to list everything. Needs GNU Make + a POSIX shell
# (Git Bash on Windows: `choco install make`, or use WSL).

SHELL := /bin/sh
# Whatever `python` resolves to for you. If you're using a venv, activate it
# first (or override: `make python-test PYTHON=venv/bin/python`, or
# `venv/Scripts/python` for a native-Windows venv) — a venv created under WSL
# won't resolve from Git Bash or vice versa, so this deliberately doesn't guess.
PYTHON ?= python

.PHONY: help \
	backend-run backend-run-local backend-test backend-verify backend-build \
	frontend-dev frontend-install frontend-typecheck frontend-lint frontend-build \
	frontend-test frontend-test-watch frontend-e2e \
	python-venv python-test \
	infra-up infra-down infra-logs infra-prod-up infra-prod-down \
	docker-build-backend compose-validate \
	newman ci clean

help: ## Show this help
	@echo "Available targets:"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z0-9_-]+:.*##/ {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# --- Backend (Spring Boot) -------------------------------------------------

backend-run: ## Start the backend with the default profile
	cd backend && ./mvnw spring-boot:run

backend-run-local: ## Start the backend with SPRING_PROFILES_ACTIVE=local (recommended for local dev)
	cd backend && SPRING_PROFILES_ACTIVE=local ./mvnw spring-boot:run

backend-test: ## Run backend unit/controller tests only (mvnw test)
	cd backend && ./mvnw test

backend-verify: ## Full backend build + all tests, incl. Testcontainers integration tests (needs Docker)
	cd backend && ./mvnw clean verify

backend-build: ## Build the backend JAR without running tests
	cd backend && ./mvnw clean package -DskipTests

# --- Frontend (Next.js) -----------------------------------------------------

frontend-install: ## Install frontend dependencies (npm ci)
	cd frontend && npm ci

frontend-dev: ## Start the Next.js dev server
	cd frontend && npm run dev

frontend-typecheck: ## tsc --noEmit
	cd frontend && npm run typecheck

frontend-lint: ## ESLint
	cd frontend && npm run lint

frontend-build: ## Production build
	cd frontend && npm run build

frontend-test: ## Jest unit/component tests with coverage
	cd frontend && npm run test:coverage

frontend-test-watch: ## Jest in watch mode
	cd frontend && npm run test:watch

frontend-e2e: ## Playwright end-to-end tests (builds+starts the frontend itself; needs the backend running)
	cd frontend && npx playwright test

# --- Python MIDI engine ------------------------------------------------------

python-venv: ## Create the venv and install python/requirements.txt
	$(PYTHON) -m venv venv
	./venv/bin/pip install -r python/requirements.txt

python-test: ## Run fast (non-slow) python unit tests
	cd python && $(PYTHON) -m pytest tests/ -m "not slow"

# --- Infrastructure (Docker Compose) ----------------------------------------

infra-up: ## Start local Postgres + MinIO
	docker compose up -d

infra-down: ## Stop local infra
	docker compose down

infra-logs: ## Tail local infra logs
	docker compose logs -f

infra-prod-up: ## Start the production stack (needs .env.production)
	docker compose --env-file .env.production -f docker-compose.production.yml up -d --build

infra-prod-down: ## Stop the production stack
	docker compose -f docker-compose.production.yml down

docker-build-backend: ## Build the backend Docker image (context = repo root)
	docker build -f backend/Dockerfile -t icepunk-backend .

compose-validate: ## Validate both compose files (same check CI runs)
	docker compose -f docker-compose.yml config -q
	@tmp=$$(mktemp); \
	{ \
		echo "POSTGRES_PASSWORD=dummy"; \
		echo "MINIO_ROOT_USER=dummy"; \
		echo "MINIO_ROOT_PASSWORD=dummy"; \
		echo "JWT_SECRET=dummy-not-a-real-secret"; \
		echo "CORS_ALLOWED_ORIGINS=https://example.com"; \
		echo "TRUSTED_PROXY_CIDRS=172.30.0.0/24"; \
		echo "S3_PRESIGN_ENDPOINT=https://example.com"; \
		echo "NEXT_PUBLIC_API_URL=https://example.com"; \
	} > "$$tmp"; \
	docker compose -f docker-compose.production.yml --env-file "$$tmp" config -q; \
	rm -f "$$tmp"
	@echo "docker compose files OK"

# --- API smoke test (Newman) -------------------------------------------------

newman: ## Run the Postman/Newman API smoke test against a backend already running on :8081
	npx --yes newman run postman/icepunk.postman_collection.json \
		-e postman/ci.postman_environment.json --reporters cli

# --- Everything CI runs, run locally ----------------------------------------

ci: backend-verify frontend-install frontend-typecheck frontend-lint frontend-build frontend-test python-test compose-validate ## Run (most of) what CI runs: backend verify, frontend typecheck/lint/build/test, python tests, compose validation
	@echo "All local CI checks passed."

clean: ## Remove build artifacts (backend target/, frontend .next/ + coverage/, python __pycache__)
	rm -rf backend/target
	rm -rf frontend/.next frontend/coverage
	find python -name "__pycache__" -type d -prune -exec rm -rf {} +
