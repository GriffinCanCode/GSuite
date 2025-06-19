/**
 * PDF Worker
 * 
 * This web worker handles PDF processing operations in a separate thread.
 * Integrates with PDF.js for proper PDF parsing and processing.
 */

// Import PDF.js library (worker version)
importScripts('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/build/pdf.worker.min.js');

// Store PDF documents cache
const pdfCache = new Map();

/**
 * Load a PDF document from array buffer
 * @param {ArrayBuffer} pdfData - The PDF data as ArrayBuffer
 * @param {string} documentId - Unique identifier for the document
 * @returns {Promise<PDFDocumentProxy>} - The loaded PDF document
 */
async function loadPdfDocument(pdfData, documentId) {
    // Check if document is already in cache
    if (documentId && pdfCache.has(documentId)) {
        return pdfCache.get(documentId);
    }
    
    try {
        // Use PDF.js to load the document
        const loadingTask = pdfjsLib.getDocument({
            data: pdfData,
            disableStream: true,
            disableAutoFetch: true,
            disableCreateObjectURL: true
        });
        
        const pdfDocument = await loadingTask.promise;
        
        // Cache the document if ID is provided
        if (documentId) {
            pdfCache.set(documentId, pdfDocument);
        }
        
        return pdfDocument;
    } catch (error) {
        throw new Error(`Failed to load PDF: ${error.message}`);
    }
}

/**
 * Extract text content from a PDF
 * @param {ArrayBuffer} pdfData - The PDF data as ArrayBuffer
 * @param {Object} options - Extraction options
 * @returns {Promise<string>} - The extracted text
 */
async function extractText(pdfData, options = {}) {
    const {
        pageRange = 'all',
        documentId = null,
        preserveFormatting = true
    } = options;
    
    try {
        // Load the PDF document
        const pdfDocument = await loadPdfDocument(pdfData, documentId);
        
        // Determine which pages to process
        const pageCount = pdfDocument.numPages;
        let pagesToProcess = [];
        
        if (pageRange === 'all') {
            pagesToProcess = Array.from({ length: pageCount }, (_, i) => i + 1);
        } else if (Array.isArray(pageRange)) {
            pagesToProcess = pageRange.filter(p => p > 0 && p <= pageCount);
        } else if (typeof pageRange === 'object' && pageRange.from && pageRange.to) {
            const from = Math.max(1, pageRange.from);
            const to = Math.min(pageCount, pageRange.to);
            pagesToProcess = Array.from({ length: to - from + 1 }, (_, i) => i + from);
        }
        
        // Extract text from each page
        const textContent = [];
        
        for (const pageNum of pagesToProcess) {
            const page = await pdfDocument.getPage(pageNum);
            const content = await page.getTextContent();
            
            if (preserveFormatting) {
                // Preserve layout with line breaks and spacing
                let lastY;
                let text = '';
                
                for (const item of content.items) {
                    if (lastY !== item.transform[5] && text !== '') {
                        text += '\n';
                    }
                    text += item.str;
                    lastY = item.transform[5];
                }
                
                textContent.push(text);
            } else {
                // Simple extraction with just the text strings
                const pageText = content.items.map(item => item.str).join(' ');
                textContent.push(pageText);
            }
        }
        
        return textContent.join('\n\n');
    } catch (error) {
        throw new Error(`Text extraction failed: ${error.message}`);
    }
}

/**
 * Extract metadata from a PDF
 * @param {ArrayBuffer} pdfData - The PDF data as ArrayBuffer
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} - The extracted metadata
 */
async function extractMetadata(pdfData, options = {}) {
    const { documentId = null } = options;
    
    try {
        // Load the PDF document
        const pdfDocument = await loadPdfDocument(pdfData, documentId);
        
        // Get basic document info
        const info = await pdfDocument.getMetadata();
        
        // Get page count
        const pageCount = pdfDocument.numPages;
        
        // Process metadata
        const metadata = {
            title: info.info.Title || "Untitled Document",
            author: info.info.Author || "Unknown Author",
            subject: info.info.Subject || "",
            keywords: info.info.Keywords || "",
            creator: info.info.Creator || "",
            producer: info.info.Producer || "",
            creationDate: info.info.CreationDate ? formatPdfDate(info.info.CreationDate) : null,
            modificationDate: info.info.ModDate ? formatPdfDate(info.info.ModDate) : null,
            pageCount: pageCount,
            isEncrypted: pdfDocument.isEncrypted || false,
            permissions: pdfDocument.permissions || {},
            
            // PDF version info
            pdfVersion: `${pdfDocument.pdfInfo.version}.${pdfDocument.pdfInfo.subtype}`,
            
            // Extended metadata if available
            xmp: info.metadata ? parseXmpMetadata(info.metadata) : null
        };
        
        return metadata;
    } catch (error) {
        throw new Error(`Metadata extraction failed: ${error.message}`);
    }
}

