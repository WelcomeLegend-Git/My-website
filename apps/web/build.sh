#!/bin/bash
set -e

echo "Starting build process..."

# Install dependencies
npm install

# Build the application
npm run build

echo "Build completed successfully!"
