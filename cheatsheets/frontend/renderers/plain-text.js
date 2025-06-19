// Plain text renderer module

/**
 * Renders plain text content into the specified container
 * @param {string} content - The plain text content to render
 * @param {HTMLElement} container - The container to append the rendered content to
 * @param {Object} options - Optional rendering options
 * @param {boolean} options.lineNumbers - Whether to show line numbers (default: true)
 * @param {boolean} options.detectSyntax - Whether to auto-detect and apply syntax highlighting (default: true)
 * @param {boolean} options.wordWrap - Whether to wrap long lines (default: false)
 * @param {string} options.language - Specific language for syntax highlighting
 */
export function renderPlainText(content, container, options = {}) {
    console.log('Rendering plain text...');
    
    // Set default options
    const renderOptions = {
        lineNumbers: true,
        detectSyntax: true,
        wordWrap: false,
        ...options
    };
    
    // Create wrapper
    const textWrapper = document.createElement('div');
    textWrapper.className = 'plain-text-wrapper';
    textWrapper.style.position = 'relative';
    textWrapper.style.width = '100%';
    textWrapper.style.maxWidth = '100%';
    textWrapper.style.overflowX = renderOptions.wordWrap ? 'hidden' : 'auto';
    
    // Create container for text
    const preElement = document.createElement('pre');
    preElement.className = 'plain-text';
    preElement.style.margin = '0';
    preElement.style.padding = '1rem';
    preElement.style.paddingLeft = renderOptions.lineNumbers ? '4rem' : '1rem';
    preElement.style.fontSize = '14px';
    preElement.style.lineHeight = '1.5';
    preElement.style.fontFamily = "'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace";
    preElement.style.backgroundColor = '#f8f9fa';
    preElement.style.border = '1px solid #e9ecef';
    preElement.style.borderRadius = '4px';
    preElement.style.whiteSpace = renderOptions.wordWrap ? 'pre-wrap' : 'pre';
    
    // Create language detector and toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'plain-text-toolbar';
    toolbar.style.display = 'flex';
    toolbar.style.justifyContent = 'space-between';
    toolbar.style.padding = '0.5rem';
    toolbar.style.backgroundColor = '#e9ecef';
    toolbar.style.borderTopLeftRadius = '4px';
    toolbar.style.borderTopRightRadius = '4px';
    toolbar.style.fontSize = '0.85rem';
    toolbar.style.marginBottom = '-1px';
    
    // Add File type info to toolbar
    const fileTypeSpan = document.createElement('span');
    fileTypeSpan.className = 'file-type';
    fileTypeSpan.style.fontWeight = 'bold';
    toolbar.appendChild(fileTypeSpan);
    
    // Add controls to toolbar
    const controls = document.createElement('div');
    controls.className = 'toolbar-controls';
    controls.style.display = 'flex';
    controls.style.gap = '0.5rem';
    
    // Word wrap toggle
    const wordWrapBtn = document.createElement('button');
    wordWrapBtn.className = 'toolbar-btn';
    wordWrapBtn.innerHTML = '<i class="fas fa-align-left"></i>';
    wordWrapBtn.title = 'Toggle Word Wrap';
    wordWrapBtn.style.background = 'none';
    wordWrapBtn.style.border = 'none';
    wordWrapBtn.style.cursor = 'pointer';
    wordWrapBtn.style.opacity = renderOptions.wordWrap ? '1' : '0.6';
    
    // Copy to clipboard button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'toolbar-btn';
    copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
    copyBtn.title = 'Copy to Clipboard';
    copyBtn.style.background = 'none';
    copyBtn.style.border = 'none';
    copyBtn.style.cursor = 'pointer';
    
    // Download button
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'toolbar-btn';
    downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
    downloadBtn.title = 'Download as Text File';
    downloadBtn.style.background = 'none';
    downloadBtn.style.border = 'none';
    downloadBtn.style.cursor = 'pointer';
    
    // Add buttons to controls
    controls.appendChild(wordWrapBtn);
    controls.appendChild(copyBtn);
    controls.appendChild(downloadBtn);
    toolbar.appendChild(controls);
    
    // Function to handle word wrap toggle
    wordWrapBtn.addEventListener('click', () => {
        const isWrapped = preElement.style.whiteSpace === 'pre-wrap';
        preElement.style.whiteSpace = isWrapped ? 'pre' : 'pre-wrap';
        textWrapper.style.overflowX = isWrapped ? 'auto' : 'hidden';
        wordWrapBtn.style.opacity = isWrapped ? '0.6' : '1';
    });
    
    // Function to handle copy to clipboard
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(content).then(() => {
            copyBtn.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => {
                copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            copyBtn.innerHTML = '<i class="fas fa-times"></i>';
            setTimeout(() => {
                copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
            }, 2000);
        });
    });
    
    // Function to handle download
    downloadBtn.addEventListener('click', () => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'download.txt';
        a.click();
        URL.revokeObjectURL(url);
    });
    
    // Try to detect file type for syntax highlighting
    let language = renderOptions.language;
    let fileType = 'Plain Text';
    
    if (renderOptions.detectSyntax && !language) {
        // Simple file type detection based on content patterns
        if (/^<\!DOCTYPE html>|<html[>\s]/i.test(content)) {
            language = 'html';
            fileType = 'HTML';
        } else if (/^import\s+|export\s+|const\s+|let\s+|class\s+|function\s+/m.test(content)) {
            language = 'javascript';
            fileType = 'JavaScript';
        } else if (/^package\s+|import\s+java|public\s+class|private\s+|protected\s+/m.test(content)) {
            language = 'java';
            fileType = 'Java';
        } else if (/^using\s+System|namespace\s+|public\s+class|private\s+|protected\s+/m.test(content)) {
            language = 'csharp';
            fileType = 'C#';
        } else if (/^import\s+|def\s+|class\s+|if\s+__name__\s*==\s*('|")__main__('|")/m.test(content)) {
            language = 'python';
            fileType = 'Python';
        } else if (/^SELECT|INSERT|UPDATE|DELETE|CREATE\s+TABLE|ALTER\s+TABLE/i.test(content)) {
            language = 'sql';
            fileType = 'SQL';
        } else if (/\{\s*("[\w\s]+"\s*:\s*(["{}\[\]0-9.]+|"[^"]*"),?\s*)+\s*\}/m.test(content)) {
            language = 'json';
            fileType = 'JSON';
        } else if (/<\?xml\s+version/i.test(content)) {
            language = 'xml';
            fileType = 'XML';
        } else if (/^#include\s+<|int\s+main\s*\(|void\s+\w+\s*\(/m.test(content)) {
            language = 'cpp';
            fileType = 'C/C++';
        } else if (/^\s*\[.*\]|\w+\s*=\s*["'].+["']/m.test(content)) {
            language = 'ini';
            fileType = 'Configuration File';
        }
    } else if (language) {
        // Set file type based on provided language
        switch (language) {
            case 'html': fileType = 'HTML'; break;
            case 'javascript': case 'js': language = 'javascript'; fileType = 'JavaScript'; break;
            case 'java': fileType = 'Java'; break;
            case 'csharp': case 'cs': language = 'csharp'; fileType = 'C#'; break;
            case 'python': case 'py': language = 'python'; fileType = 'Python'; break;
            case 'sql': fileType = 'SQL'; break;
            case 'json': fileType = 'JSON'; break;
            case 'xml': fileType = 'XML'; break;
            case 'cpp': case 'c': language = 'cpp'; fileType = 'C/C++'; break;
            case 'ini': case 'toml': language = 'ini'; fileType = 'Configuration File'; break;
            default: fileType = language.charAt(0).toUpperCase() + language.slice(1);
        }
    }
    
    // Update file type display
    fileTypeSpan.textContent = fileType;
    
    // Create code element for highlighting
    const codeElement = document.createElement('code');
    codeElement.style.padding = '0';
    codeElement.style.fontFamily = 'inherit';
    
    // Apply syntax highlighting if language is detected and hljs is available
    if (language && typeof hljs !== 'undefined') {
        codeElement.className = `language-${language}`;
        codeElement.textContent = content;
        try {
            hljs.highlightElement(codeElement);
        } catch (err) {
            console.error('Error applying syntax highlighting:', err);
            codeElement.textContent = content; // Fall back to plain text
        }
    } else {
        codeElement.textContent = content; // Just use plain text
    }
    
    // Add line numbers if enabled
    if (renderOptions.lineNumbers) {
        const lineNumbersContainer = document.createElement('div');
        lineNumbersContainer.className = 'line-numbers';
        lineNumbersContainer.style.position = 'absolute';
        lineNumbersContainer.style.left = '0';
        lineNumbersContainer.style.top = '0';
        lineNumbersContainer.style.width = '3rem';
        lineNumbersContainer.style.height = '100%';
        lineNumbersContainer.style.padding = '1rem 0.5rem';
        lineNumbersContainer.style.textAlign = 'right';
        lineNumbersContainer.style.backgroundColor = '#e9ecef';
        lineNumbersContainer.style.color = '#6c757d';
        lineNumbersContainer.style.borderRight = '1px solid #dee2e6';
        lineNumbersContainer.style.fontFamily = preElement.style.fontFamily;
        lineNumbersContainer.style.fontSize = preElement.style.fontSize;
        lineNumbersContainer.style.lineHeight = preElement.style.lineHeight;
        lineNumbersContainer.style.userSelect = 'none';
        
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const lineNumber = document.createElement('div');
            lineNumber.textContent = i + 1;
            lineNumber.style.height = '1.5em';
            lineNumbersContainer.appendChild(lineNumber);
        }
        
        textWrapper.appendChild(lineNumbersContainer);
    }
    
    // Assemble final structure
    preElement.appendChild(codeElement);
    textWrapper.appendChild(toolbar);
    textWrapper.appendChild(preElement);
    container.appendChild(textWrapper);
    
    // Add search functionality (simple text search)
    const searchContainer = document.createElement('div');
    searchContainer.className = 'plain-text-search';
    searchContainer.style.position = 'absolute';
    searchContainer.style.top = '4rem';
    searchContainer.style.right = '1rem';
    searchContainer.style.display = 'none';
    searchContainer.style.padding = '0.5rem';
    searchContainer.style.backgroundColor = 'white';
    searchContainer.style.border = '1px solid #dee2e6';
    searchContainer.style.borderRadius = '4px';
    searchContainer.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
    searchContainer.style.zIndex = '10';
    
    searchContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
            <input type="text" id="text-search-input" placeholder="Search in text..." 
                   style="padding: 0.3rem; border: 1px solid #ced4da; border-radius: 4px;">
            <span id="text-search-count"></span>
            <button id="text-search-close" style="background: none; border: none; cursor: pointer;">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div style="display: flex; gap: 0.5rem;">
            <button id="text-search-prev" style="padding: 0.2rem 0.5rem; border: 1px solid #ced4da; border-radius: 4px; background: white;">
                <i class="fas fa-chevron-up"></i>
            </button>
            <button id="text-search-next" style="padding: 0.2rem 0.5rem; border: 1px solid #ced4da; border-radius: 4px; background: white;">
                <i class="fas fa-chevron-down"></i>
            </button>
            <label style="display: flex; align-items: center; gap: 0.3rem; margin-left: auto;">
                <input type="checkbox" id="text-search-case-sensitive">
                Case sensitive
            </label>
        </div>
    `;
    
    textWrapper.appendChild(searchContainer);
    
    // Keyboard shortcut to open search (Ctrl+F or Cmd+F)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f' && textWrapper.contains(document.activeElement)) {
            e.preventDefault();
            searchContainer.style.display = 'block';
            document.getElementById('text-search-input').focus();
        }
        
        if (e.key === 'Escape' && searchContainer.style.display === 'block') {
            searchContainer.style.display = 'none';
        }
    });
    
    // Close button
    document.getElementById('text-search-close')?.addEventListener('click', () => {
        searchContainer.style.display = 'none';
        clearHighlights();
    });
    
    // Implement search functionality
    let matches = [];
    let currentMatchIndex = -1;
    
    function clearHighlights() {
        const highlighted = document.querySelectorAll('.text-search-highlight');
        highlighted.forEach(el => {
            el.outerHTML = el.textContent;
        });
        document.getElementById('text-search-count').textContent = '';
    }
    
    function createHighlightedText(text, searchText, caseSensitive) {
        const searchRegex = new RegExp(searchText.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 
                                      `g${caseSensitive ? '' : 'i'}`);
        return text.replace(searchRegex, match => 
            `<span class="text-search-highlight" style="background-color: #ffeb3b; color: black;">${match}</span>`
        );
    }
    
    document.getElementById('text-search-input')?.addEventListener('input', performSearch);
    document.getElementById('text-search-case-sensitive')?.addEventListener('change', performSearch);
    document.getElementById('text-search-prev')?.addEventListener('click', () => navigateMatches(-1));
    document.getElementById('text-search-next')?.addEventListener('click', () => navigateMatches(1));
    
    function performSearch() {
        const searchInput = document.getElementById('text-search-input');
        const caseSensitive = document.getElementById('text-search-case-sensitive').checked;
        const searchText = searchInput.value;
        
        clearHighlights();
        
        if (searchText.length < 2) return;
        
        // Create a temporary div to apply highlighting without affecting the actual content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = createHighlightedText(codeElement.innerHTML, searchText, caseSensitive);
        
        // Get all highlights and store their references
        matches = tempDiv.querySelectorAll('.text-search-highlight');
        
        if (matches.length > 0) {
            document.getElementById('text-search-count').textContent = `${matches.length} matches`;
            
            // Replace the code content with highlighted version
            codeElement.innerHTML = tempDiv.innerHTML;
            
            // Navigate to first match
            currentMatchIndex = 0;
            navigateToMatch(currentMatchIndex);
        } else {
            document.getElementById('text-search-count').textContent = 'No matches';
        }
    }
    
    function navigateMatches(direction) {
        if (matches.length === 0) return;
        
        currentMatchIndex = (currentMatchIndex + direction + matches.length) % matches.length;
        navigateToMatch(currentMatchIndex);
    }
    
    function navigateToMatch(index) {
        const match = document.querySelectorAll('.text-search-highlight')[index];
        if (!match) return;
        
        // Remove current-match class from all matches
        document.querySelectorAll('.text-search-highlight').forEach(el => {
            el.style.backgroundColor = '#ffeb3b';
            el.style.color = 'black';
        });
        
        // Add current-match class to current match
        match.style.backgroundColor = '#ff9800';
        match.style.color = 'white';
        
        // Scroll to match
        match.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
        
        // Update count display
        document.getElementById('text-search-count').textContent = `${index + 1} of ${matches.length}`;
    }
} 