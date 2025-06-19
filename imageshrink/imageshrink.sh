#!/bin/bash
# This script reduces image size using appropriate tools based on file type.

# --- Tool Check ---
command_exists() {
    command -v "$1" &> /dev/null
}

tools_missing=()
if ! command_exists convert; then tools_missing+=("imagemagick"); fi
if ! command_exists optipng; then tools_missing+=("optipng"); fi
if ! command_exists jpegtran; then tools_missing+=("jpegtran (often part of libjpeg-turbo)"); fi

if [ ${#tools_missing[@]} -ne 0 ]; then
    echo "Error: Required tools are not installed. Please install them:"
    for tool in "${tools_missing[@]}"; do
        case "$tool" in
            imagemagick)
                echo "  - ImageMagick (convert):"
                echo "    On Ubuntu/Debian: sudo apt-get install imagemagick"
                echo "    On macOS with Homebrew: brew install imagemagick"
                ;;
            optipng)
                echo "  - OptiPNG:"
                echo "    On Ubuntu/Debian: sudo apt-get install optipng"
                echo "    On macOS with Homebrew: brew install optipng"
                ;;
            "jpegtran (often part of libjpeg-turbo)")
                echo "  - jpegtran:"
                echo "    On Ubuntu/Debian: sudo apt-get install libjpeg-turbo-progs"
                echo "    On macOS with Homebrew: brew install jpegoptim # jpegtran comes with jpegoptim or libjpeg"
                ;;
        esac
    done
    exit 1
fi

# --- Input Handling ---
if [ $# -ne 1 ]; then
    echo "Usage: $0 <image_file>"
    exit 1
fi

input_file="$1"
if [ ! -f "$input_file" ]; then
    echo "Error: File not found: $input_file"
    exit 1
fi

filename=$(basename -- "$input_file")
name="${filename%.*}"
extension_lower=$(echo "${filename##*.}" | tr '[:upper:]' '[:lower:]') # Ensure lowercase extension
output_file="${name}_compressed.${extension_lower}"

# --- File Size Info ---
original_size_h=$(du -h "$input_file" | cut -f1)
original_bytes=$(du -b "$input_file" | cut -f1)

echo "Processing '$filename'..."
echo "Original size: $original_size_h"

# --- Optimization Logic ---
optimization_applied=false
case "$extension_lower" in
    png)
        echo "Optimizing PNG using OptiPNG..."
        # Copy original to output location first, then optimize in place
        cp "$input_file" "$output_file"
        if optipng -o7 -strip all "$output_file"; then
            optimization_applied=true
            echo "OptiPNG optimization successful."
        else
            echo "OptiPNG optimization failed."
            rm "$output_file" # Clean up failed attempt
            exit 1
        fi
        ;;
    jpg|jpeg)
        echo "Optimizing JPEG using jpegtran..."
        if jpegtran -optimize -progressive -copy none -outfile "$output_file" "$input_file"; then
             optimization_applied=true
             echo "jpegtran optimization successful."
        else
            echo "jpegtran optimization failed. Trying ImageMagick quality reduction..."
            # Fallback to ImageMagick lossy compression if jpegtran fails or for further reduction
            if convert "$input_file" -strip -interlace Plane -sampling-factor 4:2:0 -quality 85 "$output_file"; then
                optimization_applied=true
                echo "ImageMagick optimization successful."
            else
                echo "ImageMagick optimization also failed."
                rm "$output_file" # Clean up failed attempt
                exit 1
            fi
        fi
        ;;
    *)
        echo "Unsupported or unrecognized file type: .$extension_lower"
        echo "Attempting generic optimization with ImageMagick..."
        # Default to ImageMagick for other types if convert exists
        if convert "$input_file" -strip "$output_file"; then
             optimization_applied=true
             echo "Generic ImageMagick optimization attempted."
        else
             echo "Generic ImageMagick optimization failed."
             exit 1
        fi
        ;;
esac

# --- Output Results ---
if [ "$optimization_applied" = true ] && [ -f "$output_file" ]; then
    new_size_h=$(du -h "$output_file" | cut -f1)
    new_bytes=$(du -b "$output_file" | cut -f1)

    if [ "$original_bytes" -gt 0 ]; then
        reduction=$(awk "BEGIN {print (($original_bytes-$new_bytes)/$original_bytes)*100}")
        echo "Optimized file saved as: $output_file"
        echo "New size: $new_size_h"
        printf "Size reduction: %.2f%%
" "$reduction"
    else
        echo "Optimized file saved as: $output_file"
        echo "New size: $new_size_h"
        echo "Could not calculate reduction percentage (original size is zero)."
    fi

    # Check if the new file is actually smaller
    if [ "$new_bytes" -ge "$original_bytes" ]; then
         echo "Note: Optimized file is not smaller than the original. You may want to keep the original."
    fi
else
    echo "Optimization did not produce a result file."
    exit 1
fi

exit 0