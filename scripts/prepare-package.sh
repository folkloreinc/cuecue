#!/bin/bash

# Help
usage() {
    echo "Usage: $0"
}

# Transform long options to short ones
for arg in "$@"; do
    shift
    case "$arg" in
        "--help") set -- "$@" "-h" ;;
        *)        set -- "$@" "$arg"
    esac
done

# Set defaults

# Get options
while getopts 'i?h' c
do
    case $c in
        h) usage; exit 0 ;;
        ?) usage >&2; exit 1 ;;
    esac
done

# Build methods
clean() {
    echo "Cleaning..."
    rm -rf assets
    rm -rf lib
    rm -rf es
}

build_rollup() {
    echo "Building JS with rollup..."
    if [ -f ./rollup.config.js ]; then
        ../../node_modules/.bin/rollup --config ./rollup.config.js
    else
        ../../node_modules/.bin/rollup --config ../../rollup.config.js
    fi
}

# Build
export NODE_ENV=production
clean
build_rollup
