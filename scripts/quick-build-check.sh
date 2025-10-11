#!/bin/bash

# Quick Build Check - Fast pre-deploy validation
# Focuses on TypeScript errors which are the most common build failures

set -e

echo "🔍 Quick Build Check (TypeScript Only)"
echo "======================================="
echo ""

# Only run TypeScript check (fastest way to catch most errors)
echo "Running TypeScript type check..."
if npm run type-check; then
    echo ""
    echo "✅ No TypeScript errors found!"
    echo ""
    echo "Safe to push. Vercel will handle the full build."
else
    echo ""
    echo "❌ TypeScript errors found. Fix before pushing!"
    exit 1
fi
