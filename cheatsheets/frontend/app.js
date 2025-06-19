// Global state
const state = {
    darkMode: true,
    activeSheetId: null,
    sheets: [],
    currentFilter: 'all',
    rendererOptions: {},
    userPreferences: {
        darkMode: true,
        fontSize: 'medium',
        lineNumbers: true,
        wordWrap: false
    },
    searchSettings: {
        searchInContent: false,
        caseSensitive: false,
        wholeWord: false
    },
    tags: [], // Available tags for filtering
    favorites: [] // Favorite sheets
};

// Import renderers
let renderMarkdown, renderPDF, renderHTML, renderPlainText, defaultRendererOptions, getRenderer;

// Default renderer options as fallback
const fallbackRendererOptions = {
    lineNumbers: true,
    wordWrap: false,
    darkMode: true,
    fontSize: 'medium'
};

// Set a timeout to ensure initialization happens even if renderers don't load
let rendererLoadTimeout;

try {
    // Try ES module import first
    rendererLoadTimeout = setTimeout(() => {
        console.warn('Renderer loading timed out, using fallbacks');
        defaultRendererOptions = fallbackRendererOptions;
        renderMarkdown = renderPlainText = renderHTML = renderPDF = (content, element) => {
            element.innerHTML = `<pre>${content}</pre>`;
        };
        getRenderer = () => renderPlainText;
        init(); // Initialize the app with fallbacks
    }, 3000); // 3 second timeout

    import('./renderers/index.js').then(module => {
        clearTimeout(rendererLoadTimeout);
        ({ renderMarkdown, renderPDF, renderHTML, renderPlainText, defaultRendererOptions, getRenderer } = module);
        console.log('Renderers loaded via ES modules');
        init(); // Initialize the app now that renderers are ready
    }).catch(err => {
        console.error('Error loading ES modules:', err);
        // Fallback to global functions
        if (window.renderFunctions) {
            clearTimeout(rendererLoadTimeout);
            ({ renderMarkdown, renderPDF, renderHTML, renderPlainText, getRenderer, defaultRendererOptions } = window.renderFunctions);
            console.log('Renderers loaded via global functions');
            init(); // Initialize the app with global renderers
        }
    });
} catch (error) {
    console.error('Error in import:', error);
    // Fallback to global functions
    if (window.renderFunctions) {
        clearTimeout(rendererLoadTimeout);
        ({ renderMarkdown, renderPDF, renderHTML, renderPlainText, getRenderer, defaultRendererOptions } = window.renderFunctions);
        console.log('Renderers loaded via global functions');
        init(); // Initialize the app with global renderers
    } else {
        console.error('Unable to load renderers, both ES modules and global functions unavailable');
    }
}

