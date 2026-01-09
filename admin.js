// WebSocket connection for real-time data
const ws = new WebSocket('ws://localhost:3000');

// Global variables
let currentSection = 'dashboard';
let activityLogs = [];

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  loadUserData();
  updateAdminName();
  loadActivityLogs();
  loadLoginActivities();
  loadPendingAdmins();
  setupWebSocket();
});

// Setup WebSocket connection
function setupWebSocket() {
  ws.onopen = function(event) {
    console.log('Admin connected to backend server');
  };

  ws.onmessage = function(event) {
    const message = JSON.parse(event.data);
    
    if (message.type === 'initial_data' || message.type === 'data_update') {
      updateDashboardMetrics(message.data);
    }
  };

  ws.onclose = function(event) {
    console.log('Admin disconnected from backend server');
    setTimeout(() => location.reload(), 3000);
  };
}

// Update admin name in header
function updateAdminName() {
  const fullname = localStorage.getItem('fullname') || 'Admin';
  document.getElementById('adminName').textContent = fullname;
}

// Show different sections
function showSection(sectionId, buttonElement) {
  // Hide all sections
  document.querySelectorAll('.admin-section').forEach(section => {
    section.classList.remove('active');
  });
  
  // Remove active class from all nav buttons
  document.querySelectorAll('.admin-nav button').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Show selected section
  document.getElementById(sectionId).classList.add('active');
  
  // Add active class to clicked button
  if (buttonElement) {
    buttonElement.classList.add('active');
  }
  
  currentSection = sectionId;
  
  // Log activity
  logActivity(`Accessed ${sectionId} section`);
}

// Update dashboard metrics
function updateDashboardMetrics(data) {
  document.getElementById('total').innerText = data.totalHotspots;
  document.getElementById('active').innerText = data.activeHotspots;
  document.getElementById('utilization').innerText = data.utilization + '%';
  document.getElementById('critical').innerText = data.criticalDistricts;
}

// Load user data from database
async function loadUserData() {
  try {
    const response = await fetch('/api/users');
    if (response.ok) {
      const users = await response.json();
      
      // Update user statistics
      const totalUsers = users.length;
      const activeUsers = users.filter(u => u.is_active).length;
      const adminUsers = users.filter(u => u.role === 'admin').length;
      const regularUsers = users.filter(u => u.role === 'user').length;
      
      document.getElementById('totalUsers').innerText = totalUsers;
      document.getElementById('activeUsers').innerText = activeUsers;
      document.getElementById('adminUsers').innerText = adminUsers;
      document.getElementById('regularUsers').innerText = regularUsers;
      
      // Populate user table
      populateUserTable(users);
    }
  } catch (error) {
    console.error('Error loading user data:', error);
  }
}

