// HTML renderer module - Direct DOM injection approach

/**
 * Renders HTML content into the specified container
 * @param {string} content - The HTML content to render
 * @param {HTMLElement} container - The container to append the rendered content to
 * @param {Object} options - Optional rendering options
 */
export function renderHTML(content, container, options = {}) {
    console.log('Rendering HTML with direct DOM injection...');
    
    try {
        // Create a wrapper for the content
        const wrapper = document.createElement('div');
        wrapper.className = 'html-content-wrapper';
        wrapper.style.width = '100%';
        wrapper.style.height = '100%';
        wrapper.style.overflow = 'auto';
        
        // Extract head content to handle separately
        const headMatch = content.match(/<head>([\s\S]*?)<\/head>/i);
        const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        
        if (bodyMatch) {
            // Extract just the body content
            wrapper.innerHTML = bodyMatch[1];
        } else {
            // Fallback if no body tags - inject everything
            wrapper.innerHTML = content;
        }
        
        // Handle the head content separately to ensure scripts load properly
        if (headMatch) {
            const headContent = headMatch[1];
            
            // Extract and inject stylesheets
            const styleRegex = /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
            let styleMatch;
            while ((styleMatch = styleRegex.exec(headContent)) !== null) {
                const stylesheet = document.createElement('link');
                stylesheet.rel = 'stylesheet';
                stylesheet.href = styleMatch[1];
                document.head.appendChild(stylesheet);
            }
            
            // Extract and inject scripts
            const scriptRegex = /<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi;
            let scriptMatch;
            while ((scriptMatch = scriptRegex.exec(headContent)) !== null) {
                const script = document.createElement('script');
                script.src = scriptMatch[1];
                document.head.appendChild(script);
            }
            
            // Extract and inject inline styles
            const inlineStyleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
            let inlineStyleMatch;
            while ((inlineStyleMatch = inlineStyleRegex.exec(headContent)) !== null) {
                const style = document.createElement('style');
                style.textContent = inlineStyleMatch[1];
                document.head.appendChild(style);
                
                // Also append to the wrapper to ensure styles are applied
                const wrapperStyle = document.createElement('style');
                wrapperStyle.textContent = inlineStyleMatch[1];
                wrapper.appendChild(wrapperStyle);
            }
        }
        
        // Clear the container and append our wrapper
        container.innerHTML = '';
        container.appendChild(wrapper);
        
        // Specifically handle Tailwind CSS loading
        if (content.includes('tailwind') || content.includes('Tailwind')) {
            const tailwindScript = document.createElement('script');
            tailwindScript.src = 'https://cdn.tailwindcss.com';
            container.appendChild(tailwindScript);
        }
        
        console.log('HTML rendered successfully with direct DOM injection');
    } catch (error) {
        console.error('Error rendering HTML content:', error);
        container.innerHTML = `
            <div class="error" style="padding: 20px; text-align: center; color: #e74c3c;">
                <h3>Error Rendering HTML Content</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// Cleanup function
export function cleanup() {
    // Remove any scripts or styles we added to head
    const addedElements = document.querySelectorAll('head > [data-added-by-renderer]');
    addedElements.forEach(el => el.remove());
    
    console.log('HTML renderer cleanup complete');
}

// Make the renderer available globally for non-module environments
if (typeof window !== 'undefined') {
    window.renderHTML = renderHTML;
} 