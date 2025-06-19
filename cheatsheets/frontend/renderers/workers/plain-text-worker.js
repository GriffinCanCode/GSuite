/**
 * Plain Text Worker
 * 
 * This web worker handles plain text processing operations in a separate thread.
 */

/**
 * Format plain text content for display
 * @param {string} text - The text content to format
 * @param {Object} options - Formatting options
 * @returns {string} - The formatted text as HTML
 */
function formatText(text, options = {}) {
    // Escape HTML special characters
    let processed = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    
    // Convert URLs to links if requested
    if (options.linkifyUrls) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        processed = processed.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    }
    
    // Preserve newlines if requested
    if (options.preserveNewlines) {
        processed = processed.replace(/\n/g, '<br>');
    }
    
    // Highlight syntax if requested
    if (options.highlightSyntax && options.language) {
        // Note: Real syntax highlighting would be handled by the main thread
        // This is just a placeholder
        processed = `<code class="language-${options.language}">${processed}</code>`;
    }
    
    return processed;
}

/**
 * Analyze text content for statistics
 * @param {string} text - The text content to analyze
 * @returns {Object} - Text statistics
 */
function analyzeText(text) {
    return {
        length: text.length,
        lines: text.split('\n').length,
        words: text.split(/\s+/).filter(w => w.length > 0).length,
        characters: text.length
    };
}

// Listen for messages from the main thread
self.onmessage = function(e) {
    const { id, type, content, options } = e.data;
    
    try {
        let result;
        
        switch (type) {
            case 'format':
                result = formatText(content, options);
                break;
            case 'analyze':
                result = analyzeText(content);
                break;
            default:
                throw new Error(`Unknown operation type: ${type}`);
        }
        
        // Send back the result
        self.postMessage({ id, result, error: null });
    } catch (error) {
        self.postMessage({ id, result: null, error: error.message });
    }
};

// Log that the worker is ready
console.log('Plain text worker initialized'); 