// Populate user table
function populateUserTable(users) {
  const tbody = document.getElementById('userTableBody');
  tbody.innerHTML = '';
  
  users.forEach(user => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${user.id}</td>
      <td>${user.fullname}</td>
      <td>${user.username}</td>
      <td>${user.email}</td>
      <td><span class="role-badge role-${user.role}">${user.role.toUpperCase()}</span></td>
      <td><span class="status-badge status-${user.is_active ? 'active' : 'inactive'}">${user.is_active ? 'Active' : 'Inactive'}</span></td>
      <td>${new Date(user.created_at).toLocaleDateString()}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-small btn-edit" onclick="editUser(${user.id})">Edit</button>
          <button class="btn-small btn-toggle" onclick="toggleUserStatus(${user.id})">${user.is_active ? 'Disable' : 'Enable'}</button>
          <button class="btn-small btn-delete" onclick="deleteUser(${user.id})">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Add new user
async function addNewUser() {
  const fullname = prompt('Enter full name:');
  if (!fullname) return;
  
  const username = prompt('Enter username:');
  if (!username) return;
  
  const email = prompt('Enter email:');
  if (!email) return;
  
  const role = prompt('Enter role (user/admin/viewer):');
  if (!role || !['user', 'admin', 'viewer'].includes(role)) {
    alert('Invalid role. Must be user, admin, or viewer.');
    return;
  }
  
  const password = prompt('Enter password (min 8 characters):');
  if (!password || password.length < 8) {
    alert('Password must be at least 8 characters long.');
    return;
  }
  
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fullname: fullname,
        email: email,
        username: username,
        role: role,
        password: password
      })
    });

    const data = await response.json();

    if (response.ok) {
      logActivity(`Created new user: ${username} (${role})`);
      loadUserData();
      alert('User created successfully!');
    } else {
      alert('Failed to create user: ' + (data.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error creating user:', error);
    alert('Network error. Please try again.');
  }
}

// Edit user
async function editUser(userId) {
  const newRole = prompt('Enter new role (user/admin/viewer):');
  if (!newRole || !['user', 'admin', 'viewer'].includes(newRole)) {
    alert('Invalid role. Must be user, admin, or viewer.');
    return;
  }
  
  try {
    const response = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: newRole
      })
    });

    const data = await response.json();

    if (response.ok) {
      logActivity(`Updated user role to ${newRole} for user ID: ${userId}`);
      loadUserData();
      alert('User updated successfully!');
    } else {
      alert('Failed to update user: ' + (data.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error updating user:', error);
    alert('Network error. Please try again.');
  }
}

// Toggle user status
async function toggleUserStatus(userId) {
  try {
    // First get current user data to determine new status
    const usersResponse = await fetch('/api/users');
    const users = await usersResponse.json();
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      alert('User not found.');
      return;
    }

    const newStatus = !user.is_active;
    
    const response = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        is_active: newStatus
      })
    });

    const data = await response.json();

    if (response.ok) {
      logActivity(`${newStatus ? 'Enabled' : 'Disabled'} user ID: ${userId}`);
      loadUserData();
      alert(`User ${newStatus ? 'enabled' : 'disabled'} successfully!`);
    } else {
      alert('Failed to update user status: ' + (data.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error toggling user status:', error);
    alert('Network error. Please try again.');
  }
}

// Delete user
async function deleteUser(userId) {
  if (!confirm('Are you sure you want to delete this user?')) return;
  
  try {
    const response = await fetch(`/api/users/${userId}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (response.ok) {
      logActivity(`Deleted user ID: ${userId}`);
      loadUserData();
      alert('User deleted successfully!');
    } else {
      alert('Failed to delete user: ' + (data.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    alert('Network error. Please try again.');
  }
}

// Update data update interval
async function updateInterval() {
  const interval = document.getElementById('updateInterval').value;
  
  try {
    const response = await fetch('/api/settings/update_interval', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        value: interval
      })
    });

    const data = await response.json();

    if (response.ok) {
      logActivity(`Updated data refresh interval to ${interval} seconds`);
      alert(`Data update interval set to ${interval} seconds`);
    } else {
      alert('Failed to update interval: ' + (data.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error updating interval:', error);
    alert('Network error. Please try again.');
  }
}

// Update critical threshold
async function updateThreshold() {
  const threshold = document.getElementById('criticalThreshold').value;
  
  try {
    const response = await fetch('/api/settings/critical_threshold', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        value: threshold
      })
    });

    const data = await response.json();

    if (response.ok) {
      logActivity(`Updated critical threshold to ${threshold}%`);
      alert(`Critical threshold set to ${threshold}%`);
    } else {
      alert('Failed to update threshold: ' + (data.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error updating threshold:', error);
    alert('Network error. Please try again.');
  }
}

// Export user data
async function exportData() {
  try {
    const response = await fetch('/api/users');
    if (response.ok) {
      const users = await response.json();
      const dataStr = JSON.stringify(users, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `users_export_${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      logActivity('Exported user data');
    }
  } catch (error) {
    console.error('Error exporting data:', error);
    alert('Failed to export data');
  }
}

// Clear activity logs
async function clearLogs() {
  if (!confirm('Are you sure you want to clear all activity logs?')) return;
  
  try {
    const response = await fetch('/api/logs', {
      method: 'DELETE'
    });

    const data = await response.json();

    if (response.ok) {
      activityLogs = [];
      loadActivityLogs();
      logActivity('Cleared activity logs');
      alert('Activity logs cleared successfully!');
    } else {
      alert('Failed to clear logs: ' + (data.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error clearing logs:', error);
    alert('Network error. Please try again.');
  }
}

// Log activity (client-side for immediate feedback)
function logActivity(action) {
  const log = {
    timestamp: new Date().toISOString(),
    user: localStorage.getItem('username') || 'admin',
    action: action
  };
  
  activityLogs.unshift(log);
  
  // Keep only last 100 logs
  if (activityLogs.length > 100) {
    activityLogs = activityLogs.slice(0, 100);
  }
  
  loadActivityLogs();
}

// Load activity logs from database
async function loadActivityLogs() {
  try {
    const response = await fetch('/api/logs?limit=100');
    if (response.ok) {
      activityLogs = await response.json();
      displayActivityLogs();
    }
  } catch (error) {
    console.error('Error loading activity logs:', error);
    displayActivityLogs(); // Display client-side logs if database fails
  }
}

// Display activity logs
function displayActivityLogs() {
  const logsContent = document.getElementById('logsContent');
  
  if (activityLogs.length === 0) {
    logsContent.innerHTML = '<p>No activity logs found.</p>';
    return;
  }
  
  logsContent.innerHTML = activityLogs.map(log => `
    <div style="padding: 8px; border-bottom: 1px solid #eee; margin-bottom: 5px;">
      <strong>${new Date(log.timestamp).toLocaleString()}</strong> - 
      <em>${log.user || log.username}</em>: ${log.action}
    </div>
  `).join('');
}

// Logout
function logout() {
  logActivity('Logged out from admin panel');
  localStorage.removeItem("login");
  localStorage.removeItem("userRole");
  localStorage.removeItem("username");
  localStorage.removeItem("fullname");
  localStorage.removeItem("userId");
  localStorage.removeItem("email");
  window.location.href = "login.html";
}

// Load login activities from backend
async function loadLoginActivities() {
  try {
    const response = await fetch('/api/login-activities');
    if (response.ok) {
      const activities = await response.json();
      displayLoginActivities(activities);
    } else {
      // Fallback to localStorage if backend fails
      const localActivities = JSON.parse(localStorage.getItem('loginActivities') || '[]');
      displayLoginActivities(localActivities);
    }
  } catch (error) {
    console.error('Error loading login activities:', error);
    // Fallback to localStorage
    const localActivities = JSON.parse(localStorage.getItem('loginActivities') || '[]');
    displayLoginActivities(localActivities);
  }
}

// Display login activities
function displayLoginActivities(activities) {
  const content = document.getElementById('loginActivitiesContent');
  
  if (activities.length === 0) {
    content.innerHTML = '<p>No login activities recorded.</p>';
    return;
  }
  
  content.innerHTML = activities.map(activity => {
    const typeClass = activity.type === 'login_success' ? 'success' : 
                      activity.type === 'login_failed' ? 'danger' : 'warning';
    const typeIcon = activity.type === 'login_success' ? '✓' : 
                     activity.type === 'login_failed' ? '✗' : '⚠';
    
    return `
      <div style="padding: 12px; border-bottom: 1px solid #eee; margin-bottom: 5px; border-left: 4px solid ${typeClass === 'success' ? '#28a745' : typeClass === 'danger' ? '#dc3545' : '#ffc107'};">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>${typeIcon} ${activity.user || 'Unknown User'}</strong>
            <div style="color: #666; font-size: 14px; margin-top: 4px;">${activity.action}</div>
          </div>
          <div style="text-align: right; color: #666; font-size: 12px;">
            ${new Date(activity.timestamp).toLocaleString()}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Refresh login activities
function refreshLoginActivities() {
  loadLoginActivities();
  logActivity('Refreshed login activities');
}

// Clear login activities
function clearLoginActivities() {
  if (!confirm('Are you sure you want to clear all login activities?')) return;
  
  localStorage.removeItem('loginActivities');
  loadLoginActivities();
  logActivity('Cleared login activities');
}

// Load pending admin registrations
async function loadPendingAdmins() {
  try {
    const response = await fetch('/api/admin/pending');
    if (response.ok) {
      const pendingAdmins = await response.json();
      displayPendingAdmins(pendingAdmins);
    } else {
      console.error('Failed to load pending admins');
      document.getElementById('pendingAdminsContent').innerHTML = '<p>Failed to load pending admin registrations.</p>';
    }
  } catch (error) {
    console.error('Error loading pending admins:', error);
    document.getElementById('pendingAdminsContent').innerHTML = '<p>Error loading pending admin registrations.</p>';
  }
}

// Display pending admin registrations
function displayPendingAdmins(pendingAdmins) {
  const content = document.getElementById('pendingAdminsContent');
  
  if (pendingAdmins.length === 0) {
    content.innerHTML = '<p>No pending admin registrations.</p>';
    return;
  }
  
  content.innerHTML = pendingAdmins.map(admin => `
    <div style="padding: 15px; border: 1px solid #ddd; margin-bottom: 10px; border-radius: 5px; background: white;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <div>
          <strong>${admin.fullname}</strong><br>
          <small style="color: #666;">${admin.email}</small>
        </div>
        <div style="text-align: right;">
          <span style="background: #ffc107; color: #856404; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
            PENDING
          </span>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 14px;">
        <div><strong>Username:</strong> ${admin.username}</div>
        <div><strong>Department:</strong> ${admin.department || 'N/A'}</div>
        <div><strong>Government ID:</strong> ${admin.gov_id || 'N/A'}</div>
        <div><strong>Registration ID:</strong> ${admin.registration_id || 'N/A'}</div>
        <div><strong>Registered:</strong> ${new Date(admin.created_at).toLocaleDateString()}</div>
        <div><strong>Status:</strong> ${admin.status || 'pending_verification'}</div>
      </div>
      
      <div style="margin-top: 15px; text-align: right;">
        <button onclick="approveAdmin(${admin.id}, '${admin.fullname}')" style="padding: 8px 15px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Approve Admin
        </button>
        <button onclick="rejectAdmin(${admin.id}, '${admin.fullname}')" style="margin-left: 10px; padding: 8px 15px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Reject
        </button>
      </div>
    </div>
  `).join('');
}

// Refresh pending admins
function refreshPendingAdmins() {
  loadPendingAdmins();
  logActivity('Refreshed pending admin registrations');
}

// Approve admin
async function approveAdmin(adminId, adminName) {
  if (!confirm(`Are you sure you want to approve ${adminName} as an administrator?`)) return;
  
  try {
    const response = await fetch(`/api/admin/approve/${adminId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      alert(`${adminName} has been approved as an administrator!`);
      loadPendingAdmins();
      logActivity(`Approved admin registration: ${adminName}`);
    } else {
      alert('Failed to approve admin: ' + (data.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error approving admin:', error);
    alert('Network error. Please try again.');
  }
}

// Reject admin
async function rejectAdmin(adminId, adminName) {
  const reason = prompt(`Enter reason for rejecting ${adminName}:`);
  if (!reason) return;
  
  if (!confirm(`Are you sure you want to reject ${adminName}?`)) return;
  
  try {
    const response = await fetch(`/api/admin/reject/${adminId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: reason })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      alert(`${adminName} has been rejected.`);
      loadPendingAdmins();
      logActivity(`Rejected admin registration: ${adminName} - ${reason}`);
    } else {
      alert('Failed to reject admin: ' + (data.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error rejecting admin:', error);
    alert('Network error. Please try again.');
  }
}
