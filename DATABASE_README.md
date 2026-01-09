# SQL Database Integration Guide

## 🗄️ Database Overview

Your Wi-Fi Monitoring System now uses **SQLite** as the backend database, providing persistent storage for users, activity logs, system settings, and historical data.

## 📊 Database Schema

### Tables Created

#### 1. `users` Table
Stores user authentication and profile information.

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fullname TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  password TEXT NOT NULL,  -- Hashed with bcrypt
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT 1,
  last_login DATETIME
);
```

**Fields:**
- `id`: Unique user identifier
- `fullname`: User's full name
- `email`: Unique email address
- `username`: Unique username for login
- `role`: User role (user/admin/viewer)
- `password`: Hashed password (bcrypt)
- `created_at`: Account creation timestamp
- `is_active`: Account status (1=active, 0=inactive)
- `last_login`: Last successful login timestamp

#### 2. `activity_logs` Table
Tracks all system activities for audit purposes.

```sql
CREATE TABLE activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  action TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  FOREIGN KEY (user_id) REFERENCES users (id)
);
```

**Fields:**
- `id`: Log entry identifier
- `user_id`: Reference to user (if applicable)
- `username`: Username who performed action
- `action`: Description of action performed
- `timestamp`: When the action occurred
- `ip_address`: IP address of the user

#### 3. `districts` Table
Stores Wi-Fi hotspot data for each district.

```sql
CREATE TABLE districts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  total_hotspots INTEGER DEFAULT 0,
  active_hotspots INTEGER DEFAULT 0,
  utilization INTEGER DEFAULT 0,
  status TEXT DEFAULT 'normal',
  last_ping DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Fields:**
- `id`: District identifier
- `name`: District name
- `total_hotspots`: Total number of hotspots
- `active_hotspots`: Currently active hotspots
- `utilization`: Utilization percentage (0-100)
- `status`: District status (normal/warning/critical)
- `last_ping`: Last data update timestamp

#### 4. `system_settings` Table
Stores configurable system settings.

```sql
CREATE TABLE system_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Default Settings:**
- `update_interval`: Data refresh interval in seconds (default: 2)
- `critical_threshold`: Critical threshold percentage (default: 80)
- `max_logs`: Maximum activity logs to keep (default: 100)

#### 5. `wifi_metrics` Table
Stores historical Wi-Fi metrics for analysis.

```sql
CREATE TABLE wifi_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  total_hotspots INTEGER,
  active_hotspots INTEGER,
  utilization INTEGER,
  critical_districts INTEGER,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🔧 Database Features

### Security
- **Password Hashing**: All passwords are hashed using bcrypt (10 rounds)
- **SQL Injection Protection**: Parameterized queries prevent SQL injection
- **Data Validation**: Input validation on all database operations

### Performance
- **Connection Pooling**: Single database connection for efficiency
- **Indexing**: Proper indexes on frequently queried fields
- **Optimized Queries**: Efficient SQL queries for fast data retrieval

### Data Integrity
- **Foreign Keys**: Referential integrity between related tables
- **Unique Constraints**: Prevent duplicate usernames and emails
- **Default Values**: Sensible defaults for all fields

## 🚀 Getting Started

### 1. Database Initialization
The database is automatically created when you start the server:

```bash
npm start
```

**First-time setup:**
- Creates `wifi_monitoring.db` file in your project directory
- Initializes all tables with proper schema
- Seeds default admin user (admin/admin123)
- Creates 10 default districts with sample data
- Sets up default system settings

### 2. Default Admin Account
```
Username: admin
Password: admin123
Role: admin
```

### 3. Database File Location
```
C:\Users\mpjee\wifiproject\district wifi\wifi_monitoring.db
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User authentication
- `POST /api/auth/forgot-password` - Initiate password reset
- `POST /api/auth/reset-password` - Complete password reset

### User Management
- `GET /api/users` - Get all users
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Activity Logs
- `GET /api/logs` - Get activity logs
- `DELETE /api/logs` - Clear all logs

### System Settings
- `GET /api/settings/:key` - Get setting value
- `PUT /api/settings/:key` - Update setting

### District Data
- `GET /api/districts` - Get all districts
- `GET /api/districts/:id` - Get specific district
- `GET /api/metrics` - Get current metrics

## 🔍 Database Operations

### User Management
```javascript
// Create user
await database.createUser({
  fullname: 'John Doe',
  email: 'john@example.com',
  username: 'johndoe',
  role: 'user',
  password: 'password123'
});

