// Real-time WiFi monitoring system
let map;
let connectionChart;
let ws;
let hotspots = [];
let connectionData = [];

// Initialize the real-time monitor
document.addEventListener('DOMContentLoaded', function() {
  initializeMap();
  initializeChart();
  connectWebSocket();
  updateHotspotList(); // Initialize the hotspot list
  startRealTimeUpdates();
});

// Initialize Leaflet map
function initializeMap() {
  map = L.map('hotspotMap').setView([40.7128, -74.0060], 12); // Default to New York
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  // Add sample hotspot locations
  addSampleHotspots();
}

// Add sample hotspot data
function addSampleHotspots() {
  const sampleHotspots = [
    {
      id: 1,
      name: "Times Square Hotspot",
      lat: 40.7580,
      lng: -73.9855,
      status: "online",
      connections: 45,
      utilization: 78,
      address: "Times Square, NYC"
    },
    {
      id: 2,
      name: "Central Park WiFi",
      lat: 40.7829,
      lng: -73.9654,
      status: "online",
      connections: 32,
      utilization: 65,
      address: "Central Park, NYC"
    },
    {
      id: 3,
      name: "Brooklyn Bridge Hotspot",
      lat: 40.7061,
      lng: -73.9969,
      status: "warning",
      connections: 89,
      utilization: 92,
      address: "Brooklyn Bridge, NYC"
    },
    {
      id: 4,
      name: "Wall Street Zone",
      lat: 40.7074,
      lng: -74.0113,
      status: "offline",
      connections: 0,
      utilization: 0,
      address: "Wall Street, NYC"
    },
    {
      id: 5,
      name: "Union Square Hub",
      lat: 40.7359,
      lng: -73.9911,
      status: "online",
      connections: 67,
      utilization: 84,
      address: "Union Square, NYC"
    }
  ];

  hotspots = sampleHotspots;
  updateHotspotMarkers();
  updateStats();
}

// Update hotspot markers on map
function updateHotspotMarkers() {
  // Clear existing markers
  map.eachLayer(function(layer) {
    if (layer instanceof L.Marker) {
      map.removeLayer(layer);
    }
  });

  // Add markers for each hotspot
  hotspots.forEach(hotspot => {
    const color = getStatusColor(hotspot.status);
    const icon = L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="
        background-color: ${color};
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: white;
        font-size: 12px;
      ">${hotspot.connections}</div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const marker = L.marker([hotspot.lat, hotspot.lng], { icon })
      .addTo(map)
      .bindPopup(`
        <div style="min-width: 200px;">
          <h4>${hotspot.name}</h4>
          <p><strong>Status:</strong> ${hotspot.status}</p>
          <p><strong>Connections:</strong> ${hotspot.connections}</p>
          <p><strong>Utilization:</strong> ${hotspot.utilization}%</p>
          <p><strong>Address:</strong> ${hotspot.address}</p>
        </div>
      `);
  });
}

// Get status color
function getStatusColor(status) {
  switch (status) {
    case 'online': return '#28a745';
    case 'offline': return '#dc3545';
    case 'warning': return '#ffc107';
    default: return '#6c757d';
  }
}

// Initialize connection chart
function initializeChart() {
  const ctx = document.getElementById('connectionChart').getContext('2d');
  
  connectionChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Active Connections',
        data: [],
        borderColor: '#28a745',
        backgroundColor: 'rgba(40, 167, 69, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: 'Time'
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Connections'
          }
        }
      }
    }
  });
}

