# Griffin's CheatSheets Hub

A full-stack web application for managing programming cheatsheets.

## Features

- Interactive cheatsheet viewer with support for multiple formats (Markdown, PDF, HTML, etc.)
- Advanced search and filtering
- Tag-based organization
- Dark mode support
- User accounts with preferences
- Favorites system
- Responsive design

## Architecture

The application consists of two main components:

### Frontend
- Pure JavaScript/HTML/CSS frontend
- Dynamic content rendering for various file formats
- Local storage for offline capability
- Responsive design for mobile and desktop

### Backend
- Node.js with Express
- MongoDB database
- RESTful API architecture
- User authentication
- File upload capabilities

## Installation

### Prerequisites
- Node.js (v14+)
- MongoDB
- Git

### Steps

1. Clone the repository:
```
git clone <repository-url>
cd cheatsheets
```

2. Set up the backend:
```
cd backend
npm install
```

3. Configure environment variables:
   - Copy the `.env.example` file to `.env`
   - Update the MongoDB connection string if needed

4. Start MongoDB:
```
# Run the setup script (may require adjustments for your environment)
./setup-mongo.sh
```

5. Start the servers:
```
# From the root directory
./launch.sh
```

This will start both the backend server and serve the frontend files.

## Usage

1. Access the application at `http://localhost:8000/frontend/index.html`
2. Create an account to get started
3. Browse existing cheatsheets or create your own
4. Use the search and filter tools to find specific content
5. Add frequently-used sheets to your favorites

## API Endpoints

The backend provides the following API endpoints:

### Cheatsheets
- `GET /api/sheets` - Get all cheatsheets
- `GET /api/sheets/:id` - Get a specific cheatsheet
- `POST /api/sheets` - Create a new cheatsheet (requires authentication)
- `PUT /api/sheets/:id` - Update a cheatsheet (requires authentication)
- `DELETE /api/sheets/:id` - Delete a cheatsheet (requires authentication)
- `POST /api/sheets/upload` - Upload a cheatsheet file (requires authentication)

### Users
- `POST /api/users/register` - Register a new user
- `POST /api/users/login` - Log in a user
- `GET /api/users/profile` - Get user profile (requires authentication)
- `PUT /api/users/profile` - Update user profile (requires authentication)
- `POST /api/users/favorites/:id` - Add a cheatsheet to favorites (requires authentication)
- `DELETE /api/users/favorites/:id` - Remove a cheatsheet from favorites (requires authentication)

## Development

### Backend Development
```
cd backend
npm run dev
```

### Frontend Development
The frontend is static HTML/CSS/JS and can be modified directly. The application will automatically reload when changes are detected.

## License

This project is licensed under the ISC License.

## Acknowledgments

- Font Awesome for icons
- Highlight.js for syntax highlighting
- Marked.js for Markdown rendering
- PDF.js for PDF rendering 