/**
 * Enhanced Markdown Renderer Module
 * 
 * This module provides functions to render markdown content with syntax highlighting
 * and support for executable JavaScript code blocks.
 * Optimized for handling large files efficiently with Web Workers and incremental rendering.
 */

// Get the marked instance from our global registry
const { marked, executeJS } = window.markdownLibraries || {};

// Import the worker manager
import { executeWorkerTask, terminateWorker } from './worker-manager.js';

// Function to parse markdown using the worker manager
const parseMarkdownInWorker = (markdown, options = {}) => {
    return executeWorkerTask('markdown', {
        type: options.type || 'parse',
        markdown,
        startIndex: options.startIndex,
        endIndex: options.endIndex,
        rendererOptions: {
            customCodeRenderer: true,
            customLinkRenderer: true, 
            customTableRenderer: true,
            highlight: true
        }
    });
};

// Configure renderer options for better performance with large files
const configureMarked = () => {
    if (!marked) return null;
    
    // Create a custom renderer for better performance
    const renderer = new marked.Renderer();
    
    // Store the original code renderer
    const originalCodeRenderer = renderer.code;
    
    // Override code renderer to handle executable JS blocks
    renderer.code = function(code, language, isEscaped) {
        if (language === 'render' || language === 'render-js' || language === 'render-babel') {
            // For executable JS code blocks
            const codeHtml = originalCodeRenderer.call(this, code, language === 'render-babel' ? 'javascript' : 'javascript', isEscaped);
            return `<div class="executable-code-block">${codeHtml}<button class="run-js-btn">Run Code</button><div class="js-result"></div></div>`;
        }
        return originalCodeRenderer.call(this, code, language, isEscaped);
    };
    
    // Override link renderer to add target="_blank" to external links
    renderer.link = function(href, title, text) {
        const isExternal = href && href.startsWith('http');
        const attrs = isExternal ? 'target="_blank" rel="noopener noreferrer"' : '';
        return `<a href="${href}" ${title ? `title="${title}"` : ''} ${attrs}>${text}</a>`;
    };
    
    // Override table renderer to make tables responsive
    renderer.table = function(header, body) {
        return `<div class="table-responsive"><table class="md-table">${header}${body}</table></div>`;
    };
    
    // Configure marked with optimized settings
    marked.setOptions({
        renderer: renderer,
        gfm: true,
        breaks: true,
        pedantic: false,
        sanitize: false,
        smartLists: true,
        smartypants: true,
        highlight: function(code, lang) {
            try {
                if (window.hljs) {
                    if (lang && window.hljs.getLanguage(lang)) {
                        return window.hljs.highlight(code, {language: lang}).value;
                    } else {
                        return window.hljs.highlightAuto(code).value;
                    }
                }
                return code;
            } catch (e) {
                console.warn('Failed to highlight:', e);
                return code;
            }
        }
    });
    
    return renderer;
};

// Function to render markdown content to HTML
export async function renderMarkdown(markdown) {
    if (!marked) {
        console.error('Error: Marked library not available. Please make sure marked.min.js is loaded.');
        return `<div class="error-message">Error rendering markdown: Marked library not available. Please make sure marked.min.js is loaded.</div>`;
    }
    
    // Check if the content is very large
    if (markdown.length > 50000) {
        try {
            // Use Web Worker for large content
            const html = await parseMarkdownInWorker(markdown);
            return `<div class="markdown-content">${html}</div>`;
        } catch (error) {
            console.error('Error rendering markdown in worker:', error);
            // Fall back to regular rendering
            configureMarked();
            const html = marked(markdown);
            return `<div class="markdown-content">${html}</div>`;
        }
    } else {
        // Configure marked for optimal performance
        configureMarked();
        
        try {
            // First convert markdown to HTML
            const html = marked(markdown);
            
            // Wrap the content in a div with the markdown-content class
            return `<div class="markdown-content">${html}</div>`;
        } catch (error) {
            console.error('Error rendering markdown:', error);
            return `<div class="error-message">Error rendering markdown: ${error.message}</div>`;
        }
    }
}

/**
 * Renders markdown content with pagination and lazy loading for better performance with large documents
 * @param {string} markdown - The markdown content to render
 * @param {HTMLElement} container - The container to render into
 * @param {Object} options - Pagination options
 * @returns {Object} An object with pagination controls
 */
