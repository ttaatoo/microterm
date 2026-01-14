.PHONY: help dev build clean test test-frontend test-backend test-all test-coverage test-rust lint install dev-clean check format

# Default target
.DEFAULT_GOAL := help

## help: Show this help message
help:
	@echo "µTerm - Makefile Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev              Start Tauri development server"
	@echo "  make install          Install dependencies (bun + cargo)"
	@echo "  make lint             Run ESLint on TypeScript files"
	@echo ""
	@echo "Testing:"
	@echo "  make test             Run frontend tests in watch mode (default)"
	@echo "  make test-frontend    Run frontend tests once"
	@echo "  make test-backend     Run Rust/backend tests"
	@echo "  make test-all         Run all tests (frontend + backend)"
	@echo "  make test-coverage    Run frontend tests with coverage report"
	@echo "  make coverage-open    Open HTML coverage report in browser"
	@echo ""
	@echo "Building:"
	@echo "  make build            Build production application"
	@echo "  make build-frontend   Build frontend only (Vite)"
	@echo ""
	@echo "Cleaning:"
	@echo "  make clean            Remove build artifacts"
	@echo "  make dev-clean        Clean cache and restart fresh"
	@echo ""

## dev: Start Tauri development server (Vite + Tauri)
dev:
	@echo "🚀 Starting µTerm development server..."
	bun run tauri dev

## install: Install all dependencies
install:
	@echo "📦 Installing dependencies..."
	bun install
	@echo "✅ Dependencies installed"

## build: Build production application
build:
	@echo "🔨 Building production application..."
	bun run build
	bun run tauri build
	@echo "✅ Build complete"

## build-frontend: Build frontend only
build-frontend:
	@echo "🔨 Building frontend..."
	bun run build
	@echo "✅ Frontend build complete"

## test: Run frontend tests in watch mode (default)
test:
	@echo "🧪 Running frontend tests in watch mode..."
	bun run test

## test-frontend: Run frontend tests once
test-frontend:
	@echo "🧪 Running frontend tests..."
	bun run test:run

## test-backend: Run Rust/backend tests
test-backend:
	@echo "🧪 Running backend tests..."
	cd src-tauri && cargo test

## test-all: Run all tests (frontend + backend)
test-all:
	@echo "🧪 Running all tests..."
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  Frontend Tests"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@bun run test:run
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  Backend Tests"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@cd src-tauri && cargo test
	@echo ""
	@echo "✅ All tests passed!"

## test-coverage: Run frontend tests with coverage report
test-coverage:
	@echo "🧪 Running frontend tests with coverage..."
	bun run test:coverage
	@echo ""
	@echo "📊 Coverage report generated:"
	@echo "   - Text: See output above"
	@echo "   - HTML: coverage/index.html"
	@echo ""
	@echo "💡 Run 'make coverage-open' to view HTML report"

## coverage-open: Open HTML coverage report in browser
coverage-open:
	@if [ -f coverage/index.html ]; then \
		echo "📊 Opening coverage report..."; \
		open coverage/index.html; \
	else \
		echo "❌ No coverage report found. Run 'make test-coverage' first."; \
		exit 1; \
	fi

## test-rust: Run Rust tests (alias for test-backend)
test-rust: test-backend

## lint: Run ESLint
lint:
	@echo "🔍 Running ESLint..."
	bun run lint

## clean: Remove build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf dist
	rm -rf src-tauri/target
	rm -rf coverage
	@echo "✅ Clean complete"

## dev-clean: Clean cache and restart fresh
dev-clean:
	@echo "🧹 Deep cleaning development environment..."
	rm -rf dist
	rm -rf node_modules/.vite
	rm -rf coverage
	@echo "✅ Cache cleared. Run 'make dev' to start fresh."

## check: Run all checks (lint + all tests)
check: lint test-all
	@echo "✅ All checks passed!"

## format: Format code (placeholder for future formatter)
format:
	@echo "⚠️  No formatter configured yet"
	@echo "   Consider adding prettier or biome"
