#!/bin/bash

# Pre-Deployment Check Script
# Run this before pushing to catch build errors early

set -e  # Exit on any error

echo "🚀 Running Pre-Deployment Checks for Preem HR..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print success
success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Function to print error
error() {
    echo -e "${RED}✗${NC} $1"
}

# Function to print info
info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Step 1: Type Check
info "Step 1/3: Running TypeScript type check..."
if npm run type-check; then
    success "TypeScript check passed"
else
    error "TypeScript check failed"
    echo ""
    echo "Fix TypeScript errors before deploying."
    exit 1
fi

echo ""

# Step 2: Lint
info "Step 2/3: Running linter..."
if npm run lint; then
    success "Lint check passed"
else
    error "Lint check failed"
    echo ""
    echo "Run 'npm run lint:fix' to auto-fix issues, or fix manually."
    exit 1
fi

echo ""

# Step 3: Build
info "Step 3/3: Running production build..."
if npm run build; then
    success "Build completed successfully"
else
    error "Build failed"
    echo ""
    echo "Check the error messages above and fix before deploying."
    exit 1
fi

echo ""
echo "════════════════════════════════════════════"
echo -e "${GREEN}✓ All checks passed!${NC} Safe to deploy."
echo "════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. git add ."
echo "  2. git commit -m 'your message'"
echo "  3. git push"
echo ""