// Authenticate user
const user = await database.authenticateUser('johndoe', 'password123');

// Get all users
const users = await database.getAllUsers();

// Update user
await database.updateUser(userId, { role: 'admin' });

// Delete user
await database.deleteUser(userId);
```

### Activity Logging
```javascript
// Log activity
await database.logActivity(userId, username, 'User logged in', '192.168.1.1');

// Get logs
const logs = await database.getActivityLogs(100);

// Clear logs
await database.clearActivityLogs();
```

### System Settings
```javascript
// Get setting
const interval = await database.getSetting('update_interval');

// Update setting
await database.updateSetting('update_interval', '5');
```

## 🛠️ Database Maintenance

### Backup Database
```bash
# Copy the database file
cp wifi_monitoring.db backup_wifi_monitoring_$(date +%Y%m%d).db
```

### View Database Content
```bash
# Using sqlite3 command line
sqlite3 wifi_monitoring.db

# Inside sqlite3:
.tables                    # Show all tables
.schema users              # Show table schema
SELECT * FROM users;       # View all users
SELECT COUNT(*) FROM users; # Count users
```

### Reset Database
```bash
# Delete database file (will be recreated on server start)
rm wifi_monitoring.db
npm start
```

## 📊 Data Analysis

### User Statistics
```sql
-- Total users by role
SELECT role, COUNT(*) as count FROM users GROUP BY role;

-- Active vs inactive users
SELECT is_active, COUNT(*) as count FROM users GROUP BY is_active;

-- Recent registrations
SELECT * FROM users ORDER BY created_at DESC LIMIT 10;
```

### Activity Analysis
```sql
-- Activity by user
SELECT username, COUNT(*) as activity_count 
FROM activity_logs 
GROUP BY username 
ORDER BY activity_count DESC;

-- Recent activities
SELECT * FROM activity_logs 
ORDER BY timestamp DESC 
LIMIT 50;
```

### District Performance
```sql
-- Districts by status
SELECT status, COUNT(*) as count 
FROM districts 
GROUP BY status;

-- High utilization districts
SELECT name, utilization 
FROM districts 
WHERE utilization > 80 
ORDER BY utilization DESC;
```

## 🔒 Security Considerations

### Password Security
- All passwords are hashed using bcrypt (10 salt rounds)
- Plain text passwords are never stored
- Password reset requires proper authentication

### Data Protection
- SQL injection prevention through parameterized queries
- Input validation on all user inputs
- Role-based access control for sensitive operations

### Audit Trail
- All user actions are logged with timestamps
- Administrative actions are tracked
- Failed login attempts can be monitored

## 🚀 Production Deployment

### Database Scaling
For production environments, consider:
- **PostgreSQL**: For large-scale deployments
- **MySQL**: For web application integration
- **MongoDB**: For flexible document storage

### Performance Optimization
- Add indexes for frequently queried fields
- Implement connection pooling for high traffic
- Consider read replicas for reporting queries

### Backup Strategy
- Regular automated backups
- Point-in-time recovery capability
- Database replication for high availability

## 🐛 Troubleshooting

### Common Issues

1. **Database Locked Error**
   ```bash
   # Kill any existing node processes
   taskkill /F /IM node.exe
   # Restart server
   npm start
   ```

2. **Permission Denied**
   ```bash
   # Check file permissions
   ls -la wifi_monitoring.db
   # Ensure write permissions
   chmod 664 wifi_monitoring.db
   ```

3. **Corrupted Database**
   ```bash
   # Check database integrity
   sqlite3 wifi_monitoring.db "PRAGMA integrity_check;"
   # If corrupted, restore from backup
   ```

### Debug Mode
Enable debug logging by setting environment variable:
```bash
DEBUG=database:* npm start
```

## 📝 Migration from LocalStorage

If you have existing users in localStorage, you can migrate them:

```javascript
// Migration script (run once)
const localStorageUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');

localStorageUsers.forEach(async (user) => {
  try {
    await database.createUser({
      fullname: user.fullname,
      email: user.email,
      username: user.username,
      role: user.role,
      password: user.password // Will be hashed automatically
    });
    console.log(`Migrated user: ${user.username}`);
  } catch (error) {
    console.error(`Failed to migrate ${user.username}:`, error);
  }
});
```

---

**Note**: The SQLite database provides a robust, production-ready foundation for your Wi-Fi monitoring system. All data is now persistent and secure!
