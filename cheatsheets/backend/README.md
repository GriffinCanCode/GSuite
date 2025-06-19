# CheatSheets Hub Backend

Backend API server for Griffin's CheatSheets Hub application. This server provides REST API endpoints for managing cheatsheets, user accounts, and preferences.

## Features

- RESTful API for cheatsheet management
- User authentication
- File upload functionality
- User preferences and favorites
- MongoDB database integration

## Prerequisites

- Node.js (v14+)
- MongoDB (local installation or MongoDB Atlas)
- npm or yarn

## Installation

1. Clone the repository
2. Navigate to the backend directory:
   ```
   cd backend
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Create a `.env` file with the following variables (or modify the existing one):
   ```
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/cheatsheets
   NODE_ENV=development
   FILE_STORAGE_PATH=./uploads
   ```

## Running the Server

### Development Mode
```
npm run dev
```

### Production Mode
```
npm start
```

## API Endpoints

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

## Authentication

Authentication is implemented using a simple token-based system. For a production application, this should be replaced with JWT or a similar solution.

To authenticate requests, include a Bearer token in the Authorization header:

```
Authorization: Bearer <token>
```

## File Storage

Uploaded files are stored in the `uploads` directory by default. This can be configured in the `.env` file using the `FILE_STORAGE_PATH` variable.

## Error Handling

All errors are returned with appropriate HTTP status codes and a JSON response with the following structure:

```json
{
  "success": false,
  "error": "Error message"
}
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the ISC License. 