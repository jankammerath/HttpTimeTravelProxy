#!/bin/bash

# filepath: /Users/jan/Development/HttpTimeTravelProxy/build.sh

# Create the bin directories if they don't exist
mkdir -p bin/darwin
mkdir -p bin/windows
mkdir -p bin/linux

# Go build flags
GOFLAGS="-v" # Add -ldflags="-s -w" to reduce binary size

# Build for macOS (arm64)
echo "Building for macOS (arm64)..."
GOOS=darwin GOARCH=arm64 go build $GOFLAGS -o bin/darwin/httptimetravelproxy .

# Build for Windows (x86_64)
echo "Building for Windows (x86_64)..."
GOOS=windows GOARCH=amd64 go build $GOFLAGS -o bin/windows/httptimetravelproxy.exe .

# Build for Linux (x86_64)
echo "Building for Linux (x86_64)..."
GOOS=linux GOARCH=amd64 go build $GOFLAGS -o bin/linux/httptimetravelproxy .

echo "Build complete! Binaries are in their respective bin subdirectories."