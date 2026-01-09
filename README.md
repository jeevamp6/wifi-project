# District Wi-Fi Monitoring System

A comprehensive real-time Wi-Fi hotspot monitoring dashboard with multi-role user management, authentication system, and WebSocket-based real-time data updates.

## 🚀 Features

### Real-Time Monitoring
- **Live Data Updates**: WebSocket-based real-time data every 2 seconds
- **Smooth Animations**: Number transitions and status changes
- **Connection Status**: Live connection indicator with auto-reconnection
- **District-Level Monitoring**: Track 10 different districts with individual metrics

### User Management System
- **Multi-Role Authentication**: Admin, User, and Viewer roles
- **User Registration**: Complete signup system with validation
- **Role-Based Access**: Different dashboards for different user types
- **Password Management**: Forgot password functionality

### Admin Panel
- **User Management**: Add, edit, disable, and delete users
- **System Settings**: Configure update intervals and thresholds
- **Activity Logs**: Track all administrative actions
- **Data Export**: Export user data in JSON format
- **Statistics Dashboard**: User and system statistics

### Security Features
- **Session Management**: Secure login/logout functionality
- **Role Protection**: Pages protected based on user roles
- **Input Validation**: Form validation for all user inputs
- **Activity Tracking**: Complete audit trail of user actions

## 🛠 Technology Stack

- **Backend**: Node.js, Express.js
- **Real-time Communication**: WebSocket (ws library)
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Data Storage**: LocalStorage (for demo), easily replaceable with database
- **Authentication**: Role-based access control

## 📋 User Roles & Access

### Admin (admin/admin123)
- **Full Access**: Complete system administration
- **User Management**: Create, edit, delete users
- **System Settings**: Configure system parameters
- **Activity Logs**: View and manage audit trails
- **Dashboard**: Full monitoring dashboard with admin features

### Regular User
- **Dashboard Access**: View monitoring dashboard
- **Real-time Data**: Live updates of Wi-Fi metrics
- **Basic Features**: Standard monitoring capabilities

### Viewer
- **Read-Only Access**: View-only dashboard
- **Real-time Data**: Live monitoring without modification rights
- **Limited Interface**: Simplified view-only interface

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd "C:\Users\mpjee\wifiproject\district wifi"
npm install
```

### 2. Start the Backend Server
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

### 3. Access the System

**Main Login**: `http://localhost:3000/login.html`

**Direct Access**:
- Admin Panel: `http://localhost:3000/admin.html` (requires admin login)
- User Dashboard: `http://localhost:3000/home.html` (requires user login)
- Viewer Dashboard: `http://localhost:3000/viewer.html` (requires viewer login)
- Sign Up: `http://localhost:3000/signup.html`

## 📡 API Endpoints

### Main Data Endpoints
- `GET /api/wifi-data` - Complete Wi-Fi monitoring data
- `GET /api/metrics` - Main dashboard metrics
- `GET /api/districts` - All district data
- `GET /api/districts/:id` - Specific district data
- `GET /api/health` - Server health check

### WebSocket Connection
- **URL**: `ws://localhost:3000`
- **Message Types**:
  - `initial_data` - Current data when first connected
  - `data_update` - Real-time updates every 2 seconds

## 🎯 How to Use the System

### 1. First-Time Setup
1. Start the backend server
2. Go to `http://localhost:3000/signup.html`
3. Create your first user account
4. Use admin credentials (admin/admin123) to access admin panel

### 2. User Registration
1. Navigate to signup page
2. Fill in all required fields:
   - Full Name
   - Email Address
   - Username
   - Role (User/Admin/Viewer)
   - Password (min 8 characters)
3. Click "Sign Up" to create account

### 3. Login Process
1. Go to login page
2. Select login type (User/Admin)
3. Enter credentials
4. System redirects to appropriate dashboard based on role

### 4. Admin Functions
- **View Dashboard**: Monitor system metrics and user statistics
- **Manage Users**: Add, edit, enable/disable, delete users
- **System Settings**: Configure update intervals and thresholds
- **View Logs**: Monitor all system activities
- **Export Data**: Download user data as JSON

## 🔧 Configuration

### Server Configuration
- **Port**: 3000 (configurable via PORT environment variable)
- **Update Interval**: 2 seconds (configurable in server.js)
- **District Count**: 10 districts (configurable in initialization)

### Data Simulation
The system includes realistic data simulation:
- Random fluctuations in hotspot counts
- Dynamic utilization percentages
- Status changes for districts
- Real-time metric updates

## 📊 Data Structure

### Main Metrics
```json
{
  "totalHotspots": 12500,
  "activeHotspots": 9800,
  "utilization": 62,
  "criticalDistricts": 118,
  "lastUpdated": "2024-01-08T15:30:00.000Z"
}
```

### User Data
```json
{
  "id": 1234567890,
  "fullname": "John Doe",
  "email": "john@example.com",
  "username": "johndoe",
  "role": "user",
  "password": "hashed_password",
  "createdAt": "2024-01-08T15:30:00.000Z",
  "isActive": true
}
```

### District Data
```json
{
  "id": 1,
  "name": "North District",
  "totalHotspots": 1500,
  "activeHotspots": 1200,
  "utilization": 75,
  "status": "normal|warning|critical",
  "lastPing": "2024-01-08T15:30:00.000Z"
}
```

## 🔒 Security Notes

### Current Implementation
- Passwords are stored in plain text (for demo purposes)
- Session management using localStorage
- Role-based page protection

### Production Recommendations
- Implement password hashing (bcrypt)
- Use secure session management (express-session)
- Add database integration (MongogreSQL/MySQL)
- Implement JWT tokens for API authentication
- Add rate limiting and input sanitization
- Use HTTPS for secure connections

## 🚀 Deployment

### Development
```bash
npm run dev  # Uses nodemon for auto-restart
```

### Production
```bash
npm start   # Production mode
```

### Environment Variables
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)

## 📝 File Structure

```
district wifi/
├── server.js              # Main backend server
├── package.json           # Dependencies and scripts
├── README.md              # This file
├── login.html             # Login page
├── login.js               # Login functionality
├── login.css              # Login styles
├── signup.html            # User registration
├── signup.js              # Registration functionality
├── home.html              # User dashboard
├── home.js                # User dashboard scripts
├── admin.html             # Admin panel
├── admin.js               # Admin functionality
├── viewer.html            # Viewer dashboard
├── viewer.js              # Viewer functionality
└── style.css              # Main styles
```

## 🐛 Troubleshooting

### Common Issues

1. **Server Won't Start**
   - Check if port 3000 is available
   - Run `npm install` to ensure dependencies

2. **WebSocket Connection Fails**
   - Ensure backend server is running
   - Check browser console for errors
   - Verify firewall settings

3. **Login Not Working**
   - Clear browser localStorage
   - Check user credentials in registered users
   - Verify role-based redirects

4. **Real-time Updates Not Working**
   - Check WebSocket connection status
   - Verify backend server is running
   - Check browser console for errors

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - Feel free to use this project for learning and development purposes.

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review the console logs
3. Verify all dependencies are installed
4. Ensure proper file structure

---

**Note**: This is a demonstration project with simulated data. In production, replace the data simulation with actual Wi-Fi hotspot monitoring APIs and implement proper database integration.
