const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

// Database file paths
const USER_DB_PATH = path.join(__dirname, 'users.db');
const ADMIN_DB_PATH = path.join(__dirname, 'admins.db');
const WIFI_DB_PATH = path.join(__dirname, 'wifi_monitoring.db');
const DEVICES_DB_PATH = path.join(__dirname, 'devices.db');

class Database {
  constructor() {
    this.userDb = null;
    this.adminDb = null;
    this.wifiDb = null;
    this.deviceDb = null;
  }

  // Initialize database connections
  async init() {
    return new Promise((resolve, reject) => {
      // Initialize user database
      this.userDb = new sqlite3.Database(USER_DB_PATH, (err) => {
        if (err) {
          console.error('Error opening user database:', err);
          reject(err);
        } else {
          console.log('Connected to User SQLite database');
        }
      });

      // Initialize admin database
      this.adminDb = new sqlite3.Database(ADMIN_DB_PATH, (err) => {
        if (err) {
          console.error('Error opening admin database:', err);
          reject(err);
        } else {
          console.log('Connected to Admin SQLite database');
        }
      });

      // Initialize WiFi monitoring database
      this.wifiDb = new sqlite3.Database(WIFI_DB_PATH, (err) => {
        if (err) {
          console.error('Error opening WiFi database:', err);
          reject(err);
        } else {
          console.log('Connected to WiFi SQLite database');
        }
      });

      // Initialize devices database
      this.deviceDb = new sqlite3.Database(DEVICES_DB_PATH, (err) => {
        if (err) {
          console.error('Error opening devices database:', err);
          reject(err);
        } else {
          console.log('Connected to Devices SQLite database');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  // Create database tables
  async createTables() {
    return new Promise((resolve, reject) => {
      const userQueries = [
        // Users table
        `CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fullname TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          username TEXT UNIQUE NOT NULL,
          role TEXT NOT NULL DEFAULT 'user',
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT 1,
          last_login DATETIME
        )`,
        
        // User activity logs table
        `CREATE TABLE IF NOT EXISTS user_activity_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          username TEXT,
          action TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          ip_address TEXT,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )`
      ];

      const adminQueries = [
        // Admins table
        `CREATE TABLE IF NOT EXISTS admins (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fullname TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          username TEXT UNIQUE NOT NULL,
          role TEXT NOT NULL DEFAULT 'admin',
          password TEXT NOT NULL,
          department TEXT,
          gov_id TEXT UNIQUE,
          registration_id TEXT,
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT 1,
          last_login DATETIME
        )`,
        
        // Admin activity logs table
        `CREATE TABLE IF NOT EXISTS admin_activity_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          admin_id INTEGER,
          username TEXT,
          action TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          ip_address TEXT,
          FOREIGN KEY (admin_id) REFERENCES admins (id)
        )`
      ];

      const wifiQueries = [
        // Districts table
        `CREATE TABLE IF NOT EXISTS districts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          total_hotspots INTEGER DEFAULT 0,
          active_hotspots INTEGER DEFAULT 0,
          utilization INTEGER DEFAULT 0,
          status TEXT DEFAULT 'normal',
          last_ping DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        
        // System settings table
        `CREATE TABLE IF NOT EXISTS system_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          setting_key TEXT UNIQUE NOT NULL,
          setting_value TEXT,
          description TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        
        // Wi-Fi metrics table (for historical data)
        `CREATE TABLE IF NOT EXISTS wifi_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          total_hotspots INTEGER,
          active_hotspots INTEGER,
          utilization INTEGER,
          critical_districts INTEGER,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      ];

      const deviceQueries = [
        // Devices table
        `CREATE TABLE IF NOT EXISTS devices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          mac_address TEXT UNIQUE NOT NULL,
          ip_address TEXT,
          device_name TEXT,
          device_type TEXT,
          vendor TEXT,
          os_type TEXT,
          first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'active',
          data_usage BIGINT DEFAULT 0,
          connection_count INTEGER DEFAULT 0,
          district_id INTEGER,
          hotspot_id INTEGER,
          FOREIGN KEY (district_id) REFERENCES districts (id)
        )`,
        
        // Device connection logs
        `CREATE TABLE IF NOT EXISTS device_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          device_id INTEGER,
          mac_address TEXT,
          ip_address TEXT,
          action TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          duration INTEGER,
          data_transferred BIGINT,
          signal_strength INTEGER,
          hotspot_id INTEGER,
          district_id INTEGER,
          user_agent TEXT,
          FOREIGN KEY (device_id) REFERENCES devices (id),
          FOREIGN KEY (district_id) REFERENCES districts (id)
        )`,
        
        // Security events table
        `CREATE TABLE IF NOT EXISTS security_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_type TEXT NOT NULL,
          severity TEXT DEFAULT 'medium',
          device_id INTEGER,
          mac_address TEXT,
          ip_address TEXT,
          description TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          resolved BOOLEAN DEFAULT 0,
          resolved_by TEXT,
          resolved_at DATETIME,
          FOREIGN KEY (device_id) REFERENCES devices (id)
        )`
      ];

      let totalQueries = userQueries.length + adminQueries.length + wifiQueries.length + deviceQueries.length;
      let completed = 0;

      // Create user tables
      userQueries.forEach(query => {
        this.userDb.run(query, (err) => {
          if (err) {
            console.error('Error creating user table:', err);
            reject(err);
          } else {
            completed++;
            if (completed === totalQueries) {
              this.seedInitialData().then(resolve).catch(reject);
            }
          }
        });
      });

      // Create admin tables
      adminQueries.forEach(query => {
        this.adminDb.run(query, (err) => {
          if (err) {
            console.error('Error creating admin table:', err);
            reject(err);
          } else {
            completed++;
            if (completed === totalQueries) {
              this.seedInitialData().then(resolve).catch(reject);
            }
          }
        });
      });

      // Create WiFi tables
      wifiQueries.forEach(query => {
        this.wifiDb.run(query, (err) => {
          if (err) {
            console.error('Error creating WiFi table:', err);
            reject(err);
          } else {
            completed++;
            if (completed === totalQueries) {
              this.seedInitialData().then(resolve).catch(reject);
            }
          }
        });
      });

      // Create device tables
      deviceQueries.forEach(query => {
        this.deviceDb.run(query, (err) => {
          if (err) {
            console.error('Error creating device table:', err);
            reject(err);
          } else {
            completed++;
            if (completed === totalQueries) {
              this.seedInitialData().then(resolve).catch(reject);
            }
          }
        });
      });
    });
  }

  // Seed initial data
  async seedInitialData() {
    return new Promise((resolve, reject) => {
      // Create default admin user in admin database
      const hashedAdminPassword = bcrypt.hashSync('admin123', 10);
      
      this.adminDb.run(
        `INSERT OR IGNORE INTO admins (fullname, email, username, role, password) VALUES (?, ?, ?, ?, ?)`,
        ['System Administrator', 'admin@wifi-monitor.com', 'admin', 'admin', hashedAdminPassword],
        (err) => {
          if (err) {
            console.error('Error creating admin user:', err);
            reject(err);
          } else {
            // Initialize districts in WiFi database
            this.initializeDistricts().then(resolve).catch(reject);
          }
        }
      );
    });
  }

  // Initialize districts
  async initializeDistricts() {
    return new Promise((resolve, reject) => {
      const districts = [
        'North District', 'South District', 'East District', 'West District', 'Central District',
        'Northeast District', 'Northwest District', 'Southeast District', 'Southwest District', 'Metro District'
      ];

      let completed = 0;
      districts.forEach((name, index) => {
        const totalHotspots = Math.floor(Math.random() * 2000) + 500;
        const activeHotspots = Math.floor(Math.random() * 1500) + 300;
        const utilization = Math.floor(Math.random() * 40) + 40;
        const status = Math.random() > 0.7 ? 'critical' : Math.random() > 0.4 ? 'warning' : 'normal';

        this.wifiDb.run(
          `INSERT OR REPLACE INTO districts (id, name, total_hotspots, active_hotspots, utilization, status) VALUES (?, ?, ?, ?, ?, ?)`,
          [index + 1, name, totalHotspots, activeHotspots, utilization, status],
          (err) => {
            if (err) {
              console.error('Error inserting district:', err);
            } else {
              completed++;
              if (completed === districts.length) {
                // Initialize system settings
                this.initializeSettings().then(resolve).catch(reject);
              }
            }
          }
        );
      });
    });
  }

  // Initialize system settings
  async initializeSettings() {
    return new Promise((resolve, reject) => {
      const settings = [
        ['update_interval', '2', 'Data update interval in seconds'],
        ['critical_threshold', '80', 'Critical threshold percentage'],
        ['max_logs', '100', 'Maximum number of activity logs to keep']
      ];

      let completed = 0;
      settings.forEach(([key, value, description]) => {
        this.wifiDb.run(
          `INSERT OR IGNORE INTO system_settings (setting_key, setting_value, description) VALUES (?, ?, ?)`,
          [key, value, description],
          (err) => {
            if (err) {
              console.error('Error inserting setting:', err);
            } else {
              completed++;
              if (completed === settings.length) {
                resolve();
              }
            }
          }
        );
      });
    });
  }

  // User management methods
  async createAdmin(adminData) {
    return new Promise((resolve, reject) => {
      const {
        fullname,
        email,
        username,
        role,
        password,
        userType,
        department,
        govId,
        registrationId,
        status,
        isActive
      } = adminData;
      
      // Hash password
      bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
          reject(err);
          return;
        }
        
        this.adminDb.run(
          `INSERT INTO admins (
            fullname, email, username, role, password, 
            department, gov_id, registration_id, status, 
            is_active, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            fullname,
            email,
            username,
            role,
            hashedPassword,
            department,
            govId,
            registrationId,
            status || 'pending_verification',
            isActive || false,
            new Date().toISOString()
          ],
          function(err) {
            if (err) {
              reject(err);
            } else {
              resolve({ id: this.lastID });
            }
          }
        );
      });
    });
  }

  // Get admin by government ID
  async getAdminByGovId(govId) {
    return new Promise((resolve, reject) => {
      this.adminDb.get(
        'SELECT * FROM admins WHERE gov_id = ?',
        [govId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  async createUser(userData, userType = 'user') {
    return new Promise((resolve, reject) => {
      const hashedPassword = bcrypt.hashSync(userData.password, 10);
      const db = userType === 'admin' ? this.adminDb : this.userDb;
      const tableName = userType === 'admin' ? 'admins' : 'users';
      
      db.run(
        `INSERT INTO ${tableName} (fullname, email, username, role, password) VALUES (?, ?, ?, ?, ?)`,
        [userData.fullname, userData.email, userData.username, userData.role || userType, hashedPassword],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, ...userData });
          }
        }
      );
    });
  }

  async authenticateUser(username, password, userType = 'user') {
    return new Promise((resolve, reject) => {
      const db = userType === 'admin' ? this.adminDb : this.userDb;
      const tableName = userType === 'admin' ? 'admins' : 'users';
      
      // For admin, check both active and pending verification status
      const whereClause = userType === 'admin' 
        ? `WHERE username = ? AND (is_active = 1 OR status = 'pending_verification')`
        : `WHERE username = ? AND is_active = 1`;
      
      db.get(
        `SELECT * FROM ${tableName} ${whereClause}`,
        [username],
        (err, row) => {
          if (err) {
            reject(err);
          } else if (!row) {
            resolve(null);
          } else {
            const isValid = bcrypt.compareSync(password, row.password);
            if (isValid) {
              // Update last login
              db.run(
                `UPDATE ${tableName} SET last_login = CURRENT_TIMESTAMP WHERE id = ?`,
                [row.id]
              );
              resolve(row);
            } else {
              resolve(null);
            }
          }
        }
      );
    });
  }

  async getAllUsers(userType = 'user') {
    return new Promise((resolve, reject) => {
      const db = userType === 'admin' ? this.adminDb : this.userDb;
      const tableName = userType === 'admin' ? 'admins' : 'users';
      
      db.all(
        `SELECT id, fullname, email, username, role, created_at, is_active, last_login FROM ${tableName} ORDER BY created_at DESC`,
        [],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  // Get admin by ID
  async getAdminById(adminId) {
    return new Promise((resolve, reject) => {
      this.adminDb.get(
        'SELECT * FROM admins WHERE id = ?',
        [adminId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  // Get pending admin registrations
  async getPendingAdmins() {
    return new Promise((resolve, reject) => {
      this.adminDb.all(
        'SELECT * FROM admins WHERE status = "pending_verification" ORDER BY created_at DESC',
        [],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  // Update admin (alias for updateUser)
  async updateAdmin(userId, updates) {
    return this.updateUser(userId, updates, 'admin');
  }

  async updateUser(userId, updates, userType = 'user') {
    return new Promise((resolve, reject) => {
      const db = userType === 'admin' ? this.adminDb : this.userDb;
      const tableName = userType === 'admin' ? 'admins' : 'users';
      const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = Object.values(updates);
      
      db.run(
        `UPDATE ${tableName} SET ${fields} WHERE id = ?`,
        [...values, userId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ changes: this.changes });
          }
        }
      );
    });
  }

  async deleteUser(userId, userType = 'user') {
    return new Promise((resolve, reject) => {
      const db = userType === 'admin' ? this.adminDb : this.userDb;
      const tableName = userType === 'admin' ? 'admins' : 'users';
      
      db.run(
        `DELETE FROM ${tableName} WHERE id = ?`,
        [userId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ changes: this.changes });
          }
        }
      );
    });
  }

  // District management methods (use WiFi database)
  async getAllDistricts() {
    return new Promise((resolve, reject) => {
      this.wifiDb.all(
        `SELECT * FROM districts ORDER BY name`,
        [],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  async updateDistrict(districtId, updates) {
    return new Promise((resolve, reject) => {
      const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = Object.values(updates);
      
      this.wifiDb.run(
        `UPDATE districts SET ${fields}, last_ping = CURRENT_TIMESTAMP WHERE id = ?`,
        [...values, districtId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ changes: this.changes });
          }
        }
      );
    });
  }

  // Activity log methods
  async logActivity(userId, username, action, ipAddress = null, userType = 'user') {
    return new Promise((resolve, reject) => {
      const db = userType === 'admin' ? this.adminDb : this.userDb;
      const tableName = userType === 'admin' ? 'admin_activity_logs' : 'user_activity_logs';
      const userIdField = userType === 'admin' ? 'admin_id' : 'user_id';
      
      db.run(
        `INSERT INTO ${tableName} (${userIdField}, username, action, ip_address) VALUES (?, ?, ?, ?)`,
        [userId, username, action, ipAddress],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID });
          }
        }
      );
    });
  }

  async getActivityLogs(limit = 100, userType = 'user') {
    return new Promise((resolve, reject) => {
      const db = userType === 'admin' ? this.adminDb : this.userDb;
      const tableName = userType === 'admin' ? 'admin_activity_logs' : 'user_activity_logs';
      
      db.all(
        `SELECT * FROM ${tableName} ORDER BY timestamp DESC LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  async clearActivityLogs(userType = 'user') {
    return new Promise((resolve, reject) => {
      const db = userType === 'admin' ? this.adminDb : this.userDb;
      const tableName = userType === 'admin' ? 'admin_activity_logs' : 'user_activity_logs';
      
      db.run(
        `DELETE FROM ${tableName}`,
        [],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ changes: this.changes });
          }
        }
      );
    });
  }

  // System settings methods (use WiFi database)
  async getSetting(key) {
    return new Promise((resolve, reject) => {
      this.wifiDb.get(
        `SELECT setting_value FROM system_settings WHERE setting_key = ?`,
        [key],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row ? row.setting_value : null);
          }
        }
      );
    });
  }

  async updateSetting(key, value) {
    return new Promise((resolve, reject) => {
      this.wifiDb.run(
        `INSERT OR REPLACE INTO system_settings (setting_key, setting_value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
        [key, value],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ changes: this.changes });
          }
        }
      );
    });
  }

  // Wi-Fi metrics methods (use WiFi database)
  async saveMetrics(metrics) {
    return new Promise((resolve, reject) => {
      this.wifiDb.run(
        `INSERT INTO wifi_metrics (total_hotspots, active_hotspots, utilization, critical_districts) VALUES (?, ?, ?, ?)`,
        [metrics.totalHotspots, metrics.activeHotspots, metrics.utilization, metrics.criticalDistricts],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID });
          }
        }
      );
    });
  }

  async getMetricsHistory(limit = 100) {
    return new Promise((resolve, reject) => {
      this.wifiDb.all(
        `SELECT * FROM wifi_metrics ORDER BY timestamp DESC LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  // Close database connections
  close() {
    if (this.userDb) {
      this.userDb.close((err) => {
        if (err) {
          console.error('Error closing user database:', err);
        } else {
          console.log('User database connection closed');
        }
      });
    }
    if (this.adminDb) {
      this.adminDb.close((err) => {
        if (err) {
          console.error('Error closing admin database:', err);
        } else {
          console.log('Admin database connection closed');
        }
      });
    }
    if (this.wifiDb) {
      this.wifiDb.close((err) => {
        if (err) {
          console.error('Error closing WiFi database:', err);
        } else {
          console.log('WiFi database connection closed');
        }
      });
    }
    if (this.deviceDb) {
      this.deviceDb.close((err) => {
        if (err) {
          console.error('Error closing devices database:', err);
        } else {
          console.log('Devices database connection closed');
        }
      });
    }
  }

  // Device management methods
  async registerDevice(deviceData) {
    return new Promise((resolve, reject) => {
      const { mac_address, ip_address, device_name, device_type, vendor, os_type, district_id, hotspot_id } = deviceData;
      
      // Check if device already exists
      this.deviceDb.get(
        `SELECT id FROM devices WHERE mac_address = ?`,
        [mac_address],
        (err, row) => {
          if (err) {
            reject(err);
          } else if (row) {
            // Update existing device
            this.deviceDb.run(
              `UPDATE devices SET ip_address = ?, last_seen = CURRENT_TIMESTAMP, connection_count = connection_count + 1 WHERE id = ?`,
              [ip_address, row.id],
              function(err) {
                if (err) {
                  reject(err);
                } else {
                  resolve({ id: row.id, updated: true });
                }
              }
            );
          } else {
            // Insert new device
            this.deviceDb.run(
              `INSERT INTO devices (mac_address, ip_address, device_name, device_type, vendor, os_type, district_id, hotspot_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [mac_address, ip_address, device_name, device_type, vendor, os_type, district_id, hotspot_id],
              function(err) {
                if (err) {
                  reject(err);
                } else {
                  resolve({ id: this.lastID, updated: false });
                }
              }
            );
          }
        }
      );
    });
  }

  async logDeviceConnection(deviceId, action, logData) {
    return new Promise((resolve, reject) => {
      const { ip_address, duration, data_transferred, signal_strength, hotspot_id, district_id, user_agent } = logData;
      
      this.deviceDb.run(
        `INSERT INTO device_logs (device_id, mac_address, ip_address, action, duration, data_transferred, signal_strength, hotspot_id, district_id, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [deviceId, logData.mac_address, ip_address, action, duration, data_transferred, signal_strength, hotspot_id, district_id, user_agent],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID });
          }
        }
      );
    });
  }

  async getDevices(limit = 100, filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `SELECT d.*, dis.name as district_name FROM devices d LEFT JOIN districts dis ON d.district_id = dis.id`;
      const params = [];
      
      if (filters.district_id) {
        query += ` WHERE d.district_id = ?`;
        params.push(filters.district_id);
      }
      
      if (filters.status) {
        query += params.length > 0 ? ` AND d.status = ?` : ` WHERE d.status = ?`;
        params.push(filters.status);
      }
      
      query += ` ORDER BY d.last_seen DESC LIMIT ?`;
      params.push(limit);
      
      this.deviceDb.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getDeviceLogs(deviceId = null, limit = 100) {
    return new Promise((resolve, reject) => {
      let query = `SELECT dl.*, d.device_name, d.mac_address, dis.name as district_name FROM device_logs dl LEFT JOIN devices d ON dl.device_id = d.id LEFT JOIN districts dis ON dl.district_id = dis.id`;
      const params = [];
      
      if (deviceId) {
        query += ` WHERE dl.device_id = ?`;
        params.push(deviceId);
      }
      
      query += ` ORDER BY dl.timestamp DESC LIMIT ?`;
      params.push(limit);
      
      this.deviceDb.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async createSecurityEvent(eventData) {
    return new Promise((resolve, reject) => {
      const { event_type, severity, device_id, mac_address, ip_address, description } = eventData;
      
      this.deviceDb.run(
        `INSERT INTO security_events (event_type, severity, device_id, mac_address, ip_address, description) VALUES (?, ?, ?, ?, ?, ?)`,
        [event_type, severity, device_id, mac_address, ip_address, description],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID });
          }
        }
      );
    });
  }

  async getSecurityEvents(limit = 100, unresolved_only = false) {
    return new Promise((resolve, reject) => {
      let query = `SELECT se.*, d.device_name, d.mac_address FROM security_events se LEFT JOIN devices d ON se.device_id = d.id`;
      const params = [];
      
      if (unresolved_only) {
        query += ` WHERE se.resolved = 0`;
      }
      
      query += ` ORDER BY se.timestamp DESC LIMIT ?`;
      params.push(limit);
      
      this.deviceDb.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async resolveSecurityEvent(eventId, resolvedBy) {
    return new Promise((resolve, reject) => {
      this.deviceDb.run(
        `UPDATE security_events SET resolved = 1, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [resolvedBy, eventId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ changes: this.changes });
          }
        }
      );
    });
  }
}

module.exports = new Database();
