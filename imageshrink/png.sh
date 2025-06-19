#!/bin/bash
# This script optimizes PNG images using OptiPNG for maximum lossless compression

# Check if OptiPNG is installed
if ! command -v optipng &> /dev/null; then
    echo "Error: OptiPNG is not installed. Please install it first."
    echo "On Ubuntu/Debian: sudo apt-get install optipng"
    echo "On macOS with Homebrew: brew install optipng"
    exit 1
fi

# Check if input file is provided
if [ $# -ne 1 ]; then
    echo "Usage: $0 <png_file>"
    exit 1
fi

input_file="$1"
filename=$(basename -- "$input_file")
extension="${filename##*.}"

# Check if file is PNG
if [[ "$extension" != "png" ]]; then
    echo "Error: File must be a PNG image."
    exit 1
fi

# Get original file size
original_size=$(du -h "$input_file" | cut -f1)
original_bytes=$(du -b "$input_file" | cut -f1)

# Make a copy of the original file
cp "$input_file" "original_$input_file"

# Run OptiPNG with maximum compression
echo "Optimizing PNG file..."
optipng -o7 -strip all "$input_file"

# Get new file size
new_size=$(du -h "$input_file" | cut -f1)
new_bytes=$(du -b "$input_file" | cut -f1)

# Calculate percent reduction
reduction=$(awk "BEGIN {print (($original_bytes-$new_bytes)/$original_bytes)*100}")

echo "Original file: $original_size"
echo "Optimized file: $new_size"
echo "Size reduction: ${reduction:.2f}%"
echo "Original copy saved as: original_$input_file"