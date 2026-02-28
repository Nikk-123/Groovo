# Groovo Admin Panel

A professional admin dashboard for managing Groovo app users.

## Features

- **User Management**: View all registered users with their email addresses
- **Library Viewing**: See each user's complete song library with thumbnails
- **Statistics Dashboard**: Track total users, songs, and averages
- **Search & Filter**: Quickly find users by email
- **Secure Authentication**: Admin-only access with session management

## Setup

1. **Install Dependencies**:
   ```bash
   cd admin
   pip install -r requirements.txt
   ```

2. **Configure Environment Variables**:
   
   Add the following to your `.env` file in the parent directory:
   ```env
   # Admin credentials
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your_secure_password_here
   ADMIN_SECRET_KEY=your_secret_key_here
   
   # Admin port (optional, defaults to 8000)
   ADMIN_PORT=8000
   ```

3. **Run the Admin Panel**:
   ```bash
   python admin_app.py
   ```

4. **Access the Dashboard**:
   
   Open your browser and navigate to:
   ```
   http://localhost:8000
   ```
   
   Login with your admin credentials.

## Security Notes

- Change the default admin username and password in production
- Keep the `.env` file secure and never commit it to version control
- The admin panel uses session-based authentication with a 12-hour timeout
- All admin routes are protected with authentication middleware

## API Endpoints

- `GET /api/stats` - Get overall statistics
- `GET /api/users?search=<query>` - Get all users (with optional search)
- `GET /api/user/<email>` - Get specific user details
- `GET /api/user/<email>/library` - Get user's song library

## Technology Stack

- **Backend**: Flask (Python web framework)
- **Database**: MongoDB (shared with main Groovo app)
- **Frontend**: Tailwind CSS, Vanilla JavaScript
- **Authentication**: Session-based with bcrypt password hashing

## Folder Structure

```
admin/
├── admin_app.py          # Main Flask application
├── requirements.txt      # Python dependencies
├── templates/            # HTML templates
│   ├── admin_login.html
│   ├── admin_dashboard.html
│   └── 404.html
└── static/               # Static files
    ├── css/
    │   └── admin.css
    └── js/
        └── admin.js
```

## Notes

- The admin panel runs independently from the main Groovo app
- It shares the same MongoDB database to access user information
- No modifications were made to the main Groovo application code
- All configuration is handled through environment variables
