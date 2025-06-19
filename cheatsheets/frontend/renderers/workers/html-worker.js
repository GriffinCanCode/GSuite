/**
 * HTML Worker
 * 
 * This web worker handles HTML processing operations in a separate thread.
 * Provides HTML parsing, sanitization, and transformation capabilities.
 */

// Since DOMParser may not be available in all web worker contexts,
// we'll use a text-based parsing approach with fallback options

// HTML entity mapping for manual escaping/unescaping
const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
};

/**
 * Parse HTML content
 * @param {string} html - The HTML content to parse
 * @param {Object} options - Parsing options
 * @returns {Object} - The processed HTML structure
 */
function parseHTML(html, options = {}) {
    // Try to use DOMParser if available in this worker context
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Check for parsing errors
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
            throw new Error('HTML parsing failed');
        }
        
        // Process the document based on options
        if (options.extractTitle) {
            const titleElement = doc.querySelector('title');
            options.title = titleElement ? titleElement.textContent : '';
        }
        
        if (options.extractMetadata) {
            options.metadata = extractMetadata(doc);
        }
        
        if (options.extractLinks) {
            options.links = extractLinks(doc);
        }
        
        if (options.extractImages) {
            options.images = extractImages(doc);
        }
        
        // Return serialized HTML or document structure based on options
        if (options.returnStructure) {
            return {
                html: doc.documentElement.outerHTML,
                title: options.title,
                metadata: options.metadata,
                links: options.links,
                images: options.images
            };
        }
        
        return doc.documentElement.outerHTML;
    } catch (e) {
        // Fall back to regex-based parsing for basic operations
        console.warn('DOMParser failed, falling back to regex-based parsing', e);
        return regexBasedParsing(html, options);
    }
}

/**
 * Fallback regex-based parsing for environments without DOMParser
 * @param {string} html - The HTML content to parse
 * @param {Object} options - Parsing options
 * @returns {Object} - Basic parsed information
 */
