/**
 * Markdown Worker
 * 
 * This web worker handles markdown parsing operations in a separate thread.
 * It imports the marked library and provides methods for parsing markdown.
 */

// Import the marked library
importScripts('https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js');

// Configure marked
marked.setOptions({
    gfm: true,
    breaks: true,
    pedantic: false,
    sanitize: false,
    smartLists: true,
    smartypants: true
});

/**
 * Parse a full markdown string
 * @param {string} markdown - The markdown content to parse
 * @returns {string} - The parsed HTML
 */
function parseMarkdown(markdown) {
    return marked.parse(markdown);
}

/**
 * Parse a chunk of markdown
 * @param {string} markdown - The full markdown content
 * @param {number} startIndex - The starting index of the chunk
 * @param {number} endIndex - The ending index of the chunk
 * @returns {string} - The parsed HTML for the chunk
 */
function parseMarkdownChunk(markdown, startIndex, endIndex) {
    const chunk = markdown.substring(startIndex, endIndex);
    return marked.parse(chunk);
}

/**
 * Set custom renderer options
 * @param {Object} options - The renderer options
 */
function setRendererOptions(options) {
    // Create a custom renderer
    const renderer = new marked.Renderer();
    
    // Apply custom renderer options
    if (options.customCodeRenderer) {
        const originalCodeRenderer = renderer.code;
        renderer.code = function(code, language, isEscaped) {
            if (language === 'render' || language === 'render-js' || language === 'render-babel') {
                const codeHtml = originalCodeRenderer.call(this, code, language === 'render-babel' ? 'javascript' : 'javascript', isEscaped);
                return `<div class="executable-code-block">${codeHtml}<button class="run-js-btn">Run Code</button><div class="js-result"></div></div>`;
            }
            return originalCodeRenderer.call(this, code, language, isEscaped);
        };
    }
    
    if (options.customLinkRenderer) {
        renderer.link = function(href, title, text) {
            const isExternal = href && href.startsWith('http');
            const attrs = isExternal ? 'target="_blank" rel="noopener noreferrer"' : '';
            return `<a href="${href}" ${title ? `title="${title}"` : ''} ${attrs}>${text}</a>`;
        };
    }
    
    if (options.customTableRenderer) {
        renderer.table = function(header, body) {
            return `<div class="table-responsive"><table class="md-table">${header}${body}</table></div>`;
        };
    }
    
    // Configure marked with the custom renderer
    marked.setOptions({
        renderer: renderer,
        highlight: options.highlight ? function(code, lang) {
            // Highlighting will be done in the main thread
            return code;
        } : null
    });
}

// Listen for messages from the main thread
self.onmessage = function(e) {
    const { id, type, markdown, startIndex, endIndex, rendererOptions } = e.data;
    
    try {
        let result;
        
        // Apply custom renderer options if provided
        if (rendererOptions) {
            setRendererOptions(rendererOptions);
        }
        
        // Process based on the requested operation type
        switch (type) {
            case 'parse':
                result = parseMarkdown(markdown);
                break;
            case 'parseChunk':
                result = parseMarkdownChunk(markdown, startIndex, endIndex);
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
console.log('Markdown worker initialized'); 