// DOM Elements
const elements = {
    sheetsList: document.getElementById('sheets-list'),
    sheetContent: document.getElementById('sheet-content'),
    currentSheetTitle: document.getElementById('current-sheet-title'),
    searchInput: document.getElementById('search-input'),
    filterButtons: document.querySelectorAll('.filter-btn'),
    addSheetBtn: document.getElementById('add-sheet-btn'),
    addSheetModal: document.getElementById('add-sheet-modal'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    addSheetForm: document.getElementById('add-sheet-form'),
    darkModeBtn: document.getElementById('dark-mode-btn'),
    fullScreenBtn: document.getElementById('full-screen-btn'),
    settingsBtn: document.getElementById('settings-btn')
};

// Sample cheatsheets data (this would normally come from a backend/storage)
const sampleSheets = [
    {
        id: 'bash-cmd',
        name: 'Bash Commands',
        category: 'bash',
        format: 'md',
        path: './sheets/bash-cmd.md',
        icon: 'fa-terminal',
        tags: ['terminal', 'linux', 'commands']
    },
    {
        id: 'http-methods',
        name: 'HTTP Request Methods',
        category: 'web',
        format: 'html',
        path: './sheets/httpsrequests.html',
        icon: 'fa-globe',
        tags: ['http', 'api', 'web', 'requests']
    }
];

// Validate that necessary DOM elements exist
function validateDOMElements() {
    const requiredElements = [
        { id: 'sheets-list', name: 'Sheets List', element: elements.sheetsList },
        { id: 'sheet-content', name: 'Sheet Content', element: elements.sheetContent },
        { id: 'current-sheet-title', name: 'Current Sheet Title', element: elements.currentSheetTitle },
        { id: 'search-input', name: 'Search Input', element: elements.searchInput },
        { id: 'add-sheet-btn', name: 'Add Sheet Button', element: elements.addSheetBtn },
        { id: 'add-sheet-modal', name: 'Add Sheet Modal', element: elements.addSheetModal }
    ];
    
    let missingElements = 0;
    
    requiredElements.forEach(item => {
        if (!item.element) {
            console.error(`Missing required DOM element: ${item.name} (id: ${item.id})`);
            missingElements++;
        }
    });
    
    if (missingElements > 0) {
        console.warn(`${missingElements} required DOM elements are missing. Check HTML structure.`);
        // Display warning in UI if we have the sheet content element
        if (elements.sheetContent) {
            elements.sheetContent.innerHTML = `
                <div class="error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>UI Elements Missing</h3>
                    <p>${missingElements} required DOM elements are missing. The application may not function correctly.</p>
                    <p>Please check the console for details and ensure the HTML structure is correct.</p>
                </div>
            `;
        }
        return false;
    }
    
    return true;
}

// Initialize the application
function init() {
    console.log('Initializing CheatSheets application...');
    
    // If renderers aren't available, use simple fallbacks to avoid blocking initialization
    if (!renderMarkdown || !renderHTML || !renderPDF || !renderPlainText || !getRenderer) {
        console.log('Using fallback renderers');
        // Simple fallback implementations
        renderMarkdown = renderHTML = renderPDF = renderPlainText = (content, element) => {
            element.innerHTML = `<pre>${content}</pre>`;
        };
        getRenderer = () => renderPlainText;
        defaultRendererOptions = fallbackRendererOptions;
    }
    
    // Validate that required DOM elements are present
    const elementsValid = validateDOMElements();
    
    loadUserPreferences();
    loadCheatsheets();
    setupEventListeners();
    generateTagsList();
    
    // Apply dark mode if needed
    if (state.userPreferences.darkMode) {
        toggleDarkMode();
    }
    
    // Apply renderer options
    updateRendererOptions();
    
    // Display welcome screen initially - don't auto-load any sheet
    if (elementsValid) {
        showWelcomeScreen();
    }
}

// Load user preferences from localStorage
function loadUserPreferences() {
    try {
        const savedPrefs = localStorage.getItem('userPreferences');
        if (savedPrefs) {
            state.userPreferences = JSON.parse(savedPrefs);
        }
    } catch (error) {
        console.error('Error loading user preferences:', error);
    }
}

// Save user preferences to localStorage
function saveUserPreferences() {
    try {
        localStorage.setItem('userPreferences', JSON.stringify(state.userPreferences));
    } catch (error) {
        console.error('Error saving user preferences:', error);
    }
}

// Update renderer options based on user preferences
function updateRendererOptions() {
    state.rendererOptions = {
        ...defaultRendererOptions,
        lineNumbers: state.userPreferences.lineNumbers,
        wordWrap: state.userPreferences.wordWrap,
        darkMode: state.userPreferences.darkMode
    };
}

// Generate tags list from sheets
function generateTagsList() {
    const allTags = new Set();
    state.sheets.forEach(sheet => {
        if (sheet.tags && Array.isArray(sheet.tags)) {
            sheet.tags.forEach(tag => allTags.add(tag));
        }
    });
    state.tags = Array.from(allTags).sort();
    
    // Update the UI with tags if needed
    updateTagsUI();
}

// Update tags UI
function updateTagsUI() {
    const tagsContainer = document.querySelector('.tags-filter');
    if (!tagsContainer) return;
    
    tagsContainer.innerHTML = '';
    state.tags.forEach(tag => {
        const tagEl = document.createElement('button');
        tagEl.className = 'tag-btn';
        tagEl.textContent = tag;
        tagEl.addEventListener('click', () => {
            filterByTag(tag);
        });
        tagsContainer.appendChild(tagEl);
    });
}

// Filter sheets by tag
function filterByTag(tag) {
    renderSheetsList(state.currentFilter, elements.searchInput.value, tag);
}

// Show the welcome screen
function showWelcomeScreen() {
    elements.currentSheetTitle.textContent = 'Welcome to CheatSheets';
    elements.sheetContent.innerHTML = `
        <div class="welcome-screen">
            <div class="welcome-icon">
                <i class="fas fa-book-open"></i>
            </div>
            <h2>Welcome to CheatSheets Hub</h2>
            <p>Select a cheatsheet from the sidebar to get started</p>
            <div class="stats-section">
                <div class="stat-card">
                    <i class="fas fa-file-alt"></i>
                    <span>${state.sheets.length}</span>
                    <p>Cheatsheets</p>
                </div>
                <div class="stat-card">
                    <i class="fas fa-tags"></i>
                    <span>${state.tags.length}</span>
                    <p>Tags</p>
                </div>
                <div class="stat-card">
                    <i class="fas fa-folder"></i>
                    <span>${getUniqueCategories().length}</span>
                    <p>Categories</p>
                </div>
            </div>
            <div class="recent-section">
                <h3>Recently Viewed</h3>
                <div class="recent-list">
                    ${generateRecentList()}
                </div>
            </div>
        </div>
    `;
    
    // Setup recent list clickable items
    document.querySelectorAll('.recent-item').forEach(item => {
        item.addEventListener('click', () => {
            const sheetId = item.getAttribute('data-id');
            const sheet = state.sheets.find(s => s.id === sheetId);
            if (sheet) {
                loadSheet(sheet);
            }
        });
    });
}

// Get unique categories
function getUniqueCategories() {
    return [...new Set(state.sheets.map(sheet => sheet.category))];
}

// Generate recent list HTML
function generateRecentList() {
    // This would typically be backed by localStorage
    // For demo purposes, just use a few sheets
    const recentIds = state.sheets.slice(0, 3).map(s => s.id);
    if (recentIds.length === 0) {
        return '<p>No recent sheets</p>';
    }
    
    return recentIds.map(id => {
        const sheet = state.sheets.find(s => s.id === id);
        if (!sheet) return '';
        return `
            <div class="recent-item" data-id="${sheet.id}">
                <div class="recent-icon">
                    <i class="fas ${sheet.icon || 'fa-file'}"></i>
                </div>
                <div class="recent-info">
                    <div class="recent-name">${sheet.name}</div>
                    <div class="recent-category">${sheet.category}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Load cheatsheets from backend/storage
function loadCheatsheets() {
    console.log('Loading cheatsheets...');
    
    // Show loading indicator
    if (elements.sheetsList) {
        elements.sheetsList.innerHTML = `
            <div class="loading-sheets">
                <div class="spinner"></div>
                <p>Loading cheatsheets...</p>
            </div>
        `;
    }
    
    // Use the API client for consistent backend connectivity
    if (window.CheatSheetsAPI && window.CheatSheetsAPI.sheets) {
        window.CheatSheetsAPI.sheets.getSheets()
            .then(result => {
                if (result.success && result.data && result.data.length > 0) {
                    console.log('Loaded sheets from backend:', result.data.length);
                    state.sheets = result.data;
                    renderSheetsList();
                    generateTagsList();
                } else {
                    console.warn('Backend returned success but no data, falling back to local storage');
                    loadFromLocalStorage();
                }
            })
            .catch(error => {
                console.error('Error loading from API:', error);
                // Show error message to user
                const errorMessage = document.createElement('div');
                errorMessage.className = 'backend-error';
                errorMessage.innerHTML = `
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error connecting to backend server. Using local data instead.</p>
                    <small>${error.message}</small>
                `;
                
                // Append error message if sheetsList exists
                if (elements.sheetsList) {
                    elements.sheetsList.innerHTML = '';
                    elements.sheetsList.appendChild(errorMessage);
                    
                    // Remove error message after 5 seconds
                    setTimeout(() => {
                        if (errorMessage.parentNode === elements.sheetsList) {
                            elements.sheetsList.removeChild(errorMessage);
                        }
                    }, 5000);
                }
                
                // Fall back to localStorage or sample data
                loadFromLocalStorage();
            });
    } else {
        // API client not available, try direct fetch
        fetch('http://localhost:5000/api/sheets')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
                }
                return response.json();
            })
            .then(result => {
                if (result.success && result.data && result.data.length > 0) {
                    console.log('Loaded sheets from backend:', result.data.length);
                    state.sheets = result.data;
                    renderSheetsList();
                    generateTagsList();
                } else {
                    console.warn('Backend returned success but no data, falling back to local storage');
                    loadFromLocalStorage();
                }
            })
            .catch(error => {
                console.error('Error loading from API (direct fetch):', error);
                loadFromLocalStorage();
            });
    }
}

// Fallback to localStorage or sample data
function loadFromLocalStorage() {
    try {
        const storedSheets = localStorage.getItem('sheets');
        if (storedSheets) {
            state.sheets = JSON.parse(storedSheets);
        } else {
            // Use sample data for demo
            state.sheets = sampleSheets;
        }
    } catch (error) {
        console.error('Error loading sheets from localStorage:', error);
        state.sheets = sampleSheets;
    }
    
    // Also load favorites
    try {
        const storedFavorites = localStorage.getItem('favorites');
        if (storedFavorites) {
            state.favorites = JSON.parse(storedFavorites);
        }
    } catch (error) {
        console.error('Error loading favorites:', error);
    }
    
    renderSheetsList();
    generateTagsList();
}

// Save cheatsheets to localStorage
function saveCheatsheets() {
    try {
        localStorage.setItem('sheets', JSON.stringify(state.sheets));
    } catch (error) {
        console.error('Error saving sheets to localStorage:', error);
    }
}

// Save favorites to localStorage
function saveFavorites() {
    try {
        localStorage.setItem('favorites', JSON.stringify(state.favorites));
    } catch (error) {
        console.error('Error saving favorites to localStorage:', error);
    }
}

// Render the list of cheatsheets
function renderSheetsList(filter = state.currentFilter, query = '', tag = null) {
    console.log('Rendering sheets list...');
    
    if (!elements.sheetsList) {
        console.error('Sheets list element not found');
        return;
    }
    
    elements.sheetsList.innerHTML = '';
    
    const filteredSheets = state.sheets.filter(sheet => {
        const matchesFilter = filter === 'all' || sheet.category === filter;
        const matchesFavorite = filter === 'favorites' ? state.favorites.includes(sheet.id) : true;
        const matchesQuery = query ? 
            (sheet.name.toLowerCase().includes(query.toLowerCase()) || 
            (state.searchSettings.searchInContent && sheet.searchableContent && 
            sheet.searchableContent.toLowerCase().includes(query.toLowerCase()))) : true;
        
        const matchesTag = tag ? (sheet.tags && sheet.tags.includes(tag)) : true;
        
        return matchesFilter && matchesFavorite && matchesQuery && matchesTag;
    });
    
    if (filteredSheets.length === 0) {
        elements.sheetsList.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <p>No cheatsheets found</p>
                <button class="clear-search-btn">Clear search</button>
            </div>
        `;
        
        // Add clear search button functionality
        const clearSearchBtn = document.querySelector('.clear-search-btn');
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                if (elements.searchInput) {
                    elements.searchInput.value = '';
                }
                renderSheetsList();
            });
        }
        
        return;
    }
    
    // Sort sheets alphabetically by name
    filteredSheets.sort((a, b) => a.name.localeCompare(b.name));
    
    // Group sheets by category if not already filtering by category
    if (filter === 'all') {
        const categories = {};
        
        filteredSheets.forEach(sheet => {
            if (!categories[sheet.category]) {
                categories[sheet.category] = [];
            }
            categories[sheet.category].push(sheet);
        });
        
        // Render each category
        Object.keys(categories).sort().forEach(category => {
            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'category-header';
            categoryHeader.innerHTML = `
                <span class="category-name">${category.charAt(0).toUpperCase() + category.slice(1)}</span>
                <span class="category-count">${categories[category].length}</span>
            `;
            elements.sheetsList.appendChild(categoryHeader);
            
            // Render sheets in this category
            categories[category].forEach(sheet => {
                const sheetElement = createSheetElement(sheet);
                elements.sheetsList.appendChild(sheetElement);
            });
        });
    } else {
        // Just render the filtered sheets without categories
        filteredSheets.forEach(sheet => {
            const sheetElement = createSheetElement(sheet);
            elements.sheetsList.appendChild(sheetElement);
        });
    }
    
    // If we have an active sheet, highlight it
    if (state.activeSheetId) {
        const activeElement = document.querySelector(`.sheet-item[data-id="${state.activeSheetId}"]`);
        if (activeElement) {
            activeElement.classList.add('active');
        }
    }
}

