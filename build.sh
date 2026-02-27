#!/bin/bash

set -e

echo "🚀 Building Dropbox Image Uploader..."
echo ""

# Get current version
VERSION=$(node -p "require('./package.json').version")
VSIX_FILE="dropbox-image-uploader-${VERSION}.vsix"

# Remove existing VSIX file if present
if [ -f "$VSIX_FILE" ]; then
    echo "🗑️  Removing existing $VSIX_FILE"
    rm "$VSIX_FILE"
fi

# Compile TypeScript
echo "🔨 Compiling TypeScript..."
npm run compile

# Build VSIX
echo "📦 Building VSIX package..."
npx @vscode/vsce package --allow-missing-repository

echo ""
echo "✅ Build complete: $VSIX_FILE"
echo ""