// Connect to WebSocket for real-time updates
function connectWebSocket() {
  ws = new WebSocket('ws://localhost:3000');
  
  ws.onopen = function(event) {
    console.log('Real-time monitor connected to backend');
    document.querySelector('.realtime-indicator').style.background = '#28a745';
  };

  ws.onmessage = function(event) {
    const message = JSON.parse(event.data);
    
    if (message.type === 'data_update') {
      // Handle data_update from server
      if (message.data.hotspots) {
        hotspots = message.data.hotspots;
        updateHotspotMarkers();
        updateStats();
      } else if (message.data.districts) {
        // Update with district data
        updateWithDistrictData(message.data);
      }
      updateStats();
    } else if (message.type === 'initial_data') {
      initializeWithData(message.data);
    }
  };

  ws.onclose = function(event) {
    console.log('Real-time monitor disconnected');
    document.querySelector('.realtime-indicator').style.background = '#dc3545';
    
    // Try to reconnect after 3 seconds
    setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = function(error) {
    console.error('WebSocket error:', error);
    document.querySelector('.realtime-indicator').style.background = '#dc3545';
  };
}

// Initialize with existing data
function initializeWithData(data) {
  if (data.hotspots) {
    hotspots = data.hotspots;
    updateHotspotMarkers();
  }
  updateStats();
}

// Update hotspot data
function updateHotspotData(newData) {
  const index = hotspots.findIndex(h => h.id === newData.id);
  if (index !== -1) {
    hotspots[index] = { ...hotspots[index], ...newData };
    updateHotspotMarkers();
    updateStats();
  }
}

// Update connection data
function updateConnectionData(newData) {
  connectionData.push(newData);
  
  // Keep only last 20 data points
  if (connectionData.length > 20) {
    connectionData = connectionData.slice(-20);
  }
  
  updateChart();
}

// Update chart with new data
function updateChart() {
  if (!connectionChart) return;
  
  const now = new Date();
  const timeLabels = connectionData.map((_, index) => {
    const time = new Date(now - (19 - index) * 60000); // Go back in 1-minute intervals
    return time.toLocaleTimeString();
  });
  
  const connectionCounts = connectionData.map(data => data.connections || 0);
  
  connectionChart.data.labels = timeLabels;
  connectionChart.data.datasets[0].data = connectionCounts;
  connectionChart.update('none');
}

// Update with district data
function updateWithDistrictData(data) {
  // Convert district data to hotspot format for display
  hotspots = data.districts.map((district, index) => ({
    id: index + 1,
    name: `${district.name} District Hub`,
    lat: district.latitude || 40.7128 + (index * 0.1),
    lng: district.longitude || -74.0060 + (index * 0.1),
    status: district.status === 'critical' ? 'warning' : district.status === 'normal' ? 'online' : 'offline',
    connections: district.active_hotspots || 0,
    utilization: district.utilization || 0,
    address: `${district.name}, District ${district.id}`
  }));
  
  updateHotspotMarkers();
  updateHotspotList();
}

// Update statistics
function updateStats() {
  const totalHotspots = hotspots.length;
  const activeHotspots = hotspots.filter(h => h.status === 'online').length;
  const totalConnections = hotspots.reduce((sum, h) => sum + (h.connections || 0), 0);
  const avgUtilization = totalHotspots > 0 
    ? Math.round(hotspots.reduce((sum, h) => sum + (h.utilization || 0), 0) / totalHotspots)
    : 0;

  document.getElementById('totalHotspots').textContent = totalHotspots;
  document.getElementById('activeHotspots').textContent = activeHotspots;
  document.getElementById('totalConnections').textContent = totalConnections;
  document.getElementById('avgUtilization').textContent = avgUtilization + '%';
  document.getElementById('connectionCount').textContent = totalConnections;
}

// Update hotspot list
function updateHotspotList() {
  const hotspotList = document.getElementById('hotspotList');
  
  if (hotspots.length === 0) {
    hotspotList.innerHTML = '<p>No hotspots available</p>';
    return;
  }
  
  hotspotList.innerHTML = hotspots.map(hotspot => `
    <div class="hotspot-item">
      <div>
        <strong>${hotspot.name}</strong>
        <span class="hotspot-status status-${hotspot.status}">${hotspot.status.toUpperCase()}</span>
      </div>
      <div>
        <span>Connections: ${hotspot.connections}</span> | 
        <span>Utilization: ${hotspot.utilization}%</span>
      </div>
    </div>
  `).join('');
}

// Start real-time updates
function startRealTimeUpdates() {
  // Simulate connection data updates for the chart
  setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Request updates from server
      ws.send(JSON.stringify({ type: 'request_update' }));
    }
    
    // Update connection chart with simulated data
    const totalConnections = hotspots.reduce((sum, h) => sum + (h.connections || 0), 0);
    updateConnectionData({ connections: totalConnections, timestamp: new Date().toISOString() });
  }, 5000); // Every 5 seconds
}

// Handle window resize
window.addEventListener('resize', function() {
  if (map) {
    map.invalidateSize();
  }
});

// Add smooth animations
function animateValue(element, newValue, oldValue) {
  if (newValue !== oldValue) {
    element.style.transition = 'all 0.3s ease';
    element.style.transform = 'scale(1.1)';
    
    setTimeout(() => {
      element.textContent = newValue;
      element.style.transform = 'scale(1)';
    }, 150);
    
    setTimeout(() => {
      element.style.transition = '';
    }, 300);
  }
}