// Create a sheet list item element
function createSheetElement(sheet) {
    const sheetElement = document.createElement('div');
    sheetElement.className = 'sheet-item animated';
    sheetElement.setAttribute('data-id', sheet.id);
    
    // Format-specific icons
    const formatIcons = {
        'md': 'fa-markdown',
        'txt': 'fa-file-alt',
        'pdf': 'fa-file-pdf',
        'html': 'fa-file-code',
        'csv': 'fa-file-csv',
        'json': 'fa-file-code',
        'xml': 'fa-file-code',
        'yaml': 'fa-file-code',
        'yml': 'fa-file-code'
    };
    
    // Check if this sheet is a favorite
    const isFavorite = state.favorites.includes(sheet.id);
    
    // Create tags HTML if sheet has tags
    let tagsHTML = '';
    if (sheet.tags && sheet.tags.length > 0) {
        tagsHTML = `
            <div class="sheet-tags">
                ${sheet.tags.map(tag => `<span class="sheet-tag">${tag}</span>`).join('')}
            </div>
        `;
    }
    
    sheetElement.innerHTML = `
        <div class="sheet-icon">
            <i class="fas ${sheet.icon || formatIcons[sheet.format] || 'fa-file'}"></i>
        </div>
        <div class="sheet-info">
            <div class="sheet-name">${sheet.name}</div>
            <div class="sheet-meta">
                <span class="sheet-category">${sheet.category}</span>
                <span class="sheet-format">
                    <i class="fas ${formatIcons[sheet.format] || 'fa-file'}"></i>
                    ${sheet.format.toUpperCase()}
                </span>
            </div>
            ${tagsHTML}
        </div>
        <div class="sheet-actions">
            <button class="favorite-btn" title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                <i class="fas ${isFavorite ? 'fa-star' : 'fa-star'}" style="color: ${isFavorite ? '#f39c12' : '#ccc'}"></i>
            </button>
        </div>
    `;
    
    // Add click event for the sheet
    sheetElement.addEventListener('click', (e) => {
        // Don't trigger if clicking on the favorite button
        if (e.target.closest('.favorite-btn')) return;
        loadSheet(sheet);
    });
    
    // Add click event for the favorite button
    sheetElement.querySelector('.favorite-btn').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent opening the sheet
        toggleFavorite(sheet.id);
    });
    
    return sheetElement;
}