export function renderMarkdownWithPagination(markdown, container, options = {}) {
    if (!container || !marked) {
        console.error('Container or marked library not available');
        if (container) {
            container.innerHTML = '<div class="error-message">Error rendering: Missing dependencies</div>';
        }
        return null;
    }
    
    // Default pagination options (reduced page size for better performance)
    const paginationOptions = {
        pageSize: options.pageSize || 2500, // Reduced characters per page
        initialPage: options.initialPage || 1,
        addPaginationControls: options.addPaginationControls !== false,
        chunkSize: options.chunkSize || 500, // For incremental rendering
        renderDelay: options.renderDelay || 5, // ms between chunks
    };
    
    // Configure marked
    configureMarked();
    
    // Clean container
    container.innerHTML = '';
    
    // Create main content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'markdown-content-wrapper';
    
    // Create content area
    const contentArea = document.createElement('div');
    contentArea.className = 'markdown-content';
    contentWrapper.appendChild(contentArea);
    
    // Add loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'markdown-loading';
    loadingIndicator.innerHTML = '<div class="spinner"></div><span>Rendering content...</span>';
    contentArea.appendChild(loadingIndicator);
    
    // Add pagination controls if requested
    let pageNav = null;
    if (paginationOptions.addPaginationControls) {
        pageNav = document.createElement('div');
        pageNav.className = 'markdown-pagination';
        pageNav.innerHTML = `
            <button class="pagination-prev" disabled>&laquo; Previous</button>
            <span class="pagination-info">Page <span class="current-page">1</span></span>
            <button class="pagination-next">Next &raquo;</button>
        `;
        contentWrapper.appendChild(pageNav);
        
        // Initially hide pagination until we know we need it
        pageNav.style.display = 'none';
    }
    
    // Split content into pages - optimized for better splitting
    const pages = [];
    const averageCharsPerPage = paginationOptions.pageSize;
    let currentPos = 0;
    
    // Add approx page size worth of characters, but try to break at paragraph or section boundaries
    while (currentPos < markdown.length) {
        let pageEnd = Math.min(currentPos + averageCharsPerPage, markdown.length);
        
        // If we're not at the end of the document, try to find a good break point
        if (pageEnd < markdown.length) {
            // First look for section breaks (# headers)
            const nextSection = markdown.indexOf('\n#', pageEnd);
            if (nextSection !== -1 && nextSection < pageEnd + 300) {
                pageEnd = nextSection;
            } else {
                // Look for paragraph breaks
                const nextParagraph = markdown.indexOf('\n\n', pageEnd);
                if (nextParagraph !== -1 && nextParagraph < pageEnd + 200) {
                    pageEnd = nextParagraph + 2;
                } else {
                    // Fall back to line breaks
                    const nextLine = markdown.indexOf('\n', pageEnd);
                    if (nextLine !== -1 && nextLine < pageEnd + 100) {
                        pageEnd = nextLine + 1;
                    }
                }
            }
        }
        
        pages.push({
            text: markdown.substring(currentPos, pageEnd),
            startPos: currentPos,
            endPos: pageEnd
        });
        currentPos = pageEnd;
    }
    
    // Total number of pages
    const totalPages = pages.length;
    
    // Add content wrapper to container
    container.appendChild(contentWrapper);
    
    // Keep track of currently rendering operations
    let currentRenderTask = null;
    let currentPageNum = paginationOptions.initialPage;
    
    // Function to render a page incrementally using chunks and requestAnimationFrame
    const renderPageIncrementally = async (pageNum) => {
        if (pageNum < 1 || pageNum > totalPages) return;
        
        // Cancel any in-progress rendering
        if (currentRenderTask) {
            currentRenderTask.cancelled = true;
        }
        
        // Create a new task
        const task = { cancelled: false };
        currentRenderTask = task;
        
        // Get the page content
        const currentPage = pages[pageNum - 1];
        
        // Update pagination info
        if (pageNav) {
            const prevBtn = pageNav.querySelector('.pagination-prev');
            const nextBtn = pageNav.querySelector('.pagination-next');
            const pageInfo = pageNav.querySelector('.current-page');
            
            prevBtn.disabled = pageNum === 1;
            nextBtn.disabled = pageNum === totalPages;
            pageInfo.textContent = `${pageNum} of ${totalPages}`;
            
            pageNav.style.display = totalPages > 1 ? 'flex' : 'none';
        }
        
        // Show loading
        contentArea.innerHTML = '';
        loadingIndicator.style.display = 'flex';
        contentArea.appendChild(loadingIndicator);
        
        // Use Web Worker for parsing if the content is large enough
        if (currentPage.text.length > 10000) {
            try {
                const html = await parseMarkdownInWorker(currentPage.text);
                
                // Check if task was cancelled
                if (task.cancelled) return;
                
                // Remove loading indicator
                if (loadingIndicator.parentElement === contentArea) {
                    contentArea.removeChild(loadingIndicator);
                }
                
                // Set the content
                contentArea.innerHTML = html;
                
                // Activate code blocks
                activateCodeBlocks(contentArea);
                
                // Scroll to top
                contentArea.scrollTop = 0;
                container.scrollTop = 0;
                
                return;
            } catch (error) {
                console.error('Worker parsing failed, falling back to incremental rendering:', error);
                // Fall through to incremental rendering as backup
            }
        }
        
        // For smaller content or as fallback, use incremental rendering
        try {
            // Parse the markdown
            const html = marked(currentPage.text);
            
            // Check if task was cancelled
            if (task.cancelled) return;
            
            // Remove loading indicator
            if (loadingIndicator.parentElement === contentArea) {
                contentArea.removeChild(loadingIndicator);
            }
            
            // Set the content
            contentArea.innerHTML = html;
            
            // Activate code blocks and defer non-visible ones
            activateVisibleCodeBlocks(contentArea);
            
            // Scroll to top
            contentArea.scrollTop = 0;
            container.scrollTop = 0;
        } catch (error) {
            console.error('Error during incremental rendering:', error);
            contentArea.innerHTML = `<div class="error-message">Error rendering content: ${error.message}</div>`;
        }
    };
    
    // Set up intersection observer for lazy loading code blocks
    const setupLazyLoading = () => {
        if (!('IntersectionObserver' in window)) return; // Not supported
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const block = entry.target;
                    if (block.hasAttribute('data-needs-activation')) {
                        activateCodeBlock(block);
                        block.removeAttribute('data-needs-activation');
                        observer.unobserve(block);
                    }
                }
            });
        }, {
            root: container,
            rootMargin: '100px',
            threshold: 0.1
        });
        
        // Find all code blocks that need activation
        const pendingBlocks = contentArea.querySelectorAll('.executable-code-block[data-needs-activation]');
        pendingBlocks.forEach(block => {
            observer.observe(block);
        });
    };
    
    // Only activate code blocks that are visible
    const activateVisibleCodeBlocks = (container) => {
        if (!container) return;
        
        // Find all code blocks
        const codeBlocks = container.querySelectorAll('.executable-code-block');
        
        if ('IntersectionObserver' in window) {
            // Mark for lazy loading
            codeBlocks.forEach(block => {
                block.setAttribute('data-needs-activation', 'true');
            });
            
            // Set up lazy loading after a short delay
            setTimeout(setupLazyLoading, 100);
        } else {
            // Fallback for browsers without IntersectionObserver
            activateCodeBlocks(container);
        }
    };
    
    // Add event listeners to pagination controls
    if (pageNav) {
        pageNav.querySelector('.pagination-prev').addEventListener('click', () => {
            if (currentPageNum > 1) {
                currentPageNum--;
                renderPageIncrementally(currentPageNum);
            }
        });
        
        pageNav.querySelector('.pagination-next').addEventListener('click', () => {
            if (currentPageNum < totalPages) {
                currentPageNum++;
                renderPageIncrementally(currentPageNum);
            }
        });
    }
    
    // Add keyboard navigation
    const keyHandler = (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            if (currentPageNum < totalPages) {
                currentPageNum++;
                renderPageIncrementally(currentPageNum);
                e.preventDefault();
            }
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            if (currentPageNum > 1) {
                currentPageNum--;
                renderPageIncrementally(currentPageNum);
                e.preventDefault();
            }
        }
    };
    
    container.addEventListener('keydown', keyHandler);
    
    // Add cleanup function
    const cleanup = () => {
        container.removeEventListener('keydown', keyHandler);
        if (currentRenderTask) {
            currentRenderTask.cancelled = true;
        }
    };
    
    // Start rendering the initial page
    requestAnimationFrame(() => {
        renderPageIncrementally(paginationOptions.initialPage);
    });
    
    // Return control object
    return {
        totalPages,
        goToPage: renderPageIncrementally,
        currentPage: paginationOptions.initialPage,
        cleanup
    };
}

