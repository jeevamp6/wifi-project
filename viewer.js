// WebSocket connection for real-time data
const ws = new WebSocket('ws://localhost:3000');

// Connection status
let connectionStatus = 'connecting';
let lastUpdateTime = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  updateViewerName();
  setupWebSocket();
});

// Update viewer name
function updateViewerName() {
  const fullname = localStorage.getItem('fullname') || 'Viewer';
  document.getElementById('viewerName').textContent = fullname;
}

// Setup WebSocket connection
function setupWebSocket() {
  ws.onopen = function(event) {
    console.log('Viewer connected to backend server');
    connectionStatus = 'connected';
    updateConnectionStatus();
  };

  ws.onmessage = function(event) {
    const message = JSON.parse(event.data);
    
    if (message.type === 'initial_data' || message.type === 'data_update') {
      updateDashboard(message.data);
      lastUpdateTime = new Date();
      updateConnectionStatus();
    }
  };

  ws.onclose = function(event) {
    console.log('Viewer disconnected from backend server');
    connectionStatus = 'disconnected';
    updateConnectionStatus();
    
    // Attempt to reconnect after 3 seconds
    setTimeout(() => {
      console.log('Attempting to reconnect...');
      location.reload();
    }, 3000);
  };

  ws.onerror = function(error) {
    console.error('WebSocket error:', error);
    connectionStatus = 'error';
    updateConnectionStatus();
  };
}

// Update dashboard with real-time data
function updateDashboard(data) {
  // Update main metrics with smooth transitions
  animateValue('total', parseInt(document.getElementById('total').innerText), data.totalHotspots, 500);
  animateValue('active', parseInt(document.getElementById('active').innerText), data.activeHotspots, 500);
  animateValue('utilization', parseInt(document.getElementById('utilization').innerText), data.utilization, 500, '%');
  animateValue('critical', parseInt(document.getElementById('critical').innerText), data.criticalDistricts, 500);
  
  // Update message based on critical districts
  updateCriticalMessage(data.criticalDistricts);
  
  // Update last updated time
  document.getElementById('lastUpdated').textContent = new Date().toLocaleString();
}

// Smooth number animation
function animateValue(id, start, end, duration, suffix = '') {
  const element = document.getElementById(id);
  const range = end - start;
  const increment = range / (duration / 16);
  let current = start;
  
  const timer = setInterval(() => {
    current += increment;
    if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
      element.innerText = Math.round(end) + suffix;
      clearInterval(timer);
    } else {
      element.innerText = Math.round(current) + suffix;
    }
  }, 16);
}

// Update critical message based on data
function updateCriticalMessage(criticalCount) {
  const messageElement = document.querySelector('.message p');
  if (criticalCount > 100) {
    messageElement.textContent = `⚠ Critical: ${criticalCount} districts are below the required Wi-Fi penetration target.`;
    document.querySelector('.message').style.background = '#f8d7da';
    document.querySelector('.message').style.borderLeftColor = '#dc3545';
  } else if (criticalCount > 50) {
    messageElement.textContent = `⚠ Warning: ${criticalCount} districts are below the required Wi-Fi penetration target.`;
    document.querySelector('.message').style.background = '#fff3cd';
    document.querySelector('.message').style.borderLeftColor = '#ff9800';
  } else {
    messageElement.textContent = `✅ Good: Only ${criticalCount} districts are below the required Wi-Fi penetration target.`;
    document.querySelector('.message').style.background = '#d4edda';
    document.querySelector('.message').style.borderLeftColor = '#28a745';
  }
}

// Update connection status
function updateConnectionStatus() {
  const statusElement = document.getElementById('connectionStatus');
  
  switch(connectionStatus) {
    case 'connected':
      statusElement.textContent = '🟢 Connected';
      statusElement.style.color = '#28a745';
      break;
    case 'connecting':
      statusElement.textContent = '🟡 Connecting...';
      statusElement.style.color = '#ffc107';
      break;
    case 'disconnected':
      statusElement.textContent = '🔴 Disconnected';
      statusElement.style.color = '#dc3545';
      break;
    case 'error':
      statusElement.textContent = '🔴 Connection Error';
      statusElement.style.color = '#dc3545';
      break;
  }
}

// Fallback: Load initial data via REST API if WebSocket fails
function loadInitialData() {
  fetch('/api/metrics')
    .then(response => response.json())
    .then(data => {
      document.getElementById('total').innerText = data.totalHotspots;
      document.getElementById('active').innerText = data.activeHotspots;
      document.getElementById('utilization').innerText = data.utilization + '%';
      document.getElementById('critical').innerText = data.criticalDistricts;
      updateCriticalMessage(data.criticalDistricts);
      document.getElementById('lastUpdated').textContent = new Date().toLocaleString();
    })
    .catch(error => {
      console.error('Error loading initial data:', error);
    });
}

// Initialize fallback after 5 seconds if still connecting
setTimeout(() => {
  if (connectionStatus === 'connecting') {
    console.log('WebSocket connection taking too long, loading fallback data');
    loadInitialData();
  }
}, 5000);

// Logout
function logout() {
  localStorage.removeItem("login");
  localStorage.removeItem("userRole");
  localStorage.removeItem("username");
  localStorage.removeItem("fullname");
  localStorage.removeItem("userId");
  window.location.href = "login.html";
}