// Toggle favorite status of a sheet
function toggleFavorite(sheetId) {
    const index = state.favorites.indexOf(sheetId);
    if (index === -1) {
        // Add to favorites
        state.favorites.push(sheetId);
    } else {
        // Remove from favorites
        state.favorites.splice(index, 1);
    }
    
    saveFavorites();
    renderSheetsList(); // Re-render to update UI
}

// Load and display a cheatsheet
async function loadSheet(sheet) {
    console.log(`Loading sheet: ${sheet.name}`);
    // Update active sheet
    state.activeSheetId = sheet.id;
    elements.currentSheetTitle.textContent = sheet.name;
    
    // Update active state in list
    document.querySelectorAll('.sheet-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeItem = document.querySelector(`.sheet-item[data-id="${sheet.id}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
    }
    
    // Save to recent sheets (would normally be in localStorage)
    // We're just simulating here
    
    // Show loading state
    elements.sheetContent.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Loading cheatsheet...</p>
        </div>
    `;
    
    try {
        const content = await fetchSheetContent(sheet);
        
        // If searchInContent is enabled, store the content for searching
        if (state.searchSettings.searchInContent) {
            sheet.searchableContent = content;
            saveCheatsheets(); // Save to localStorage
        }
        
        renderSheetContent(sheet, content);
    } catch (error) {
        console.error('Error loading sheet:', error);
        elements.sheetContent.innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading cheatsheet: ${error.message}</p>
                <button class="retry-btn">Retry</button>
            </div>
        `;
        
        // Add retry button functionality
        document.querySelector('.retry-btn')?.addEventListener('click', () => {
            loadSheet(sheet);
        });
    }
}

