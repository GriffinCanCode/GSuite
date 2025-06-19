/**
 * Renderer Module Index
 * This module exposes various renderers for different file types.
 */

import * as MarkdownRenderer from './markdown.js';
import * as HTMLRenderer from './html.js';
import * as PlainTextRenderer from './plain-text.js';
import * as PDFRenderer from './pdf.js';
import { terminateAllWorkers } from './worker-manager.js';

// Create a mapping of file extensions to renderer functions
const renderers = {
    // Text-based files
    'md': MarkdownRenderer.renderMarkdown,
    'markdown': MarkdownRenderer.renderMarkdown,
    'txt': PlainTextRenderer.renderPlainText,
    
    // HTML files
    'html': HTMLRenderer.renderHTML,
    'htm': HTMLRenderer.renderHTML,
    
    // PDF files
    'pdf': PDFRenderer.renderPDF,
};

/**
 * Render content based on file extension
 * @param {string} content - The file content
 * @param {string} fileExtension - The file extension
 * @param {HTMLElement} container - The container to render into
 * @param {Object} options - Additional rendering options
 * @returns {Promise<string|Object>} - Rendered content or rendering object
 */
export async function renderContent(content, fileExtension, container, options = {}) {
    fileExtension = fileExtension.toLowerCase();
    
    // Show loading indicator for large content
    if (container && content.length > 20000) {
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'markdown-loading';
        loadingIndicator.innerHTML = '<div class="spinner"></div><span>Rendering content...</span>';
        container.innerHTML = '';
        container.appendChild(loadingIndicator);
        
        // Use setTimeout to allow the loading indicator to appear before
        // the potentially heavy rendering starts
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(renderContentInternal(content, fileExtension, container, options));
            }, 10);
        });
    }
    
    return renderContentInternal(content, fileExtension, container, options);
}

/**
 * Internal function to render content after loading indicator is shown
 */
function renderContentInternal(content, fileExtension, container, options = {}) {
    if (renderers[fileExtension]) {
        try {
            if (fileExtension === 'md' || fileExtension === 'markdown') {
                if (container) {
                    // Use pagination for large markdown files
                    if (content.length > 20000) {
                        return MarkdownRenderer.renderMarkdownWithPagination(content, container, options);
                    } else {
                        return MarkdownRenderer.renderMarkdownWithCodeBlocks(content, container);
                    }
                } else {
                    return MarkdownRenderer.renderMarkdown(content);
                }
            }
            
            // For other file types
            const renderedContent = renderers[fileExtension](content, container, options);
            
            // Don't modify container for renderer functions that handle it themselves
            if (renderedContent && container && !['html', 'htm', 'pdf'].includes(fileExtension)) {
                container.innerHTML = renderedContent;
            }
            
            return renderedContent;
        } catch (error) {
            console.error(`Error rendering ${fileExtension} content:`, error);
            const errorMessage = `<div class="error-message">Error rendering content: ${error.message}</div>`;
            if (container) {
                container.innerHTML = errorMessage;
            }
            return errorMessage;
        }
    } else {
        const message = `<div class="unsupported-format">No renderer available for .${fileExtension} files</div>`;
        if (container) {
            container.innerHTML = message;
        }
        return message;
    }
}

/**
 * Render a file object
 * @param {File} file - The file object to render
 * @param {HTMLElement} container - The container to render into
 * @param {Object} options - Additional rendering options
 * @returns {Promise<string|Object>} - Rendered content or rendering object
 */
export async function renderFile(file, container, options = {}) {
    try {
        const fileExtension = file.name.split('.').pop().toLowerCase();
        
        // Show loading indicator for potentially large files
        if (container && (file.size > 100000 || fileExtension === 'md' || fileExtension === 'markdown')) {
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'markdown-loading';
            loadingIndicator.innerHTML = '<div class="spinner"></div><span>Loading file...</span>';
            container.innerHTML = '';
            container.appendChild(loadingIndicator);
        }
        
        if (fileExtension === 'md' || fileExtension === 'markdown') {
            const content = await file.text();
            return renderContent(content, fileExtension, container, options);
        }
        
        // Handle PDF files
        if (fileExtension === 'pdf') {
            return PDFRenderer.renderPDFFile(file, container, options);
        }
        
        // Handle other file types
        const content = await file.text();
        return renderContent(content, fileExtension || 'txt', container, options);
    } catch (error) {
        console.error('Error rendering file:', error);
        const errorMessage = `<div class="error-message">Error rendering file: ${error.message}</div>`;
        if (container) {
            container.innerHTML = errorMessage;
        }
        return errorMessage;
    }
}

// Add a scroll to top button for long content
export function addScrollToTopButton(container) {
    if (!container) return;
    
    const topButton = document.createElement('div');
    topButton.className = 'markdown-top-button';
    topButton.innerHTML = '<i class="fas fa-arrow-up"></i>';
    topButton.style.display = 'none';
    
    container.appendChild(topButton);
    
    topButton.addEventListener('click', () => {
        container.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
    
    // Show/hide button based on scroll position
    container.addEventListener('scroll', () => {
        if (container.scrollTop > 300) {
            topButton.classList.add('visible');
        } else {
            topButton.classList.remove('visible');
        }
    });
    
    return topButton;
}

/**
 * Clean up all renderer resources
 */
export function cleanup() {
    // Cleanup individual renderers
    MarkdownRenderer.cleanup();
    if (PDFRenderer.cleanup) PDFRenderer.cleanup();
    if (HTMLRenderer.cleanup) HTMLRenderer.cleanup();
    
    // Terminate all workers
    terminateAllWorkers();
}

// Export the available renderers and utility functions
export default {
    renderContent,
    renderFile,
    addScrollToTopButton,
    cleanup,
    markdownRenderer: MarkdownRenderer,
    htmlRenderer: HTMLRenderer,
    plainTextRenderer: PlainTextRenderer,
    pdfRenderer: PDFRenderer
}; 