/**
 * Extract page information including sizes, orientation, etc.
 * @param {ArrayBuffer} pdfData - The PDF data as ArrayBuffer
 * @param {Object} options - Extraction options
 * @returns {Promise<Array>} - Array of page information objects
 */
async function extractPageInfo(pdfData, options = {}) {
    const { 
        documentId = null,
        pageRange = 'all' 
    } = options;
    
    try {
        // Load the PDF document
        const pdfDocument = await loadPdfDocument(pdfData, documentId);
        
        // Determine which pages to process
        const pageCount = pdfDocument.numPages;
        let pagesToProcess = [];
        
        if (pageRange === 'all') {
            pagesToProcess = Array.from({ length: pageCount }, (_, i) => i + 1);
        } else if (Array.isArray(pageRange)) {
            pagesToProcess = pageRange.filter(p => p > 0 && p <= pageCount);
        } else if (typeof pageRange === 'object' && pageRange.from && pageRange.to) {
            const from = Math.max(1, pageRange.from);
            const to = Math.min(pageCount, pageRange.to);
            pagesToProcess = Array.from({ length: to - from + 1 }, (_, i) => i + from);
        }
        
        // Extract info from each page
        const pagesInfo = [];
        
        for (const pageNum of pagesToProcess) {
            const page = await pdfDocument.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.0 });
            
            pagesInfo.push({
                pageNumber: pageNum,
                width: viewport.width,
                height: viewport.height,
                rotation: viewport.rotation,
                orientation: viewport.width > viewport.height ? 'landscape' : 'portrait',
                aspectRatio: (viewport.width / viewport.height).toFixed(2)
            });
        }
        
        return pagesInfo;
    } catch (error) {
        throw new Error(`Page info extraction failed: ${error.message}`);
    }
}

/**
 * Extract a thumbnail for a PDF page
 * @param {ArrayBuffer} pdfData - The PDF data as ArrayBuffer
 * @param {Object} options - Extraction options
 * @returns {Promise<ImageData>} - The thumbnail image data
 */
async function extractThumbnail(pdfData, options = {}) {
    const {
        documentId = null,
        pageNumber = 1,
        width = 200,
        height = 0, // Auto-calculate based on aspect ratio if 0
        format = 'png' // 'png' or 'jpeg'
    } = options;
    
    try {
        // Load the PDF document
        const pdfDocument = await loadPdfDocument(pdfData, documentId);
        
        // Ensure valid page number
        if (pageNumber < 1 || pageNumber > pdfDocument.numPages) {
            throw new Error(`Invalid page number: ${pageNumber}`);
        }
        
        // Get the page
        const page = await pdfDocument.getPage(pageNumber);
        
        // Calculate viewport with correct aspect ratio
        const viewport = page.getViewport({ scale: 1.0 });
        const aspectRatio = viewport.width / viewport.height;
        
        let targetWidth = width;
        let targetHeight = height || (width / aspectRatio);
        
        // Create canvas and render context
        const canvas = new OffscreenCanvas(targetWidth, targetHeight);
        const context = canvas.getContext('2d');
        
        // Set white background
        context.fillStyle = 'white';
        context.fillRect(0, 0, targetWidth, targetHeight);
        
        // Calculate scale to fit the target dimensions
        const scale = Math.min(targetWidth / viewport.width, targetHeight / viewport.height);
        const scaledViewport = page.getViewport({ scale });
        
        // Center the rendering
        const offsetX = (targetWidth - scaledViewport.width) / 2;
        const offsetY = (targetHeight - scaledViewport.height) / 2;
        
        // Set up rendering
        const renderContext = {
            canvasContext: context,
            viewport: scaledViewport,
            transform: [1, 0, 0, 1, offsetX, offsetY]
        };
        
        // Render the page
        await page.render(renderContext).promise;
        
        // Get image data
        const blob = await canvas.convertToBlob({ 
            type: format === 'jpeg' ? 'image/jpeg' : 'image/png',
            quality: format === 'jpeg' ? 0.8 : undefined
        });
        
        // Convert blob to array buffer
        const buffer = await blob.arrayBuffer();
        
        return buffer;
    } catch (error) {
        throw new Error(`Thumbnail extraction failed: ${error.message}`);
    }
}

/**
 * Clear document cache to free memory
 * @param {string} documentId - ID of document to remove from cache, or 'all' to clear everything
 */