// Fetch the content of a cheatsheet
async function fetchSheetContent(sheet) {
    console.log(`Fetching content for: ${sheet.path}`);
    try {
        // First try the original path
        const response = await fetch(sheet.path);
        if (response.ok) {
            return await response.text();
        }
        
        // If original path fails, try data/sheets directory
        console.log(`Trying alternative path: /data/sheets/${sheet.path.split('/').pop()}`);
        const alternativeResponse = await fetch(`/data/sheets/${sheet.path.split('/').pop()}`);
        if (!alternativeResponse.ok) {
            throw new Error(`Failed to load ${sheet.path} (${response.status})`);
        }
        return await alternativeResponse.text();
    } catch (error) {
        console.error('Error fetching sheet content:', error);
        throw error;
    }
}

// Render the content of a cheatsheet
function renderSheetContent(sheet, content) {
    console.log(`Rendering ${sheet.format} content...`);
    console.log(`Content length: ${content.length} characters`);
    
    // Clear existing content
    elements.sheetContent.innerHTML = '';
    
    // Create a content header
    const contentHeader = document.createElement('div');
    contentHeader.className = 'content-header';
    contentHeader.innerHTML = `
        <div class="content-meta">
            <div class="sheet-format-badge">
                <i class="fas ${getFormatIcon(sheet.format)}"></i>
                ${sheet.format.toUpperCase()}
            </div>
            ${sheet.tags ? 
                `<div class="content-tags">
                    ${sheet.tags.map(tag => `<span class="content-tag">${tag}</span>`).join('')}
                </div>` : ''
            }
        </div>
        <div class="content-actions">
            <button class="action-btn" id="print-btn" title="Print">
                <i class="fas fa-print"></i>
            </button>
            <button class="action-btn" id="download-btn" title="Download">
                <i class="fas fa-download"></i>
            </button>
            <button class="action-btn" id="share-btn" title="Share">
                <i class="fas fa-share-alt"></i>
            </button>
        </div>
    `;
    
    elements.sheetContent.appendChild(contentHeader);
    
    // Create content wrapper for scrollable content
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'content-wrapper';
    contentWrapper.style.flex = '1';
    contentWrapper.style.overflow = 'auto';
    contentWrapper.style.width = '100%';
    
    elements.sheetContent.appendChild(contentWrapper);
    
    try {
        // Use the appropriate renderer
        const rendererFunction = getRenderer(sheet.format);
        if (!rendererFunction) {
            throw new Error(`No renderer found for format: ${sheet.format}`);
        }
        
        rendererFunction(content, contentWrapper, state.rendererOptions);
        
        // Set up content action buttons
        setupContentActions(sheet, content);
        
        // Add a scroll-to-top button for long content
        const scrollTopBtn = document.createElement('button');
        scrollTopBtn.className = 'scroll-top-btn';
        scrollTopBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
        scrollTopBtn.title = 'Scroll to top';
        scrollTopBtn.addEventListener('click', () => {
            contentWrapper.scrollTop = 0;
        });
        
        // Hide button initially
        scrollTopBtn.style.display = 'none';
        
        // Show/hide button based on scroll position
        contentWrapper.addEventListener('scroll', () => {
            if (contentWrapper.scrollTop > 300) {
                scrollTopBtn.style.display = 'flex';
            } else {
                scrollTopBtn.style.display = 'none';
            }
        });
        
        elements.sheetContent.appendChild(scrollTopBtn);
    } catch (error) {
        console.error(`Error rendering ${sheet.format} content:`, error);
        contentWrapper.innerHTML = `
            <div class="error" style="padding: 20px; text-align: center; color: #e74c3c;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <h3>Error Rendering Content</h3>
                <p>${error.message}</p>
                <p>Please try refreshing the page or contact support.</p>
            </div>
        `;
    }
}

