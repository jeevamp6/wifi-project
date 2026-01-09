const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const path = require('path');
const database = require('./database');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Wi-Fi Hotspot Data Store (in-memory for real-time updates)
let wifiData = {
  totalHotspots: 12500,
  activeHotspots: 9800,
  utilization: 62,
  criticalDistricts: 118,
  districts: [],
  lastUpdated: new Date().toISOString()
};

// Initialize database and load initial data
async function initializeSystem() {
  try {
    await database.init();
    console.log('Database initialized successfully');
    
    // Load districts from database
    wifiData.districts = await database.getAllDistricts();
    console.log(`Loaded ${wifiData.districts.length} districts from database`);
    
    // Calculate initial metrics
    updateMetricsFromDistricts();
    
  } catch (error) {
    console.error('Failed to initialize system:', error);
    process.exit(1);
  }
}

// Update metrics from districts data
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
    // Update main metrics with realistic variations
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
    data: wifiData
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
    data: wifiData
  }));

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// REST API Routes

// Main data endpoints
app.get('/api/wifi-data', async (req, res) => {
  try {
    res.json(wifiData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.get('/api/districts', async (req, res) => {
  try {
    const districts = await database.getAllDistricts();
    res.json(districts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch districts' });
  }
});

app.get('/api/districts/:id', async (req, res) => {
  try {
    const districts = await database.getAllDistricts();
    const district = districts.find(d => d.id == req.params.id);
    if (district) {
      res.json(district);
    } else {
      res.status(404).json({ error: 'District not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch district' });
  }
});

app.get('/api/metrics', async (req, res) => {
  try {
    res.json({
      totalHotspots: wifiData.totalHotspots,
      activeHotspots: wifiData.activeHotspots,
      utilization: wifiData.utilization,
      criticalDistricts: wifiData.criticalDistricts,
      lastUpdated: wifiData.lastUpdated
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// User management endpoints
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullname, email, username, role, password } = req.body;
    
    // Validate input
    if (!fullname || !email || !username || !role || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    
    if (!['user', 'admin', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    const user = await database.createUser({ fullname, email, username, role, password });
    
    // Log activity
    await database.logActivity(null, 'system', `Created new user: ${username} (${role})`);
    
    res.status(201).json({ message: 'User created successfully', user: { id: user.id, fullname, email, username, role } });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Username or email already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, loginType = 'user' } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    let user = null;
    
    if (loginType === 'admin' && username === 'admin') {
      // Check default admin credentials
      user = await database.authenticateUser(username, password);
    } else {
      // Regular user authentication
      user = await database.authenticateUser(username, password);
    }
    
    if (user) {
      // Log activity
      await database.logActivity(user.id, user.username, 'User logged in');
      
      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          fullname: user.fullname,
          email: user.email,
          username: user.username,
          role: user.role,
          last_login: user.last_login
        }
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await database.getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const updates = req.body;
    
    // Remove sensitive fields
    delete updates.id;
    delete updates.created_at;
    delete updates.password;
    
    const result = await database.updateUser(userId, updates);
    
    if (result.changes > 0) {
      // Log activity
      await database.logActivity(null, 'system', `Updated user ID: ${userId}`);
      res.json({ message: 'User updated successfully' });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const result = await database.deleteUser(userId);
    
    if (result.changes > 0) {
      // Log activity
      await database.logActivity(null, 'system', `Deleted user ID: ${userId}`);
      res.json({ message: 'User deleted successfully' });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Activity logs endpoints
app.get('/api/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const logs = await database.getActivityLogs(limit);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

app.delete('/api/logs', async (req, res) => {
  try {
    await database.clearActivityLogs();
    res.json({ message: 'Logs cleared successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

// System settings endpoints
app.get('/api/settings/:key', async (req, res) => {
  try {
    const value = await database.getSetting(req.params.key);
    if (value !== null) {
      res.json({ key: req.params.key, value });
    } else {
      res.status(404).json({ error: 'Setting not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
});

app.put('/api/settings/:key', async (req, res) => {
  try {
    const { value } = req.body;
    await database.updateSetting(req.params.key, value);
    
    // Log activity
    await database.logActivity(null, 'system', `Updated setting: ${req.params.key} = ${value}`);
    
    res.json({ message: 'Setting updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'connected'
  });
});

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'home.html'));
});

// Start the server
async function startServer() {
  await initializeSystem();
  
  // Start real-time data updates
  const updateInterval = await database.getSetting('update_interval') || '2';
  setInterval(simulateRealTimeData, parseInt(updateInterval) * 1000);
  
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`WebSocket server ready for real-time connections`);
    console.log(`API endpoints available at http://localhost:${PORT}/api/`);
    console.log(`Dashboard available at http://localhost:${PORT}/`);
    console.log(`Database: SQLite (wifi_monitoring.db)`);
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  database.close();
  process.exit(0);
});

startServer().catch(console.error);