function regexBasedParsing(html, options = {}) {
    const result = {
        html: html
    };
    
    // Extract title if requested
    if (options.extractTitle) {
        const titleMatch = /<title>(.*?)<\/title>/i.exec(html);
        result.title = titleMatch ? decodeHTML(titleMatch[1]) : '';
    }
    
    // Extract metadata if requested
    if (options.extractMetadata) {
        result.metadata = {};
        
        // Find meta tags
        const metaRegex = /<meta\s+([^>]+)>/gi;
        let metaMatch;
        
        while ((metaMatch = metaRegex.exec(html)) !== null) {
            const metaContent = metaMatch[1];
            
            // Extract name/property and content
            const nameMatch = /(?:name|property)=["']([^"']*)["']/i.exec(metaContent);
            const contentMatch = /content=["']([^"']*)["']/i.exec(metaContent);
            
            if (nameMatch && contentMatch) {
                result.metadata[nameMatch[1]] = decodeHTML(contentMatch[1]);
            }
        }
    }
    
    // Extract links if requested
    if (options.extractLinks) {
        result.links = [];
        const linkRegex = /<a\s+[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi;
        let linkMatch;
        
        while ((linkMatch = linkRegex.exec(html)) !== null) {
            result.links.push({
                href: linkMatch[1],
                text: decodeHTML(stripTags(linkMatch[2]))
            });
        }
    }
    
    // Extract images if requested
    if (options.extractImages) {
        result.images = [];
        const imgRegex = /<img\s+[^>]*src=["']([^"']*)["'][^>]*>/gi;
        let imgMatch;
        
        while ((imgMatch = imgRegex.exec(html)) !== null) {
            const imgTag = imgMatch[0];
            const altMatch = /alt=["']([^"']*)["']/i.exec(imgTag);
            
            result.images.push({
                src: imgMatch[1],
                alt: altMatch ? decodeHTML(altMatch[1]) : ''
            });
        }
    }
    
    return result;
}

/**
 * Extract metadata from an HTML document
 * @param {Document} doc - The parsed HTML document
 * @returns {Object} - Extracted metadata
 */
function extractMetadata(doc) {
    const metadata = {};
    
    // Extract meta tags
    const metaTags = doc.querySelectorAll('meta');
    metaTags.forEach(meta => {
        const name = meta.getAttribute('name') || meta.getAttribute('property');
        const content = meta.getAttribute('content');
        
        if (name && content) {
            metadata[name] = content;
        }
    });
    
    return metadata;
}

/**
 * Extract links from an HTML document
 * @param {Document} doc - The parsed HTML document
 * @returns {Array} - Array of link objects
 */
function extractLinks(doc) {
    const links = [];
    const linkElements = doc.querySelectorAll('a[href]');
    
    linkElements.forEach(link => {
        links.push({
            href: link.getAttribute('href'),
            text: link.textContent.trim(),
            rel: link.getAttribute('rel') || null,
            isExternal: link.getAttribute('href').startsWith('http') || 
                       link.getAttribute('href').startsWith('https') ||
                       link.getAttribute('rel') === 'external'
        });
    });
    
    return links;
}

/**
 * Extract images from an HTML document
 * @param {Document} doc - The parsed HTML document
 * @returns {Array} - Array of image objects
 */
function extractImages(doc) {
    const images = [];
    const imgElements = doc.querySelectorAll('img');
    
    imgElements.forEach(img => {
        images.push({
            src: img.getAttribute('src'),
            alt: img.getAttribute('alt') || '',
            width: img.getAttribute('width') || null,
            height: img.getAttribute('height') || null
        });
    });
    
    return images;
}

/**
 * Sanitize HTML content
 * @param {string} html - The HTML content to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} - The sanitized HTML
 */
function sanitizeHTML(html, options = {}) {
    const {
        allowedTags = ['a', 'abbr', 'article', 'b', 'blockquote', 'br', 'caption', 'code', 'div', 'em', 
                       'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'li', 'nl', 'ol', 'p', 
                       'pre', 'section', 'span', 'strike', 'strong', 'table', 'tbody', 'td', 'th', 
                       'thead', 'tr', 'ul'],
        allowedAttributes = {
            a: ['href', 'target', 'rel'],
            img: ['src', 'alt', 'title', 'width', 'height'],
            div: ['class', 'id'],
            span: ['class', 'id'],
            table: ['class', 'id', 'width'],
            td: ['class', 'colspan', 'rowspan'],
            th: ['class', 'colspan', 'rowspan', 'scope']
        },
        removeDataUrls = true,
        removeScripts = true,
        removeStyles = true,
        removeComments = true,
        removeEventAttributes = true
    } = options;
    
    try {
        // Try to use DOMParser if available
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Remove unwanted elements
        if (removeScripts) {
            removeElements(doc, 'script');
            removeElements(doc, 'noscript');
        }
        
        if (removeStyles) {
            removeElements(doc, 'style');
        }
        
        if (removeComments) {
            removeComments(doc);
        }
        
        // Process all elements
        const allElements = doc.querySelectorAll('*');
        for (const el of allElements) {
            const tagName = el.tagName.toLowerCase();
            
            // Remove disallowed tags (replace with their content)
            if (!allowedTags.includes(tagName)) {
                replaceWithContent(el);
                continue;
            }
            
            // Handle attributes
            const attributes = Array.from(el.attributes);
            for (const attr of attributes) {
                const attrName = attr.name.toLowerCase();
                
                // Remove event attributes
                if (removeEventAttributes && attrName.startsWith('on')) {
                    el.removeAttribute(attrName);
                    continue;
                }
                
                // Remove disallowed attributes for this tag
                const allowedForTag = allowedAttributes[tagName] || [];
                if (!allowedForTag.includes(attrName)) {
                    el.removeAttribute(attrName);
                    continue;
                }
                
                // Handle special attributes
                if (tagName === 'a' && attrName === 'href') {
                    // Ensure all links open in a new tab and have noopener noreferrer
                    if (attr.value.startsWith('http')) {
                        el.setAttribute('target', '_blank');
                        el.setAttribute('rel', 'noopener noreferrer');
                    }
                    
                    // Remove javascript: URLs
                    if (attr.value.toLowerCase().startsWith('javascript:')) {
                        el.removeAttribute(attrName);
                    }
                }
                
                if (tagName === 'img' && attrName === 'src') {
                    // Remove data: URLs if configured to do so
                    if (removeDataUrls && attr.value.toLowerCase().startsWith('data:')) {
                        el.removeAttribute(attrName);
                    }
                }
            }
        }
        
        return doc.documentElement.outerHTML;
    } catch (e) {
        // Fall back to regex-based sanitization for basic operations
        console.warn('DOMParser failed, falling back to regex-based sanitization', e);
        return regexBasedSanitization(html, options);
    }
}

/**
 * Regex-based HTML sanitization (simplified fallback)
 * @param {string} html - The HTML content to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} - The sanitized HTML
 */
function regexBasedSanitization(html, options = {}) {
    const {
        removeDataUrls = true,
        removeScripts = true,
        removeStyles = true,
        removeComments = true,
        removeEventAttributes = true
    } = options;
    
    let result = html;
    
    // Remove script tags
    if (removeScripts) {
        result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        result = result.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
    }
    
    // Remove style tags
    if (removeStyles) {
        result = result.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    }
    
    // Remove HTML comments
    if (removeComments) {
        result = result.replace(/<!--[\s\S]*?-->/g, '');
    }
    
    // Remove event handlers
    if (removeEventAttributes) {
        result = result.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^>\s]+)/gi, '');
    }
    
    // Remove data: URLs from img src
    if (removeDataUrls) {
        result = result.replace(/(<img[^>]+src\s*=\s*)('|")data:.*?\2/gi, '$1$2#$2');
    }
    
    // Remove javascript: URLs
    result = result.replace(/(<[^>]+(?:href|src|action)\s*=\s*)('|")javascript:.*?\2/gi, '$1$2#$2');
    
    return result;
}

/**
 * Transform HTML by adding or modifying attributes and elements
 * @param {string} html - The HTML content to transform
 * @param {Object} options - Transformation options
 * @returns {string} - The transformed HTML
 */
function transformHTML(html, options = {}) {
    const {
        addResponsiveImages = false,
        addExternalLinkAttributes = false,
        addTableClasses = false,
        addHighlightToCode = false,
        makeImagesLazyLoad = false,
        makeTableResponsive = false,
        injectCSS = null,
        theme = 'light' // 'light' or 'dark'
    } = options;
    
    try {
        // Try to use DOMParser if available
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Add responsive image attributes
        if (addResponsiveImages) {
            const images = doc.querySelectorAll('img');
            images.forEach(img => {
                if (!img.hasAttribute('style')) {
                    img.setAttribute('style', 'max-width: 100%; height: auto;');
                }
            });
        }
        
        // Add external link attributes
        if (addExternalLinkAttributes) {
            const links = doc.querySelectorAll('a[href^="http"]');
            links.forEach(link => {
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');
            });
        }
        
        // Add table classes
        if (addTableClasses) {
            const tables = doc.querySelectorAll('table');
            tables.forEach(table => {
                table.classList.add('html-table');
            });
        }
        
        // Make tables responsive
        if (makeTableResponsive) {
            const tables = doc.querySelectorAll('table');
            tables.forEach(table => {
                const wrapper = doc.createElement('div');
                wrapper.className = 'table-responsive';
                wrapper.style.overflowX = 'auto';
                table.parentNode.insertBefore(wrapper, table);
                wrapper.appendChild(table);
            });
        }
        
        // Add lazy loading to images
        if (makeImagesLazyLoad) {
            const images = doc.querySelectorAll('img');
            images.forEach(img => {
                img.setAttribute('loading', 'lazy');
            });
        }
        
        // Add syntax highlighting classes to code elements
        if (addHighlightToCode) {
            const codeBlocks = doc.querySelectorAll('pre > code');
            codeBlocks.forEach(code => {
                code.classList.add('highlight');
            });
        }
        
        // Inject custom CSS
        if (injectCSS) {
            const style = doc.createElement('style');
            style.textContent = injectCSS;
            doc.head.appendChild(style);
        }
        
        // Apply theme
        if (theme === 'dark') {
            const style = doc.createElement('style');
            style.textContent = `
                body { background-color: #1a1a2e; color: #e6e6e6; }
                a { color: #3498db; }
                code { background-color: #252538; color: #e6e6e6; }
                pre { background-color: #252538; color: #e6e6e6; padding: 1em; border-radius: 4px; }
                table { border-color: #444; }
                th { background-color: #252538; }
                td { border-color: #444; }
            `;
            doc.head.appendChild(style);
        }
        
        return doc.documentElement.outerHTML;
    } catch (e) {
        // Fallback to simpler transformation for environments without DOMParser
        console.warn('DOMParser failed, returning original HTML with minimal transformations', e);
        
        // Apply basic transformations with regex
        let result = html;
        
        // Inject custom CSS if provided
        if (injectCSS) {
            result = result.replace('</head>', `<style>${injectCSS}</style></head>`);
        }
        
        // Apply basic dark theme
        if (theme === 'dark') {
            const darkThemeCSS = `
                body { background-color: #1a1a2e; color: #e6e6e6; }
                a { color: #3498db; }
                code { background-color: #252538; color: #e6e6e6; }
                pre { background-color: #252538; color: #e6e6e6; padding: 1em; border-radius: 4px; }
                table { border-color: #444; }
                th { background-color: #252538; }
                td { border-color: #444; }
            `;
            result = result.replace('</head>', `<style>${darkThemeCSS}</style></head>`);
        }
        
        return result;
    }
}

/**
 * Extract plain text from HTML
 * @param {string} html - The HTML content to extract text from
 * @returns {string} - The extracted plain text
 */
function extractText(html) {
    try {
        // Try to use DOMParser if available
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        return doc.body.textContent || '';
    } catch (e) {
        // Fallback to regex-based text extraction
        return stripTags(html);
    }
}

/**
 * Strip HTML tags from a string
 * @param {string} html - The HTML string
 * @returns {string} - Text with HTML tags removed
 */
function stripTags(html) {
    // Replace HTML tags with spaces to maintain word separation
    const text = html.replace(/<[^>]*>/g, ' ');
    
    // Decode HTML entities
    return decodeHTML(text).replace(/\s+/g, ' ').trim();
}

/**
 * Decode HTML entities in a string
 * @param {string} html - The HTML string with entities
 * @returns {string} - Decoded text
 */
function decodeHTML(html) {
    return html
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
}

/**
 * Encode HTML entities in a string
 * @param {string} text - The text to encode
 * @returns {string} - HTML-safe text
 */
function encodeHTML(text) {
    return text.replace(/[&<>"'`=\/]/g, s => htmlEntities[s]);
}

/**
 * Remove elements from the document
 * @param {Document} doc - The document
 * @param {string} selector - The selector for elements to remove
 */
function removeElements(doc, selector) {
    const elements = doc.querySelectorAll(selector);
    elements.forEach(el => {
        el.parentNode.removeChild(el);
    });
}

/**
 * Remove comments from the document
 * @param {Document} doc - The document
 */
function removeComments(doc) {
    const iterator = doc.createNodeIterator(
        doc.documentElement, 
        NodeFilter.SHOW_COMMENT, 
        null
    );
    
    let comment;
    while (comment = iterator.nextNode()) {
        comment.parentNode.removeChild(comment);
    }
}

/**
 * Replace an element with its content
 * @param {Element} el - The element to replace
 */
function replaceWithContent(el) {
    const parent = el.parentNode;
    while (el.firstChild) {
        parent.insertBefore(el.firstChild, el);
    }
    parent.removeChild(el);
}

// Listen for messages from the main thread
self.onmessage = function(e) {
    const { id, type, content, options = {} } = e.data;
    
    try {
        let result;
        
        switch (type) {
            case 'parse':
                result = parseHTML(content, options);
                break;
            case 'sanitize':
                result = sanitizeHTML(content, options);
                break;
            case 'transform':
                result = transformHTML(content, options);
                break;
            case 'extractText':
                result = extractText(content);
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
console.log('HTML worker initialized with enhanced capabilities'); 