function clearCache(documentId) {
    if (documentId === 'all') {
        // Close all documents and clear the cache
        for (const [_, pdfDoc] of pdfCache) {
            try {
                pdfDoc.destroy();
            } catch (e) {
                // Ignore errors during cleanup
            }
        }
        pdfCache.clear();
    } else if (pdfCache.has(documentId)) {
        // Close specific document and remove from cache
        try {
            pdfCache.get(documentId).destroy();
        } catch (e) {
            // Ignore errors during cleanup
        }
        pdfCache.delete(documentId);
    }
}

// Helper function to format PDF dates
function formatPdfDate(pdfDate) {
    if (!pdfDate) return null;
    
    // PDF dates are in the format: D:YYYYMMDDHHmmSSOHH'mm'
    // where O is the relationship of local time to UTC (+ or -)
    
    try {
        // Remove 'D:' prefix if it exists
        if (pdfDate.startsWith('D:')) {
            pdfDate = pdfDate.substring(2);
        }
        
        // Basic format: YYYYMMDDHHmmSS
        const year = parseInt(pdfDate.substring(0, 4), 10);
        const month = parseInt(pdfDate.substring(4, 6), 10) - 1; // 0-based months
        const day = parseInt(pdfDate.substring(6, 8), 10);
        
        let hour = 0, minute = 0, second = 0;
        let utcOffset = 0;
        
        // Check if we have time information
        if (pdfDate.length >= 14) {
            hour = parseInt(pdfDate.substring(8, 10), 10);
            minute = parseInt(pdfDate.substring(10, 12), 10);
            second = parseInt(pdfDate.substring(12, 14), 10);
            
            // Check if we have timezone information
            if (pdfDate.length > 14) {
                const tzSign = pdfDate.substring(14, 15);
                if (tzSign === '+' || tzSign === '-' || tzSign === 'Z') {
                    if (tzSign === 'Z') {
                        // UTC time
                        utcOffset = 0;
                    } else {
                        // Parse timezone offset
                        const tzHour = parseInt(pdfDate.substring(15, 17), 10);
                        let tzMinute = 0;
                        
                        // Check if we have minutes in the timezone
                        if (pdfDate.includes("'") && pdfDate.length >= 20) {
                            tzMinute = parseInt(pdfDate.substring(18, 20), 10);
                        }
                        
                        utcOffset = (tzHour * 60 + tzMinute) * (tzSign === '+' ? 1 : -1);
                    }
                }
            }
        }
        
        // Create date object
        const date = new Date(Date.UTC(year, month, day, hour, minute, second));
        
        // Apply timezone offset
        if (utcOffset !== 0) {
            date.setMinutes(date.getMinutes() - utcOffset);
        }
        
        return date.toISOString();
    } catch (e) {
        // Return the original string if parsing fails
        return pdfDate;
    }
}

// Helper function to parse XMP metadata
function parseXmpMetadata(xmpMetadata) {
    if (!xmpMetadata) return null;
    
    try {
        // Extract XMP data as simple key-value pairs
        // In a real implementation, this would use a proper XMP parser
        const result = {};
        
        // Look for common XMP namespaces
        const namespaces = [
            'dc:', // Dublin Core
            'pdf:', // Adobe PDF
            'xmp:', // XMP Basic
            'xmpMM:', // XMP Media Management
            'xmpRights:' // XMP Rights Management
        ];
        
        for (const ns of namespaces) {
            const pattern = new RegExp(`<${ns}(\\w+)>(.*?)</${ns}\\1>`, 'g');
            let match;
            
            while ((match = pattern.exec(xmpMetadata.toString())) !== null) {
                const key = `${ns}${match[1]}`;
                const value = match[2].trim();
                result[key] = value;
            }
        }
        
        return result;
    } catch (e) {
        return null;
    }
}

// Listen for messages from the main thread
self.onmessage = function(e) {
    const { id, type, data, options = {} } = e.data;
    
    let resultPromise;
    
    switch (type) {
        case 'extractText':
            resultPromise = extractText(data, options);
            break;
        case 'extractMetadata':
            resultPromise = extractMetadata(data, options);
            break;
        case 'extractPageInfo':
            resultPromise = extractPageInfo(data, options);
            break;
        case 'extractThumbnail':
            resultPromise = extractThumbnail(data, options);
            break;
        case 'clearCache':
            clearCache(options.documentId || 'all');
            resultPromise = Promise.resolve({ success: true });
            break;
        default:
            resultPromise = Promise.reject(new Error(`Unknown operation type: ${type}`));
            break;
    }
    
    // Handle the promise
    resultPromise
        .then(result => {
            self.postMessage({ id, result, error: null });
        })
        .catch(error => {
            self.postMessage({ id, result: null, error: error.message });
        });
};

// Log that the worker is ready
console.log('PDF worker initialized with full PDF.js integration'); 