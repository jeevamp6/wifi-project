const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const csrf = require('csrf');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// CSRF protection setup
const csrfTokens = new csrf();

// Rate limiting setup
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true,
});

// Database setup
const DB_PATH = path.join(__dirname, 'wifi_monitoring.db');
const db = new sqlite3.Database(DB_PATH);

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true
}));

app.use(limiter);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: true
}));

// Session configuration
app.use(session({
  name: 'sessionId',
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  rolling: true
}));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Global data store for real-time updates
let wifiData = {
  totalHotspots: 12500,
  activeHotspots: 9800,
  utilization: 62,
  criticalDistricts: 118,
  districts: [],
  lastUpdated: new Date().toISOString()
};

// Load districts from database
async function loadDistrictsFromDB() {
  return new Promise((resolve, reject) => {
    const database = require('./database.js');
    database.getAllDistricts().then(rows => {
      wifiData.districts = rows;
      updateMetricsFromDistricts();
      resolve();
    }).catch(reject);
  });
}

// Update metrics from districts
function updateMetricsFromDistricts() {
  const totalHotspots = wifiData.districts.reduce((sum, district) => sum + district.total_hotspots, 0);
  const activeHotspots = wifiData.districts.reduce((sum, district) => sum + district.active_hotspots, 0);
  const utilization = totalHotspots > 0 ? Math.round((activeHotspots / totalHotspots) * 100) : 0;
  const criticalDistricts = wifiData.districts.filter(d => d.status === 'critical').length;
  
  wifiData.totalHotspots = totalHotspots;
  wifiData.activeHotspots = activeHotspots;
  wifiData.utilization = utilization;
  wifiData.criticalDistricts = criticalDistricts;
  wifiData.lastUpdated = new Date().toISOString();
}

// Real-time data simulation
async function simulateRealTimeData() {
  try {
    const database = require('./database.js');
    
    // Update main metrics
    wifiData.totalHotspots += Math.floor(Math.random() * 20) - 10;
    wifiData.activeHotspots += Math.floor(Math.random() * 30) - 15;
    wifiData.utilization = Math.max(0, Math.min(100, wifiData.utilization + Math.floor(Math.random() * 6) - 3));
    
    // Update district data
    for (let district of wifiData.districts) {
      const newActiveHotspots = Math.max(0, Math.min(district.total_hotspots, 
        district.active_hotspots + Math.floor(Math.random() * 20) - 10));
      const newUtilization = Math.max(0, Math.min(100, 
        district.utilization + Math.floor(Math.random() * 8) - 4));
      
      // Randomly change status
      const rand = Math.random();
      let newStatus = district.status;
      if (rand < 0.05) {
        newStatus = district.status === 'critical' ? 'warning' : 'critical';
      } else if (rand < 0.1) {
        newStatus = district.status === 'normal' ? 'warning' : 'normal';
      }
      
      // Update in database
      await database.updateDistrict(district.id, {
        active_hotspots: newActiveHotspots,
        utilization: newUtilization,
        status: newStatus
      });
      
      // Update in-memory data
      district.active_hotspots = newActiveHotspots;
      district.utilization = newUtilization;
      district.status = newStatus;
      district.last_ping = new Date().toISOString();
    }
    
    // Recalculate metrics
    updateMetricsFromDistricts();
    
    // Save metrics to database
    await database.saveMetrics({
      totalHotspots: wifiData.totalHotspots,
      activeHotspots: wifiData.activeHotspots,
      utilization: wifiData.utilization,
      criticalDistricts: wifiData.criticalDistricts
    });
    
    // Broadcast to all connected clients
    broadcastUpdate();
    
  } catch (error) {
    console.error('Error in real-time data simulation:', error);
  }
}