// Activate a single code block
function activateCodeBlock(block) {
    const runButton = block.querySelector('.run-js-btn');
    const resultElement = block.querySelector('.js-result');
    
    if (!runButton || !resultElement) return;
    
    // Set up the click handler if not already set
    if (!runButton.hasAttribute('data-initialized')) {
        runButton.setAttribute('data-initialized', 'true');
        runButton.addEventListener('click', () => {
            const preElement = block.querySelector('pre');
            const codeElement = preElement ? preElement.querySelector('code') : null;
            
            if (codeElement && executeJS) {
                // Clear previous results
                resultElement.innerHTML = '';
                
                // Get the code content
                const code = codeElement.textContent || '';
                
                // Execute the code
                executeJS(code, resultElement);
            }
        });
    }
    
    // Automatically execute code blocks with 'auto-run' class
    if (block.classList.contains('auto-run')) {
        const preElement = block.querySelector('pre');
        const codeElement = preElement ? preElement.querySelector('code') : null;
        
        if (codeElement && executeJS) {
            // Clear previous results
            resultElement.innerHTML = '';
            
            // Get the code content
            const code = codeElement.textContent || '';
            
            // Execute the code
            executeJS(code, resultElement);
        }
    }
}

// Function to activate executable code blocks
export function activateCodeBlocks(container) {
    if (!container) return;
    
    // Find all code blocks with run buttons
    const codeBlocks = container.querySelectorAll('.executable-code-block');
    
    // Process in batches for better performance
    if (codeBlocks.length > 10) {
        let index = 0;
        
        const processBatch = () => {
            const end = Math.min(index + 5, codeBlocks.length);
            for (let i = index; i < end; i++) {
                activateCodeBlock(codeBlocks[i]);
            }
            
            index = end;
            if (index < codeBlocks.length) {
                setTimeout(processBatch, 0);
            }
        };
        
        processBatch();
    } else {
        // For small numbers, just process directly
        codeBlocks.forEach(block => activateCodeBlock(block));
    }
}

