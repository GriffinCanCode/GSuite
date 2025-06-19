// PDF renderer module

/**
 * Renders PDF content into the specified container
 * @param {string} pdfPath - The path to the PDF file
 * @param {HTMLElement} container - The container to append the rendered content to
 * @param {Object} options - Optional rendering options
 * @param {boolean} options.enableAnnotations - Whether to enable annotation tools (default: true)
 * @param {boolean} options.showThumbnails - Whether to show page thumbnails (default: true)
 * @param {boolean} options.enableSearch - Whether to enable text search (default: true)
 */
export function renderPDF(pdfPath, container, options = {}) {
    // Set default options
    const renderOptions = {
        enableAnnotations: true,
        showThumbnails: true,
        enableSearch: true,
        ...options
    };
    
    // Main PDF container
    const pdfContainer = document.createElement('div');
    pdfContainer.className = 'pdf-container';
    pdfContainer.style.display = 'flex';
    pdfContainer.style.flexDirection = 'column';
    pdfContainer.style.height = '100%';
    pdfContainer.style.width = '100%';
    pdfContainer.style.maxWidth = '100%';
    
    // Create loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'pdf-loading';
    loadingIndicator.innerHTML = `
        <div class="spinner"></div>
        <p>Loading PDF document...</p>
    `;
    loadingIndicator.style.display = 'flex';
    loadingIndicator.style.alignItems = 'center';
    loadingIndicator.style.justifyContent = 'center';
    loadingIndicator.style.flexDirection = 'column';
    loadingIndicator.style.height = '200px';
    pdfContainer.appendChild(loadingIndicator);
    
    // Create enhanced PDF toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'pdf-toolbar';
    toolbar.style.display = 'flex';
    toolbar.style.alignItems = 'center';
    toolbar.style.padding = '10px';
    toolbar.style.borderBottom = '1px solid #ddd';
    toolbar.style.backgroundColor = '#f5f5f5';
    toolbar.style.flexWrap = 'wrap';
    toolbar.style.gap = '5px';
    
    // Navigation controls
    const navControls = document.createElement('div');
    navControls.className = 'pdf-nav-controls';
    navControls.style.display = 'flex';
    navControls.style.alignItems = 'center';
    navControls.style.marginRight = '15px';
    
    navControls.innerHTML = `
        <button id="first-page-btn" title="First Page"><i class="fas fa-step-backward"></i></button>
        <button id="prev-page-btn" title="Previous Page"><i class="fas fa-arrow-left"></i></button>
        <div class="pdf-page-info">
            <input type="number" id="current-page-input" min="1" value="1" style="width: 50px; text-align: center;">
            <span> / </span>
            <span id="total-pages">?</span>
        </div>
        <button id="next-page-btn" title="Next Page"><i class="fas fa-arrow-right"></i></button>
        <button id="last-page-btn" title="Last Page"><i class="fas fa-step-forward"></i></button>
    `;
    
    // Zoom controls
    const zoomControls = document.createElement('div');
    zoomControls.className = 'pdf-zoom-controls';
    zoomControls.style.display = 'flex';
    zoomControls.style.alignItems = 'center';
    zoomControls.style.marginRight = '15px';
    
    zoomControls.innerHTML = `
        <button id="zoom-out-btn" title="Zoom Out"><i class="fas fa-search-minus"></i></button>
        <select id="zoom-select" title="Zoom Level">
            <option value="0.5">50%</option>
            <option value="0.75">75%</option>
            <option value="1">100%</option>
            <option value="1.25">125%</option>
            <option value="1.5" selected>150%</option>
            <option value="2">200%</option>
            <option value="3">300%</option>
            <option value="auto">Page Fit</option>
            <option value="width">Page Width</option>
        </select>
        <button id="zoom-in-btn" title="Zoom In"><i class="fas fa-search-plus"></i></button>
    `;
    
    // View controls
    const viewControls = document.createElement('div');
    viewControls.className = 'pdf-view-controls';
    viewControls.style.display = 'flex';
    viewControls.style.alignItems = 'center';
    viewControls.style.marginRight = '15px';
    
    let viewControlsHTML = `
        <button id="toggle-sidebar-btn" title="Toggle Sidebar"><i class="fas fa-columns"></i></button>
        <button id="rotate-btn" title="Rotate Page"><i class="fas fa-redo"></i></button>
    `;
    
    // Add presentation mode button
    viewControlsHTML += `<button id="presentation-btn" title="Presentation Mode"><i class="fas fa-presentation"></i></button>`;
    
    // Add dark mode toggle for PDF
    viewControlsHTML += `<button id="pdf-dark-mode-btn" title="Toggle Dark Mode"><i class="fas fa-moon"></i></button>`;
    
    viewControls.innerHTML = viewControlsHTML;
    
    // Search controls (if enabled)
    let searchControls;
    if (renderOptions.enableSearch) {
        searchControls = document.createElement('div');
        searchControls.className = 'pdf-search-controls';
        searchControls.style.display = 'flex';
        searchControls.style.alignItems = 'center';
        searchControls.style.marginLeft = 'auto';
        
        searchControls.innerHTML = `
            <div class="pdf-search-box" style="position: relative;">
                <input type="text" id="pdf-search-input" placeholder="Search...">
                <button id="pdf-search-prev" title="Previous Match"><i class="fas fa-chevron-up"></i></button>
                <button id="pdf-search-next" title="Next Match"><i class="fas fa-chevron-down"></i></button>
                <span id="pdf-search-results"></span>
                <button id="pdf-search-close" style="display: none;"><i class="fas fa-times"></i></button>
            </div>
            <button id="pdf-search-toggle"><i class="fas fa-search"></i></button>
        `;
    }
    
    // Assemble toolbar
    toolbar.appendChild(navControls);
    toolbar.appendChild(zoomControls);
    toolbar.appendChild(viewControls);
    if (searchControls) toolbar.appendChild(searchControls);
    
    // Main content area (will contain sidebar and viewer)
    const contentArea = document.createElement('div');
    contentArea.className = 'pdf-content-area';
    contentArea.style.display = 'flex';
    contentArea.style.flex = '1';
    contentArea.style.overflow = 'hidden';
    contentArea.style.position = 'relative';
    
    // Sidebar for thumbnails and annotations (if enabled)
    const sidebar = document.createElement('div');
    sidebar.className = 'pdf-sidebar';
    sidebar.style.width = '200px';
    sidebar.style.borderRight = '1px solid #ddd';
    sidebar.style.height = '100%';
    sidebar.style.display = 'flex';
    sidebar.style.flexDirection = 'column';
    sidebar.style.transition = 'transform 0.3s';
    
    // Sidebar tabs
    sidebar.innerHTML = `
        <div class="sidebar-tabs">
            <button class="sidebar-tab active" data-tab="thumbnails"><i class="fas fa-images"></i> Pages</button>
            ${renderOptions.enableAnnotations ? '<button class="sidebar-tab" data-tab="annotations"><i class="fas fa-sticky-note"></i> Notes</button>' : ''}
            <button class="sidebar-tab" data-tab="outline"><i class="fas fa-list"></i> Outline</button>
        </div>
        <div class="sidebar-content">
            <div class="sidebar-panel active" id="thumbnails-panel">
                <div class="thumbnails-container"></div>
            </div>
            ${renderOptions.enableAnnotations ? '<div class="sidebar-panel" id="annotations-panel"><div class="annotations-container"></div></div>' : ''}
            <div class="sidebar-panel" id="outline-panel">
                <div class="outline-container"></div>
            </div>
        </div>
    `;
    
    // PDF Viewer (main content)
    const viewer = document.createElement('div');
    viewer.className = 'pdf-viewer';
    viewer.style.flex = '1';
    viewer.style.overflow = 'auto';
    viewer.style.padding = '20px';
    viewer.style.display = 'flex';
    viewer.style.justifyContent = 'center';
    viewer.style.backgroundColor = '#e0e0e0';
    
    // Canvas wrapper to allow for annotations overlay
    viewer.innerHTML = `
        <div class="pdf-canvas-container" style="position: relative;">
            <canvas id="pdf-canvas" style="box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);"></canvas>
            ${renderOptions.enableAnnotations ? '<div class="pdf-annotations-layer" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></div>' : ''}
        </div>
    `;
    
    // Assemble content area
    contentArea.appendChild(sidebar);
    contentArea.appendChild(viewer);
    
    // Add annotation toolbar if enabled
    if (renderOptions.enableAnnotations) {
        const annotationToolbar = document.createElement('div');
        annotationToolbar.className = 'pdf-annotation-toolbar';
        annotationToolbar.style.display = 'none';
        annotationToolbar.style.position = 'absolute';
        annotationToolbar.style.top = '10px';
        annotationToolbar.style.right = '10px';
        annotationToolbar.style.padding = '5px';
        annotationToolbar.style.backgroundColor = 'white';
        annotationToolbar.style.borderRadius = '5px';
        annotationToolbar.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
        annotationToolbar.style.zIndex = '100';
        
        annotationToolbar.innerHTML = `
            <button id="annotation-highlight" title="Highlight Text"><i class="fas fa-highlighter"></i></button>
            <button id="annotation-underline" title="Underline Text"><i class="fas fa-underline"></i></button>
            <button id="annotation-note" title="Add Note"><i class="fas fa-sticky-note"></i></button>
            <button id="annotation-draw" title="Draw"><i class="fas fa-pencil-alt"></i></button>
            <button id="annotation-clear" title="Clear Annotations"><i class="fas fa-trash"></i></button>
        `;
        
        contentArea.appendChild(annotationToolbar);
    }
    
    // Add components to main container
    pdfContainer.appendChild(toolbar);
    pdfContainer.appendChild(contentArea);
    container.appendChild(pdfContainer);
    
    // Initialize PDF.js
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
    
    // PDF rendering state
    let pdfDoc = null;
    let pageNum = 1;
    let pageRendering = false;
    let pageNumPending = null;
    let scale = 1.5;
    let rotation = 0;
    let darkMode = false;
    let pdfSearchController = null;
    let annotations = [];
    
    // Function to render a page
    function renderPage(num, updateViewport = true) {
        pageRendering = true;
        loadingIndicator.style.display = 'flex';
        
        pdfDoc.getPage(num).then(function(page) {
            const viewport = updateViewport ? 
                page.getViewport({ scale: scale, rotation: rotation }) : 
                page.getViewport({ scale: scale, rotation: rotation });
            
            const canvas = document.getElementById('pdf-canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            // Create a render context with dark mode inversion if needed
            const renderContext = {
                canvasContext: ctx,
                viewport: viewport,
                renderInteractiveForms: true
            };
            
            const renderTask = page.render(renderContext);
            
            renderTask.promise.then(function() {
                pageRendering = false;
                loadingIndicator.style.display = 'none';
                
                if (pageNumPending !== null) {
                    renderPage(pageNumPending);
                    pageNumPending = null;
                }
                
                // Update UI elements
                updateUIState();
                
                // Apply dark mode if enabled
                if (darkMode) {
                    applyDarkMode(canvas);
                }
                
                // Render annotations for the current page if enabled
                if (renderOptions.enableAnnotations) {
                    renderAnnotations(num);
                }
            }).catch(function(error) {
                console.error('Error rendering PDF page:', error);
                loadingIndicator.innerHTML = `
                    <div class="error">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Error rendering page: ${error.message}</p>
                    </div>
                `;
            });
        }).catch(function(error) {
            console.error('Error getting PDF page:', error);
            pageRendering = false;
            loadingIndicator.style.display = 'none';
            loadingIndicator.innerHTML = `
                <div class="error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error loading page: ${error.message}</p>
                </div>
            `;
        });
    }
    
    // Queue a new page render
    function queueRenderPage(num) {
        if (pageRendering) {
            pageNumPending = num;
        } else {
            renderPage(num);
        }
    }
    
    // Update UI state based on current page, zoom, etc.
    function updateUIState() {
        // Update current page indicator
        document.getElementById('current-page-input').value = pageNum;
        
        // Enable/disable navigation buttons
        document.getElementById('first-page-btn').disabled = pageNum <= 1;
        document.getElementById('prev-page-btn').disabled = pageNum <= 1;
        document.getElementById('next-page-btn').disabled = pageNum >= pdfDoc.numPages;
        document.getElementById('last-page-btn').disabled = pageNum >= pdfDoc.numPages;
        
        // Update active thumbnail
        const thumbnails = document.querySelectorAll('.thumbnail-item');
        thumbnails.forEach((thumb, index) => {
            if (index + 1 === pageNum) {
                thumb.classList.add('active');
                // Scroll to the active thumbnail
                thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                thumb.classList.remove('active');
            }
        });
        
        // Update zoom dropdown
        const zoomSelect = document.getElementById('zoom-select');
        const options = Array.from(zoomSelect.options);
        const option = options.find(opt => opt.value === scale.toString());
        if (option) {
            zoomSelect.value = scale.toString();
        } else {
            // If current scale is not in the options (custom zoom)
            zoomSelect.value = 'custom';
        }
    }
    
    // Apply dark mode to the canvas (inverts colors)
    function applyDarkMode(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            // Invert colors
            data[i] = 255 - data[i];         // red
            data[i + 1] = 255 - data[i + 1]; // green
            data[i + 2] = 255 - data[i + 2]; // blue
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        // Also update viewer background
        document.querySelector('.pdf-viewer').style.backgroundColor = '#1a1a2e';
    }
    
    // Render annotations for a specific page
    function renderAnnotations(pageNum) {
        const annotationsLayer = document.querySelector('.pdf-annotations-layer');
        if (!annotationsLayer) return;
        
        // Clear previous annotations
        annotationsLayer.innerHTML = '';
        
        // Filter annotations for the current page
        const pageAnnotations = annotations.filter(anno => anno.page === pageNum);
        
        // Render each annotation
        pageAnnotations.forEach(annotation => {
            const annoElement = document.createElement('div');
            annoElement.className = `pdf-annotation pdf-annotation-${annotation.type}`;
            annoElement.style.position = 'absolute';
            annoElement.style.left = `${annotation.x}px`;
            annoElement.style.top = `${annotation.y}px`;
            annoElement.style.width = `${annotation.width}px`;
            annoElement.style.height = `${annotation.height}px`;
            
            switch (annotation.type) {
                case 'highlight':
                    annoElement.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
                    annoElement.style.pointerEvents = 'auto';
                    break;
                case 'underline':
                    annoElement.style.borderBottom = '2px solid blue';
                    annoElement.style.pointerEvents = 'auto';
                    break;
                case 'note':
                    annoElement.innerHTML = `<i class="fas fa-sticky-note"></i>`;
                    annoElement.style.color = 'orange';
                    annoElement.style.fontSize = '20px';
                    annoElement.style.pointerEvents = 'auto';
                    
                    // Add tooltip with note content
                    annoElement.title = annotation.content;
                    
                    // Show note content on click
                    annoElement.addEventListener('click', () => {
                        const notePopup = document.createElement('div');
                        notePopup.className = 'note-popup';
                        notePopup.style.position = 'absolute';
                        notePopup.style.left = `${annotation.x + 20}px`;
                        notePopup.style.top = `${annotation.y + 20}px`;
                        notePopup.style.backgroundColor = 'white';
                        notePopup.style.border = '1px solid #ddd';
                        notePopup.style.padding = '10px';
                        notePopup.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
                        notePopup.style.zIndex = '200';
                        notePopup.style.maxWidth = '300px';
                        
                        notePopup.innerHTML = `
                            <div class="note-header">
                                <span>Note</span>
                                <button class="note-close"><i class="fas fa-times"></i></button>
                            </div>
                            <div class="note-content">${annotation.content}</div>
                        `;
                        
                        annotationsLayer.appendChild(notePopup);
                        
                        // Close button
                        notePopup.querySelector('.note-close').addEventListener('click', () => {
                            annotationsLayer.removeChild(notePopup);
                        });
                    });
                    break;
            }
            
            annotationsLayer.appendChild(annoElement);
        });
    }
    
    // Generate thumbnails for all pages
    function generateThumbnails() {
        const container = document.querySelector('.thumbnails-container');
        container.innerHTML = '';
        
        // Create a thumbnail for each page
        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const thumbItem = document.createElement('div');
            thumbItem.className = 'thumbnail-item';
            thumbItem.style.cursor = 'pointer';
            thumbItem.style.margin = '5px';
            thumbItem.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.2)';
            thumbItem.style.backgroundColor = 'white';
            thumbItem.style.position = 'relative';
            thumbItem.style.width = '150px'; // Fixed width
            thumbItem.dataset.pageNum = i;
            
            // Page number indicator
            const pageNumLabel = document.createElement('div');
            pageNumLabel.className = 'page-num-label';
            pageNumLabel.textContent = i;
            pageNumLabel.style.position = 'absolute';
            pageNumLabel.style.bottom = '0';
            pageNumLabel.style.right = '0';
            pageNumLabel.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            pageNumLabel.style.color = 'white';
            pageNumLabel.style.padding = '2px 5px';
            pageNumLabel.style.fontSize = '12px';
            
            // Placeholder until thumbnail loads
            const placeholder = document.createElement('div');
            placeholder.style.width = '100%';
            placeholder.style.aspectRatio = '1/1.4'; // Approximate page ratio
            placeholder.style.backgroundColor = '#f5f5f5';
            placeholder.style.display = 'flex';
            placeholder.style.alignItems = 'center';
            placeholder.style.justifyContent = 'center';
            placeholder.innerHTML = `<div class="spinner" style="width: 20px; height: 20px;"></div>`;
            
            thumbItem.appendChild(placeholder);
            thumbItem.appendChild(pageNumLabel);
            container.appendChild(thumbItem);
            
            // Click event to jump to page
            thumbItem.addEventListener('click', function() {
                const pageToShow = parseInt(this.dataset.pageNum);
                pageNum = pageToShow;
                queueRenderPage(pageNum);
            });
            
            // Generate the thumbnail
            pdfDoc.getPage(i).then(function(page) {
                const viewport = page.getViewport({ scale: 0.2 }); // Small scale for thumbnails
                
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                canvas.style.width = '100%';
                canvas.style.height = 'auto';
                
                const ctx = canvas.getContext('2d');
                
                page.render({
                    canvasContext: ctx,
                    viewport: viewport
                }).promise.then(() => {
                    placeholder.remove();
                    thumbItem.insertBefore(canvas, pageNumLabel);
                    
                    // Mark as active if current page
                    if (i === pageNum) {
                        thumbItem.classList.add('active');
                    }
                });
            });
        }
    }
    
    // Initialize PDF outline (table of contents)
    function initializeOutline() {
        const container = document.querySelector('.outline-container');
        container.innerHTML = '<div class="loading-outline">Loading outline...</div>';
        
        pdfDoc.getOutline().then(outline => {
            container.innerHTML = '';
            
            if (!outline || outline.length === 0) {
                container.innerHTML = '<div class="no-outline">No outline available</div>';
                return;
            }
            
            const list = document.createElement('ul');
            list.className = 'outline-list';
            list.style.listStyle = 'none';
            list.style.padding = '0';
            list.style.margin = '0';
            
            outline.forEach(item => {
                renderOutlineItem(item, list);
            });
            
            container.appendChild(list);
        }).catch(error => {
            console.error('Error loading outline:', error);
            container.innerHTML = '<div class="error">Error loading outline</div>';
        });
    }
    
    // Render an outline item (and any children)
    function renderOutlineItem(item, container) {
        const li = document.createElement('li');
        li.style.margin = '5px 0';
        li.style.paddingLeft = '10px';
        
        const link = document.createElement('a');
        link.textContent = item.title;
        link.style.textDecoration = 'none';
        link.style.color = '#333';
        link.style.display = 'block';
        link.style.padding = '3px 0';
        
        li.appendChild(link);
        container.appendChild(li);
        
        // Handle click to jump to destination
        link.addEventListener('click', () => {
            if (item.dest) {
                pdfDoc.getDestination(item.dest).then(dest => {
                    if (Array.isArray(dest)) {
                        const destRef = dest[0];
                        pdfDoc.getPageIndex(destRef).then(pageIndex => {
                            // Page indices are 0-based, but our pageNum is 1-based
                            pageNum = pageIndex + 1;
                            queueRenderPage(pageNum);
                        });
                    }
                });
            } else if (item.url) {
                window.open(item.url, '_blank');
            }
        });
        
        // Add children if any
        if (item.items && item.items.length) {
            const childList = document.createElement('ul');
            childList.style.listStyle = 'none';
            childList.style.paddingLeft = '15px';
            
            item.items.forEach(childItem => {
                renderOutlineItem(childItem, childList);
            });
            
            li.appendChild(childList);
        }
    }
    
    // Initialize PDF search functionality
    function initializeSearch() {
        const searchBox = document.querySelector('.pdf-search-box');
        const searchInput = document.getElementById('pdf-search-input');
        const searchPrev = document.getElementById('pdf-search-prev');
        const searchNext = document.getElementById('pdf-search-next');
        const searchClose = document.getElementById('pdf-search-close');
        const searchToggle = document.getElementById('pdf-search-toggle');
        const searchResults = document.getElementById('pdf-search-results');
        
        let searchMatches = [];
        let currentMatchIndex = -1;
        
        // Toggle search box
        searchToggle.addEventListener('click', () => {
            searchBox.classList.toggle('active');
            searchInput.focus();
            searchClose.style.display = 'block';
        });
        
        // Close search
        searchClose.addEventListener('click', () => {
            searchBox.classList.remove('active');
            searchInput.value = '';
            searchResults.textContent = '';
            clearSearchHighlights();
            searchClose.style.display = 'none';
        });
        
        // Perform search when text is entered
        searchInput.addEventListener('input', debounce(() => {
            const searchText = searchInput.value.trim();
            
            if (searchText.length < 2) {
                searchResults.textContent = '';
                clearSearchHighlights();
                return;
            }
            
            // Initialize search if not already done
            if (!pdfSearchController) {
                pdfSearchController = new pdfjsLib.PDFSearchController({
                    pdfDocument: pdfDoc
                });
            }
            
            // Clear previous results
            searchMatches = [];
            currentMatchIndex = -1;
            clearSearchHighlights();
            
            searchResults.textContent = 'Searching...';
            
            // Perform the search across all pages
            const searchPromises = [];
            for (let i = 1; i <= pdfDoc.numPages; i++) {
                searchPromises.push(
                    pdfDoc.getPage(i).then(page => {
                        return page.getTextContent().then(textContent => {
                            const text = textContent.items.map(item => item.str).join(' ');
                            let index = text.toLowerCase().indexOf(searchText.toLowerCase());
                            const pageMatches = [];
                            
                            while (index !== -1) {
                                pageMatches.push({
                                    pageNum: i,
                                    index: index,
                                    text: text.substr(index, searchText.length)
                                });
                                index = text.toLowerCase().indexOf(searchText.toLowerCase(), index + 1);
                            }
                            
                            return pageMatches;
                        });
                    })
                );
            }
            
            Promise.all(searchPromises).then(results => {
                // Flatten results
                searchMatches = results.flat();
                
                if (searchMatches.length > 0) {
                    searchResults.textContent = `${searchMatches.length} matches found`;
                    currentMatchIndex = 0;
                    jumpToMatch(currentMatchIndex);
                } else {
                    searchResults.textContent = 'No matches found';
                }
            });
        }, 300));
        
        // Next match button
        searchNext.addEventListener('click', () => {
            if (searchMatches.length === 0) return;
            
            currentMatchIndex = (currentMatchIndex + 1) % searchMatches.length;
            jumpToMatch(currentMatchIndex);
        });
        
        // Previous match button
        searchPrev.addEventListener('click', () => {
            if (searchMatches.length === 0) return;
            
            currentMatchIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
            jumpToMatch(currentMatchIndex);
        });
        
        // Jump to a specific match
        function jumpToMatch(index) {
            const match = searchMatches[index];
            if (!match) return;
            
            // Go to the page containing this match
            if (pageNum !== match.pageNum) {
                pageNum = match.pageNum;
                queueRenderPage(pageNum, false); // Don't update viewport yet
            }
            
            // Update results counter
            searchResults.textContent = `${index + 1} of ${searchMatches.length}`;
            
            // Highlight the match on the page
            highlightMatch(match);
        }
        
        // Highlight a specific match on the current page
        function highlightMatch(match) {
            // This is a simplified approach. In a real app, you'd need to
            // use the text position information from PDF.js to highlight precisely.
            // For now, we'll just add a search overlay
            
            const canvas = document.getElementById('pdf-canvas');
            const container = document.querySelector('.pdf-canvas-container');
            
            clearSearchHighlights();
            
            const highlight = document.createElement('div');
            highlight.className = 'search-highlight';
            highlight.style.position = 'absolute';
            highlight.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
            highlight.style.border = '2px solid yellow';
            highlight.style.zIndex = '50';
            
            // Rough approximation - in a real implementation, you'd get
            // the exact position from PDF.js TextContent
            // This just creates a visual indicator at the top of the page
            highlight.style.top = '100px';
            highlight.style.left = '100px';
            highlight.style.width = '200px';
            highlight.style.height = '30px';
            
            container.appendChild(highlight);
            
            // Scroll to make the highlight visible
            highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        // Clear search highlights
        function clearSearchHighlights() {
            const highlights = document.querySelectorAll('.search-highlight');
            highlights.forEach(h => h.remove());
        }
        
        // Debounce function to prevent too many searches while typing
        function debounce(func, wait) {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        }
    }
    
    // Navigation functions
    function onPrevPage() {
        if (pageNum <= 1) return;
        pageNum--;
        queueRenderPage(pageNum);
    }
    
    function onNextPage() {
        if (pageNum >= pdfDoc.numPages) return;
        pageNum++;
        queueRenderPage(pageNum);
    }
    
    function onFirstPage() {
        if (pageNum === 1) return;
        pageNum = 1;
        queueRenderPage(pageNum);
    }
    
    function onLastPage() {
        if (pageNum === pdfDoc.numPages) return;
        pageNum = pdfDoc.numPages;
        queueRenderPage(pageNum);
    }
    
    // Zoom functions
    function zoomIn() {
        scale += 0.25;
        renderPage(pageNum);
    }
    
    function zoomOut() {
        if (scale <= 0.5) return;
        scale -= 0.25;
        renderPage(pageNum);
    }
    
    function setZoom(newScale) {
        if (newScale === 'auto') {
            // Fit page to viewer
            const canvas = document.getElementById('pdf-canvas');
            const viewer = document.querySelector('.pdf-viewer');
            pdfDoc.getPage(pageNum).then(page => {
                const viewport = page.getViewport({ scale: 1 });
                const viewerWidth = viewer.clientWidth - 40; // Account for padding
                const viewerHeight = viewer.clientHeight - 40;
                
                // Calculate scale to fit either width or height
                const scaleX = viewerWidth / viewport.width;
                const scaleY = viewerHeight / viewport.height;
                scale = Math.min(scaleX, scaleY);
                
                renderPage(pageNum);
            });
        } else if (newScale === 'width') {
            // Fit width
            const canvas = document.getElementById('pdf-canvas');
            const viewer = document.querySelector('.pdf-viewer');
            pdfDoc.getPage(pageNum).then(page => {
                const viewport = page.getViewport({ scale: 1 });
                const viewerWidth = viewer.clientWidth - 40; // Account for padding
                
                scale = viewerWidth / viewport.width;
                renderPage(pageNum);
            });
        } else {
            // Set fixed scale
            scale = parseFloat(newScale);
            renderPage(pageNum);
        }
    }
    
    // Toggle sidebar
    function toggleSidebar() {
        const sidebar = document.querySelector('.pdf-sidebar');
        sidebar.classList.toggle('collapsed');
        
        if (sidebar.classList.contains('collapsed')) {
            sidebar.style.transform = 'translateX(-200px)';
        } else {
            sidebar.style.transform = 'translateX(0)';
        }
    }
    
    // Toggle dark mode
    function toggleDarkMode() {
        darkMode = !darkMode;
        const button = document.getElementById('pdf-dark-mode-btn');
        const icon = button.querySelector('i');
        
        if (darkMode) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
            document.querySelector('.pdf-viewer').style.backgroundColor = '#1a1a2e';
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
            document.querySelector('.pdf-viewer').style.backgroundColor = '#e0e0e0';
        }
        
        renderPage(pageNum, false); // Render with dark mode applied
    }
    
    // Rotate page
    function rotatePage() {
        rotation = (rotation + 90) % 360;
        renderPage(pageNum);
    }
    
    // Load the PDF
    pdfjsLib.getDocument(pdfPath).promise.then(function(pdf) {
        pdfDoc = pdf;
        document.getElementById('total-pages').textContent = pdf.numPages;
        
        // Enable page input
        const pageInput = document.getElementById('current-page-input');
        pageInput.max = pdf.numPages;
        pageInput.addEventListener('change', function() {
            const page = parseInt(this.value);
            if (page >= 1 && page <= pdf.numPages) {
                pageNum = page;
                queueRenderPage(pageNum);
            } else {
                this.value = pageNum;
            }
        });
        
        // Initial render
        renderPage(pageNum);
        
        // Generate thumbnails if enabled
        if (renderOptions.showThumbnails) {
            generateThumbnails();
        }
        
        // Initialize outline
        initializeOutline();
        
        // Initialize search if enabled
        if (renderOptions.enableSearch) {
            initializeSearch();
        }
        
        // Set up event listeners
        document.getElementById('prev-page-btn').addEventListener('click', onPrevPage);
        document.getElementById('next-page-btn').addEventListener('click', onNextPage);
        document.getElementById('first-page-btn').addEventListener('click', onFirstPage);
        document.getElementById('last-page-btn').addEventListener('click', onLastPage);
        document.getElementById('zoom-in-btn').addEventListener('click', zoomIn);
        document.getElementById('zoom-out-btn').addEventListener('click', zoomOut);
        document.getElementById('toggle-sidebar-btn').addEventListener('click', toggleSidebar);
        document.getElementById('rotate-btn').addEventListener('click', rotatePage);
        
        // PDF dark mode toggle
        document.getElementById('pdf-dark-mode-btn').addEventListener('click', toggleDarkMode);
        
        // Zoom select
        document.getElementById('zoom-select').addEventListener('change', function() {
            setZoom(this.value);
        });
        
        // Sidebar tab switching
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                // Remove active class from all tabs and panels
                document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
                
                // Add active class to clicked tab
                this.classList.add('active');
                
                // Activate corresponding panel
                const panelId = `${this.dataset.tab}-panel`;
                document.getElementById(panelId).classList.add('active');
            });
        });
        
        // Annotation tools if enabled
        if (renderOptions.enableAnnotations) {
            const annotationToolbar = document.querySelector('.pdf-annotation-toolbar');
            const annotationToggleBtn = document.createElement('button');
            annotationToggleBtn.id = 'annotation-toggle';
            annotationToggleBtn.innerHTML = '<i class="fas fa-pen"></i>';
            annotationToggleBtn.title = 'Annotation Tools';
            annotationToggleBtn.style.position = 'absolute';
            annotationToggleBtn.style.top = '80px';
            annotationToggleBtn.style.right = '20px';
            annotationToggleBtn.style.zIndex = '100';
            annotationToggleBtn.style.width = '40px';
            annotationToggleBtn.style.height = '40px';
            annotationToggleBtn.style.borderRadius = '50%';
            annotationToggleBtn.style.backgroundColor = 'white';
            annotationToggleBtn.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
            
            contentArea.appendChild(annotationToggleBtn);
            
            // Toggle annotation toolbar
            annotationToggleBtn.addEventListener('click', () => {
                if (annotationToolbar.style.display === 'none') {
                    annotationToolbar.style.display = 'flex';
                } else {
                    annotationToolbar.style.display = 'none';
                }
            });
            
            // Handle annotation tools clicks
            document.getElementById('annotation-highlight').addEventListener('click', () => {
                alert('Highlight tool selected. This feature would allow you to select text to highlight.');
                // In a full implementation, you'd enable text selection and store highlights
            });
            
            document.getElementById('annotation-note').addEventListener('click', () => {
                alert('Note tool selected. Click anywhere on the document to add a note.');
                // In a full implementation, you'd handle clicks on the document to add notes
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            // Only handle if the viewer is in focus
            if (!document.querySelector('.pdf-container').contains(document.activeElement) && 
                document.activeElement !== document.body) {
                return;
            }
            
            switch(e.key) {
                case 'ArrowLeft':
                    onPrevPage();
                    break;
                case 'ArrowRight':
                    onNextPage();
                    break;
                case 'Home':
                    onFirstPage();
                    break;
                case 'End':
                    onLastPage();
                    break;
                case '+':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        zoomIn();
                    }
                    break;
                case '-':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        zoomOut();
                    }
                    break;
                case 'f':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        if (renderOptions.enableSearch) {
                            // Focus search input
                            document.getElementById('pdf-search-input').focus();
                        }
                    }
                    break;
            }
        });
        
        // Cleanup function called when the PDF viewer is removed
        return function cleanup() {
            document.removeEventListener('keydown', null);
            window.removeEventListener('resize', null);
        };
    }).catch(function(error) {
        console.error('Error loading PDF:', error);
        
        // Error display
        loadingIndicator.style.display = 'none';
        const errorEl = document.createElement('div');
        errorEl.className = 'pdf-error';
        errorEl.style.padding = '20px';
        errorEl.style.textAlign = 'center';
        errorEl.style.color = '#e74c3c';
        
        errorEl.innerHTML = `
            <div style="font-size: 50px; margin-bottom: 20px;">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h3>Failed to load PDF</h3>
            <p>${error.message}</p>
            <p>Please check that the file exists and is a valid PDF document.</p>
        `;
        
        pdfContainer.innerHTML = '';
        pdfContainer.appendChild(errorEl);
    });
} 