// WebSocket broadcast function
function broadcastUpdate() {
  const message = JSON.stringify({
    type: 'data_update',
    data: {
      districts: wifiData.districts,
      totalHotspots: wifiData.totalHotspots,
      activeHotspots: wifiData.activeHotspots,
      utilization: wifiData.utilization,
      criticalDistricts: wifiData.criticalDistricts
    }
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New WebSocket client connected');
  
  // Send current data immediately
  ws.send(JSON.stringify({
    type: 'initial_data',
    data: {
      hotspots: generateSampleHotspots(),
      districts: wifiData.districts,
      totalHotspots: wifiData.totalHotspots,
      activeHotspots: wifiData.activeHotspots,
      utilization: wifiData.utilization
    }
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'request_update') {
        // Send current data on request
        ws.send(JSON.stringify({
          type: 'data_update',
          data: {
            districts: wifiData.districts,
            totalHotspots: wifiData.totalHotspots,
            activeHotspots: wifiData.activeHotspots,
            utilization: wifiData.utilization
          }
        }));
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Generate sample hotspot data
function generateSampleHotspots() {
  return [
    {
      id: 1,
      name: "Times Square Hotspot",
      lat: 40.7580,
      lng: -73.9855,
      status: "online",
      connections: Math.floor(Math.random() * 50) + 20,
      utilization: Math.floor(Math.random() * 30) + 60,
      address: "Times Square, NYC"
    },
    {
      id: 2,
      name: "Central Park WiFi",
      lat: 40.7829,
      lng: -73.9654,
      status: "online",
      connections: Math.floor(Math.random() * 40) + 15,
      utilization: Math.floor(Math.random() * 25) + 55,
      address: "Central Park, NYC"
    },
    {
      id: 3,
      name: "Brooklyn Bridge Hotspot",
      lat: 40.7061,
      lng: -73.9969,
      status: Math.random() > 0.3 ? "warning" : "online",
      connections: Math.floor(Math.random() * 60) + 30,
      utilization: Math.floor(Math.random() * 20) + 70,
      address: "Brooklyn Bridge, NYC"
    },
    {
      id: 4,
      name: "Wall Street Zone",
      lat: 40.7074,
      lng: -74.0113,
      status: Math.random() > 0.8 ? "offline" : "online",
      connections: Math.floor(Math.random() * 10),
      utilization: Math.random() > 0.8 ? 0 : Math.floor(Math.random() * 15) + 40,
      address: "Wall Street, NYC"
    },
    {
      id: 5,
      name: "Union Square Hub",
      lat: 40.7359,
      lng: -73.9911,
      status: "online",
      connections: Math.floor(Math.random() * 45) + 25,
      utilization: Math.floor(Math.random() * 35) + 50,
      address: "Union Square, NYC"
    }
  ];
}

// Helper functions
async function logActivity(userId, username, action, ipAddress = null, userType = 'user') {
  const database = require('./database.js');
  return await database.logActivity(userId, username, action, ipAddress, userType);
}

// Middleware to check authentication
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Middleware to check role
function requireRole(role) {
  return (req, res, next) => {
    if (req.session && req.session.userRole === role) {
      next();
    } else {
      res.status(403).send('Access denied');
    }
  };
}

// Routes

// Home/Login page
app.get('/', (req, res) => {
  res.render('login');
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.get('/signup', (req, res) => {
  res.render('signup');
});

// Authentication routes
app.post('/auth/login', authLimiter, async (req, res) => {
  const { username, password, loginType = 'user' } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  // Sanitize input
  const sanitizedUsername = username.trim().replace(/[<>"'&]/g, '');
  
  try {
    const database = require('./database.js');
    const user = await database.authenticateUser(sanitizedUsername, password, loginType);
    
    if (user) {
      // Check if admin is pending verification
      if (user.role === 'admin' && user.status === 'pending_verification') {
        return res.status(403).json({ 
          error: 'Admin account is pending verification. Please contact system administrator.',
          pendingVerification: true 
        });
      }
      
      // Store user in session
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.username = user.username;
      req.session.loginType = loginType;
      
      // Log activity in appropriate database
      await database.logActivity(user.id, user.username, 'User logged in', req.ip, loginType);
      
      // Create security event for suspicious login (multiple failed attempts would be tracked separately)
      if (req.session.loginAttempts && req.session.loginAttempts > 3) {
        await database.createSecurityEvent({
          event_type: 'suspicious_login',
          severity: 'medium',
          device_id: null,
          mac_address: null,
          ip_address: req.ip,
          description: `Multiple failed login attempts before successful login for user: ${sanitizedUsername}`
        });
      }
      
      // Reset login attempts
      req.session.loginAttempts = 0;
      
      // Redirect based on role
      let redirectUrl = '/dashboard';
      if (user.role === 'admin') {
        redirectUrl = '/admin';
      } else if (user.role === 'viewer') {
        redirectUrl = '/viewer';
      }
      
      res.json({ 
        success: true, 
        redirect: redirectUrl,
        user: {
          id: user.id,
          fullname: user.fullname,
          username: user.username,
          role: user.role
        }
      });
    } else {
      // Track failed login attempts
      req.session.loginAttempts = (req.session.loginAttempts || 0) + 1;
      
      // Create security event for failed login
      const database = require('./database.js');
      await database.createSecurityEvent({
        event_type: 'failed_login',
        severity: 'low',
        device_id: null,
        mac_address: null,
        ip_address: req.ip,
        description: `Failed login attempt for user: ${sanitizedUsername}`
      });
      
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/auth/register', async (req, res) => {
  const { fullname, email, username, role, password, userType = 'user' } = req.body;
  
  if (!fullname || !email || !username || !role || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  // Sanitize input
  const sanitizedFullname = fullname.trim().replace(/[<>"'&]/g, '');
  const sanitizedEmail = email.trim().toLowerCase();
  const sanitizedUsername = username.trim().replace(/[<>"'&]/g, '');
  
  try {
    const database = require('./database.js');
    
    // Check if user already exists
    const existingUser = await database.getUserByUsername(sanitizedUsername);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    
    const existingEmail = await database.getUserByEmail(sanitizedEmail);
    if (existingEmail) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    
    // Create user
    const userId = await database.createUser({
      fullname: sanitizedFullname,
      email: sanitizedEmail,
      username: sanitizedUsername,
      role: role,
      password: password,
      userType: userType
    });
    
    // Log activity
    await database.logActivity(userId, sanitizedUsername, 'User registered', req.ip, userType);
    
    res.status(201).json({ 
      success: true, 
      message: 'Registration successful',
      userId: userId
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Admin registration with government ID verification
app.post('/api/auth/admin-register', authLimiter, async (req, res) => {
  const { fullname, email, username, govId, department, password, registrationType } = req.body;
  
  if (!fullname || !email || !username || !govId || !department || !password) {
    return res.status(400).json({ error: 'All fields are required for admin registration' });
  }
  
  // Enhanced validation for government ID
  if (!/^[A-Za-z0-9]{12}$/.test(govId)) {
    return res.status(400).json({ error: 'Government ID must be exactly 12 alphanumeric characters' });
  }
  
  // Check for minimum complexity
  const letterCount = (govId.match(/[A-Za-z]/g) || []).length;
  const numberCount = (govId.match(/[0-9]/g) || []).length;
  if (letterCount < 2 || numberCount < 2) {
    return res.status(400).json({ error: 'Government ID must contain at least 2 letters and 2 numbers' });
  }
  
  // Sanitize input
  const sanitizedFullname = fullname.trim().replace(/[<>"'&]/g, '');
  const sanitizedEmail = email.trim().toLowerCase();
  const sanitizedUsername = username.trim().replace(/[<>"'&]/g, '');
  const sanitizedGovId = govId.trim().toUpperCase();
  
  try {
    const database = require('./database.js');
    
    // Check if admin already exists
    const existingUser = await database.getUserByUsername(sanitizedUsername);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    
    const existingEmail = await database.getUserByEmail(sanitizedEmail);
    if (existingEmail) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    
    // Check if government ID already used
    const existingGovId = await database.getAdminByGovId(sanitizedGovId);
    if (existingGovId) {
      return res.status(409).json({ error: 'Government ID already registered' });
    }
    
    // Generate registration ID
    const registrationId = 'REG-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    
    // Create admin with pending verification status
    const adminData = {
      fullname: sanitizedFullname,
      email: sanitizedEmail,
      username: sanitizedUsername,
      role: 'admin',
      password: password,
      userType: 'admin',
      department: department,
      govId: sanitizedGovId,
      registrationId: registrationId,
      status: 'pending_verification',
      isActive: false
    };
    
    const userId = await database.createAdmin(adminData);
    
    // Log admin registration attempt
    await database.logActivity(userId, sanitizedUsername, 'Admin registration submitted', req.ip, 'admin');
    
    // Create security event for admin registration
    await database.createSecurityEvent({
      event_type: 'admin_registration',
      severity: 'medium',
      device_id: null,
      mac_address: null,
      ip_address: req.ip,
      description: `Admin registration submitted: ${sanitizedUsername} (${registrationId})`
    });
    
    res.status(201).json({ 
      success: true, 
      message: 'Admin registration submitted successfully. Pending verification.',
      registrationId: registrationId,
      userId: userId
    });
  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({ error: 'Admin registration failed' });
  }
});

app.post('/auth/forgot-password', async (req, res) => {
  const { username, userType = 'user' } = req.body;
  // ... (rest of the code remains the same)
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  
  try {
    const database = require('./database.js');
    const tableName = userType === 'admin' ? 'admins' : 'users';
    const db = userType === 'admin' ? database.adminDb : database.userDb;
    
    const user = await new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM ${tableName} WHERE username = ?`,
        [username],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    if (user) {
      // In a real application, you would send an email here
      // For demo purposes, we'll just return success
      res.json({ success: true, message: 'Password reset instructions sent' });
    } else {
      res.status(404).json({ error: 'Username not found' });
    }
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// Serve real-time monitor page
app.get('/monitor', (req, res) => {
  res.sendFile(path.join(__dirname, 'realtime-monitor.html'));
});

// Dashboard routes
app.get('/dashboard', (req, res) => {
  res.render('dashboard', { wifiData, userRole: 'user' });
});

app.get('/admin', (req, res) => {
  res.render('admin', { wifiData, userRole: 'admin' });
});

app.get('/viewer', (req, res) => {
  res.render('viewer', { wifiData, userRole: 'viewer' });
});

app.get('/devices', (req, res) => {
  res.sendFile(path.join(__dirname, 'devices.html'));
});

// API routes
app.get('/api/wifi-data', (req, res) => {
  res.json(wifiData);
});

app.get('/api/users', async (req, res) => {
  try {
    const database = require('./database.js');
    const userType = req.query.userType || 'user';
    const users = await database.getAllUsers(userType);
    res.json(users);
  } catch (error) {
    console.error('Users API error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/logs', async (req, res) => {
  try {
    const database = require('./database.js');
    const limit = parseInt(req.query.limit) || 100;
    const userType = req.query.userType || 'user';
    const logs = await database.getActivityLogs(limit, userType);
    res.json(logs);
  } catch (error) {
    console.error('Logs API error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Device API routes
app.get('/api/devices', async (req, res) => {
  try {
    const database = require('./database.js');
    const limit = parseInt(req.query.limit) || 100;
    const filters = {
      district_id: req.query.district_id,
      status: req.query.status
    };
    const devices = await database.getDevices(limit, filters);
    res.json(devices);
  } catch (error) {
    console.error('Devices API error:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

app.get('/api/device-logs', async (req, res) => {
  try {
    const database = require('./database.js');
    const deviceId = req.query.device_id ? parseInt(req.query.device_id) : null;
    const limit = parseInt(req.query.limit) || 100;
    const logs = await database.getDeviceLogs(deviceId, limit);
    res.json(logs);
  } catch (error) {
    console.error('Device logs API error:', error);
    res.status(500).json({ error: 'Failed to fetch device logs' });
  }
});

app.get('/api/security-events', async (req, res) => {
  try {
    const database = require('./database.js');
    const limit = parseInt(req.query.limit) || 100;
    const unresolvedOnly = req.query.unresolved === 'true';
    const events = await database.getSecurityEvents(limit, unresolvedOnly);
    res.json(events);
  } catch (error) {
    console.error('Security events API error:', error);
    res.status(500).json({ error: 'Failed to fetch security events' });
  }
});

// Get login activities
app.get('/api/login-activities', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const database = require('./database.js');
    const limit = parseInt(req.query.limit) || 100;
    
    // Get both user and admin login activities
    const [userActivities, adminActivities] = await Promise.all([
      database.getActivityLogs(limit, 'user'),
      database.getActivityLogs(limit, 'admin')
    ]);
    
    // Combine and format activities
    const allActivities = [
      ...userActivities.map(activity => ({
        ...activity,
        userType: 'user',
        userIdField: 'user_id'
      })),
      ...adminActivities.map(activity => ({
        ...activity,
        userType: 'admin',
        userIdField: 'admin_id'
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json(allActivities);
  } catch (error) {
    console.error('Get login activities error:', error);
    res.status(500).json({ error: 'Failed to fetch login activities' });
  }
});

// Approve admin registration
app.post('/api/admin/approve/:id', async (req, res) => {
  try {
    if (!req.session.userId || req.session.userRole !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const database = require('./database.js');
    const adminId = parseInt(req.params.id);
    const approvedBy = req.session.username;
    
    // Get admin details first
    const admin = await database.getAdminById(adminId);
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    
    // Approve the admin
    await database.updateAdmin(adminId, {
      is_active: true,
      status: 'active',
      approved_by: approvedBy,
      approved_at: new Date().toISOString()
    });
    
    // Log approval
    await database.logActivity(adminId, admin.username, 'Admin account approved', req.ip, 'admin');
    
    res.json({ success: true, message: 'Admin account approved successfully' });
  } catch (error) {
    console.error('Admin approval error:', error);
    res.status(500).json({ error: 'Failed to approve admin' });
  }
});

// Get pending admin registrations
app.get('/api/admin/pending', async (req, res) => {
  try {
    if (!req.session.userId || req.session.userRole !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const database = require('./database.js');
    const pendingAdmins = await database.getPendingAdmins();
    res.json(pendingAdmins);
  } catch (error) {
    console.error('Get pending admins error:', error);
    res.status(500).json({ error: 'Failed to fetch pending admins' });
  }
});

app.post('/api/security-events/:id/resolve', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const database = require('./database.js');
    const eventId = parseInt(req.params.id);
    const resolvedBy = req.session.username;
    
    await database.resolveSecurityEvent(eventId, resolvedBy);
    res.json({ success: true });
  } catch (error) {
    console.error('Resolve security event error:', error);
    res.status(500).json({ error: 'Failed to resolve security event' });
  }
});

// Device simulation endpoint (for testing)
app.post('/api/simulate-device', async (req, res) => {
  try {
    const database = require('./database.js');
    const deviceData = {
      mac_address: `AA:BB:CC:DD:EE:${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`,
      ip_address: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
      device_name: `Device_${Math.floor(Math.random() * 1000)}`,
      device_type: ['laptop', 'mobile', 'tablet', 'desktop'][Math.floor(Math.random() * 4)],
      vendor: 'Unknown',
      os_type: ['Windows', 'Android', 'iOS', 'Linux'][Math.floor(Math.random() * 4)],
      district_id: Math.floor(Math.random() * 10) + 1,
      hotspot_id: Math.floor(Math.random() * 50) + 1
    };
    
    const result = await database.registerDevice(deviceData);
    
    // Log the connection
    await database.logDeviceConnection(result.id, 'connect', {
      ...deviceData,
      duration: Math.floor(Math.random() * 3600),
      data_transferred: Math.floor(Math.random() * 1000000),
      signal_strength: Math.floor(Math.random() * 100),
      user_agent: 'Mozilla/5.0 (Simulated Device)'
    });
    
    res.json({ success: true, device: result });
  } catch (error) {
    console.error('Device simulation error:', error);
    res.status(500).json({ error: 'Failed to simulate device' });
  }
});

// Start server
async function startServer() {
  const database = require('./database.js');
  await database.init();
  
  // Load districts from database
  await loadDistrictsFromDB();
  
  // Start real-time data updates
  setInterval(simulateRealTimeData, 2000);
  
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Unified Wi-Fi Monitoring System running on port ${PORT}`);
    console.log(`Dashboard: http://localhost:${PORT}`);
    console.log(`Database: SQLite (Multiple databases: users.db, admins.db, wifi_monitoring.db)`);
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  const database = require('./database.js');
  database.close();
  process.exit(0);
});

startServer().catch(console.error);