// Set up content action buttons
function setupContentActions(sheet, content) {
    // Print button
    document.getElementById('print-btn')?.addEventListener('click', () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>${sheet.name}</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; }
                    pre { background: #f5f5f5; padding: 10px; border-radius: 5px; }
                    code { font-family: monospace; }
                    @media print {
                        body { margin: 1cm; }
                    }
                </style>
            </head>
            <body>
                <h1>${sheet.name}</h1>
                <div>${content}</div>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    });
    
    // Download button
    document.getElementById('download-btn')?.addEventListener('click', () => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sheet.name}.${sheet.format}`;
        a.click();
        URL.revokeObjectURL(url);
    });
    
    // Share button
    document.getElementById('share-btn')?.addEventListener('click', () => {
        if (navigator.share) {
            navigator.share({
                title: sheet.name,
                text: `Check out this cheatsheet: ${sheet.name}`,
                url: window.location.href
            });
        } else {
            // Fallback - copy link to clipboard
            navigator.clipboard.writeText(window.location.href).then(() => {
                alert('Link copied to clipboard!');
            });
        }
    });
}

// Set up event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    try {
        // Search input with debounce
        let searchTimeout;
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    renderSheetsList(state.currentFilter, e.target.value);
                }, 300); // 300ms debounce
            });
        } else {
            console.error('Search input element not found');
        }
        
        // Filter buttons
        if (elements.filterButtons && elements.filterButtons.length > 0) {
            elements.filterButtons.forEach(button => {
                button.addEventListener('click', () => {
                    elements.filterButtons.forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    
                    state.currentFilter = button.getAttribute('data-filter');
                    renderSheetsList(state.currentFilter, elements.searchInput ? elements.searchInput.value : '');
                });
            });
        } else {
            console.error('Filter buttons not found');
        }
        
        // Advanced search toggle
        const advancedSearchToggle = document.getElementById('advanced-search-toggle');
        if (advancedSearchToggle) {
            advancedSearchToggle.addEventListener('click', () => {
                const advancedSearch = document.getElementById('advanced-search');
                if (advancedSearch) {
                    advancedSearch.classList.toggle('active');
                }
            });
        }
        
        // Advanced search settings
        const searchInContent = document.getElementById('search-in-content');
        if (searchInContent) {
            searchInContent.addEventListener('change', (e) => {
                state.searchSettings.searchInContent = e.target.checked;
            });
        }
        
        const caseSensitive = document.getElementById('case-sensitive');
        if (caseSensitive) {
            caseSensitive.addEventListener('change', (e) => {
                state.searchSettings.caseSensitive = e.target.checked;
            });
        }
        
        const wholeWord = document.getElementById('whole-word');
        if (wholeWord) {
            wholeWord.addEventListener('change', (e) => {
                state.searchSettings.wholeWord = e.target.checked;
            });
        }
        
        // Add sheet button
        if (elements.addSheetBtn) {
            elements.addSheetBtn.addEventListener('click', () => {
                if (elements.addSheetModal) {
                    elements.addSheetModal.classList.add('active');
                } else {
                    console.error('Add sheet modal not found');
                }
            });
        } else {
            console.error('Add sheet button not found');
        }
        
        // Close modal button
        if (elements.closeModalBtn) {
            elements.closeModalBtn.addEventListener('click', () => {
                if (elements.addSheetModal) {
                    elements.addSheetModal.classList.remove('active');
                }
            });
        } else {
            console.error('Close modal button not found');
        }
        
        // Click outside modal to close
        if (elements.addSheetModal) {
            elements.addSheetModal.addEventListener('click', (e) => {
                if (e.target === elements.addSheetModal) {
                    elements.addSheetModal.classList.remove('active');
                }
            });
        } else {
            console.error('Add sheet modal not found');
        }
        
        // Add sheet form submission
        if (elements.addSheetForm) {
            elements.addSheetForm.addEventListener('submit', (e) => {
                e.preventDefault();
                addNewCheatsheet();
            });
        } else {
            console.error('Add sheet form not found');
        }
        
        // Dark mode toggle
        if (elements.darkModeBtn) {
            elements.darkModeBtn.addEventListener('click', toggleDarkMode);
        } else {
            console.error('Dark mode button not found');
        }
        
        // Full screen toggle
        if (elements.fullScreenBtn) {
            elements.fullScreenBtn.addEventListener('click', toggleFullScreen);
        } else {
            console.error('Full screen button not found');
        }
        
        // Settings button - open settings modal
        if (elements.settingsBtn) {
            elements.settingsBtn.addEventListener('click', openSettingsModal);
        } else {
            console.error('Settings button not found');
        }
        
        // Handle keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + F for search
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                // Don't intercept if already in a search field
                if (document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'text') {
                    return;
                }
                e.preventDefault();
                if (elements.searchInput) {
                    elements.searchInput.focus();
                }
            }
            
            // Escape to clear search
            if (e.key === 'Escape' && elements.searchInput && document.activeElement === elements.searchInput) {
                elements.searchInput.value = '';
                renderSheetsList();
                elements.searchInput.blur();
            }
        });
        
        console.log('Event listeners setup completed successfully');
    } catch (error) {
        console.error('Error setting up event listeners:', error);
    }
}

// Open settings modal
function openSettingsModal() {
    // Create modal if it doesn't exist
    let settingsModal = document.getElementById('settings-modal');
    if (!settingsModal) {
        settingsModal = document.createElement('div');
        settingsModal.id = 'settings-modal';
        settingsModal.className = 'modal';
        
        settingsModal.innerHTML = `
            <div class="modal-content settings-modal-content">
                <div class="modal-header">
                    <h2>Settings</h2>
                    <button class="close-btn" id="close-settings-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="settings-section">
                        <h3>Appearance</h3>
                        <div class="setting-item">
                            <label for="setting-dark-mode">Dark Mode</label>
                            <div class="toggle-switch">
                                <input type="checkbox" id="setting-dark-mode" ${state.userPreferences.darkMode ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </div>
                        </div>
                        <div class="setting-item">
                            <label for="setting-font-size">Font Size</label>
                            <select id="setting-font-size">
                                <option value="small" ${state.userPreferences.fontSize === 'small' ? 'selected' : ''}>Small</option>
                                <option value="medium" ${state.userPreferences.fontSize === 'medium' ? 'selected' : ''}>Medium</option>
                                <option value="large" ${state.userPreferences.fontSize === 'large' ? 'selected' : ''}>Large</option>
                            </select>
                        </div>
                    </div>
                    <div class="settings-section">
                        <h3>Content Display</h3>
                        <div class="setting-item">
                            <label for="setting-line-numbers">Show Line Numbers</label>
                            <div class="toggle-switch">
                                <input type="checkbox" id="setting-line-numbers" ${state.userPreferences.lineNumbers ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </div>
                        </div>
                        <div class="setting-item">
                            <label for="setting-word-wrap">Word Wrap</label>
                            <div class="toggle-switch">
                                <input type="checkbox" id="setting-word-wrap" ${state.userPreferences.wordWrap ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </div>
                        </div>
                    </div>
                    <div class="settings-section">
                        <h3>Search</h3>
                        <div class="setting-item">
                            <label for="setting-search-content">Search in Content</label>
                            <div class="toggle-switch">
                                <input type="checkbox" id="setting-search-content" ${state.searchSettings.searchInContent ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="save-settings-btn" class="btn-primary">Save Settings</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(settingsModal);
        
        // Close settings button
        document.getElementById('close-settings-btn').addEventListener('click', () => {
            settingsModal.classList.remove('active');
        });
        
        // Save settings button
        document.getElementById('save-settings-btn').addEventListener('click', () => {
            // Save preferences
            state.userPreferences.darkMode = document.getElementById('setting-dark-mode').checked;
            state.userPreferences.fontSize = document.getElementById('setting-font-size').value;
            state.userPreferences.lineNumbers = document.getElementById('setting-line-numbers').checked;
            state.userPreferences.wordWrap = document.getElementById('setting-word-wrap').checked;
            
            // Save search settings
            state.searchSettings.searchInContent = document.getElementById('setting-search-content').checked;
            
            // Update UI based on new settings
            if (document.body.classList.contains('dark-mode') !== state.userPreferences.darkMode) {
                toggleDarkMode();
            }
            
            // Update document font size
            document.documentElement.setAttribute('data-font-size', state.userPreferences.fontSize);
            
            // Update renderer options
            updateRendererOptions();
            
            // Save to localStorage
            saveUserPreferences();
            
            // Close modal
            settingsModal.classList.remove('active');
            
            // Reload current sheet if any to apply new renderer options
            if (state.activeSheetId) {
                const sheet = state.sheets.find(s => s.id === state.activeSheetId);
                if (sheet) {
                    loadSheet(sheet);
                }
            }
        });
        
        // Click outside to close
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                settingsModal.classList.remove('active');
            }
        });
    }
    
    // Show the modal
    settingsModal.classList.add('active');
}