// Function to render markdown and activate code blocks
export function renderMarkdownWithCodeBlocks(markdown, container) {
    if (!container) {
        console.error('Container element is required for rendering markdown with code blocks');
        return;
    }
    
    // Check if content is large and would benefit from pagination
    const usePagination = markdown.length > 10000; // Reduced threshold for pagination
    
    if (usePagination) {
        return renderMarkdownWithPagination(markdown, container);
    } else {
        // For smaller content, use Web Worker if available
        if (markdown.length > 5000) {
            // Show loading indicator
            container.innerHTML = '<div class="markdown-loading"><div class="spinner"></div><span>Rendering content...</span></div>';
            
            // Use worker for parsing
            parseMarkdownInWorker(markdown)
                .then(html => {
                    container.innerHTML = `<div class="markdown-content">${html}</div>`;
                    activateCodeBlocks(container);
                })
                .catch(error => {
                    console.error('Worker parsing failed, falling back to direct rendering:', error);
                    container.innerHTML = renderMarkdown(markdown);
                    activateCodeBlocks(container);
                });
        } else {
            // For very small content, render directly
            container.innerHTML = renderMarkdown(markdown);
            activateCodeBlocks(container);
        }
    }
    
    return container;
}

// Function to render a markdown file
export async function renderMarkdownFile(file) {
    try {
        const content = await file.text();
        
        // For files, always check size for pagination when actually rendering
        return { 
            content,
            render: (container) => renderMarkdownWithCodeBlocks(content, container)
        };
    } catch (error) {
        console.error('Error rendering markdown file:', error);
        return {
            error: error.message,
            render: (container) => {
                if (container) {
                    container.innerHTML = `<div class="error-message">Error rendering markdown file: ${error.message}</div>`;
                }
                return `<div class="error-message">Error rendering markdown file: ${error.message}</div>`;
            }
        };
    }
}

// Clean up resources when no longer needed
export function cleanup() {
    terminateWorker('markdown');
}

// Export the renderer function
export default {
    renderMarkdown,
    activateCodeBlocks,
    renderMarkdownWithCodeBlocks,
    renderMarkdownWithPagination,
    renderMarkdownFile,
    cleanup
};