# CheatSheets Renderers

This directory contains modular renderer functions for different file types in the CheatSheets application.

## Available Renderers

- **markdown.js**: Renders Markdown content with syntax highlighting
- **pdf.js**: Renders PDF files with page navigation and zoom controls
- **html.js**: Renders HTML content in an iframe
- **plain-text.js**: Renders plain text content (also used for CSV files)

## Usage

Import the renderers in your code:

```javascript
import { renderMarkdown, renderPDF, renderHTML, renderPlainText } from './renderers/index.js';
```

Each renderer takes two parameters:
1. `content`: The content to render (for PDF, this is the path to the PDF file)
2. `container`: The DOM element to render the content into

Example:

```javascript
// Render Markdown content
renderMarkdown(markdownContent, document.getElementById('content-container'));

// Render a PDF file
renderPDF('./path/to/file.pdf', document.getElementById('content-container'));

// Render HTML content
renderHTML(htmlContent, document.getElementById('content-container'));

// Render plain text content
renderPlainText(textContent, document.getElementById('content-container'));
```

## Adding New Renderers

To add a new renderer:

1. Create a new file in the `renderers` directory (e.g., `new-format.js`)
2. Export a function that takes content and container parameters
3. Add the new renderer to `index.js`
4. Update the switch statement in `app.js` to use the new renderer for the appropriate file format 