// Toggle dark mode
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    state.userPreferences.darkMode = document.body.classList.contains('dark-mode');
    
    // Update button icon
    const icon = elements.darkModeBtn.querySelector('i');
    if (state.userPreferences.darkMode) {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }
    
    // Update renderer options
    state.rendererOptions.darkMode = state.userPreferences.darkMode;
    
    // Save preference
    saveUserPreferences();
    
    // Reload current sheet if any to apply new renderer options
    if (state.activeSheetId) {
        const sheet = state.sheets.find(s => s.id === state.activeSheetId);
        if (sheet) {
            loadSheet(sheet);
        }
    }
}

// Toggle fullscreen mode
function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// Add a new cheatsheet
function addNewCheatsheet() {
    const nameInput = document.getElementById('sheet-name');
    const categoryInput = document.getElementById('sheet-category');
    const fileInput = document.getElementById('sheet-file');
    const tagsInput = document.getElementById('sheet-tags');
    
    if (!nameInput.value || !fileInput.files.length) {
        alert('Please provide a name and upload a file');
        return;
    }
    
    const file = fileInput.files[0];
    const format = file.name.split('.').pop().toLowerCase();
    
    // Validate format
    if (!['md', 'txt', 'pdf', 'html', 'csv', 'json', 'xml', 'yaml', 'yml', 'ini', 'conf'].includes(format)) {
        alert('Unsupported file format. Please upload a supported file format.');
        return;
    }
    
    // Process tags
    let tags = [];
    if (tagsInput.value.trim()) {
        tags = tagsInput.value.split(',').map(tag => tag.trim());
    }
    
    // In a real app, this would upload the file to the server
    // For our demo, we'll create a local URL for the file
    const fileUrl = URL.createObjectURL(file);
    
    // Create a new cheatsheet object
    const newSheet = {
        id: nameInput.value.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
        name: nameInput.value,
        category: categoryInput.value,
        format,
        path: fileUrl,
        icon: getFormatIcon(format),
        tags
    };
    
    // Add to state and render
    state.sheets.push(newSheet);
    saveCheatsheets();
    
    // Update tags list
    generateTagsList();
    
    // Reset form and close modal
    elements.addSheetForm.reset();
    elements.addSheetModal.classList.remove('active');
    
    // Load the new sheet
    loadSheet(newSheet);
}

// Get the icon for a file format
function getFormatIcon(format) {
    const formatIcons = {
        'md': 'fa-markdown',
        'txt': 'fa-file-alt',
        'pdf': 'fa-file-pdf',
        'html': 'fa-file-code',
        'csv': 'fa-file-csv',
        'json': 'fa-file-code',
        'xml': 'fa-file-code',
        'yaml': 'fa-file-code',
        'yml': 'fa-file-code',
        'ini': 'fa-file-code',
        'conf': 'fa-file-code',
        'log': 'fa-file-alt'
    };
    
    return formatIcons[format] || 'fa-file';
}

// Add animations and effects
function addAnimations() {
    // Add ripple effect to buttons
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
}

// Add CSS for loading spinner
function addCSSStyles() {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
        .loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem;
        }
        
        .spinner {
            width: 50px;
            height: 50px;
            border: 5px solid rgba(0, 0, 0, 0.1);
            border-radius: 50%;
            border-top-color: var(--primary-color);
            animation: spin 1s ease-in-out infinite;
            margin-bottom: 1rem;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        .error {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            color: var(--danger-color);
        }
        
        .error i {
            font-size: 3rem;
            margin-bottom: 1rem;
        }
        
        .ripple {
            position: absolute;
            background: rgba(255, 255, 255, 0.4);
            border-radius: 50%;
            transform: scale(0);
            animation: ripple 0.6s linear;
            pointer-events: none;
        }
        
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
        
        /* Settings Modal Styles */
        .settings-modal-content {
            max-width: 600px;
        }
        
        .settings-section {
            margin-bottom: 1.5rem;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 1rem;
        }
        
        .settings-section:last-child {
            border-bottom: none;
        }
        
        .settings-section h3 {
            margin-bottom: 1rem;
            font-size: 1.2rem;
        }
        
        .setting-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.8rem;
        }
        
        .toggle-switch {
            position: relative;
            display: inline-block;
            width: 50px;
            height: 24px;
        }
        
        .toggle-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        
        .toggle-slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #ccc;
            transition: .4s;
            border-radius: 24px;
        }
        
        .toggle-slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
        }
        
        input:checked + .toggle-slider {
            background-color: var(--primary-color);
        }
        
        input:checked + .toggle-slider:before {
            transform: translateX(26px);
        }
        
        /* Font sizes */
        [data-font-size="small"] {
            font-size: 14px;
        }
        
        [data-font-size="medium"] {
            font-size: 16px;
        }
        
        [data-font-size="large"] {
            font-size: 18px;
        }
        
        /* Content header styles */
        .content-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem 1rem;
            background-color: var(--bg-color);
            border-bottom: 1px solid var(--border-color);
            margin-bottom: 1rem;
        }
        
        .content-meta {
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        
        .sheet-format-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.3rem;
            padding: 0.3rem 0.5rem;
            background-color: var(--primary-color);
            color: white;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: bold;
        }
        
        .content-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
        }
        
        .content-tag {
            padding: 0.2rem 0.5rem;
            background-color: var(--accent-color-light);
            color: var(--accent-color);
            border-radius: 4px;
            font-size: 0.8rem;
        }
        
        .content-actions {
            display: flex;
            gap: 0.5rem;
        }
        
        .action-btn {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: none;
            background-color: var(--bg-color);
            color: var(--text-color);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .action-btn:hover {
            background-color: var(--border-color);
        }
    `;
    document.head.appendChild(styleEl);
}

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded');
    addCSSStyles();
    init();
    
    // Apply font size from preferences
    document.documentElement.setAttribute('data-font-size', state.userPreferences.fontSize || 'medium');
});

// Update description in descriptions.json
const cheatsheetDescription = {
    "description": "Interactive cheatsheet manager and viewer that organizes and displays reference guides in various formats including PDF, HTML, Markdown, TXT, and CSV. Features a modern, responsive UI with dark mode support, category filtering, search capabilities, and specialized rendering for different file types. Provides a centralized hub for quick access to coding references, command lists, and documentation with syntax highlighting for code blocks and interactive PDF navigation.",
    "category": "Utilities",
    "tags": ["documentation", "reference", "productivity", "development"]
}; 