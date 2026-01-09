let currentPage = 1;
let devicesPerPage = 20;
let allDevices = [];
let filteredDevices = [];
let districts = [];

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
  loadDevices();
  loadSecurityEvents();
  loadDistricts();
  setInterval(loadDevices, 30000); // Refresh every 30 seconds
  setInterval(loadSecurityEvents, 60000); // Refresh security events every minute
});

async function loadDevices() {
  try {
    const response = await fetch('/api/devices');
    const devices = await response.json();
    allDevices = devices;
    filteredDevices = devices;
    updateDeviceStats();
    displayDevices();
  } catch (error) {
    console.error('Error loading devices:', error);
  }
}

async function loadSecurityEvents() {
  try {
    const response = await fetch('/api/security-events?limit=10');
    const events = await response.json();
    displaySecurityEvents(events);
    updateSecurityStats(events);
  } catch (error) {
    console.error('Error loading security events:', error);
  }
}

async function loadDistricts() {
  try {
    const response = await fetch('/api/wifi-data');
    const data = await response.json();
    districts = data.districts || [];
    populateDistrictFilter();
  } catch (error) {
    console.error('Error loading districts:', error);
  }
}

function populateDistrictFilter() {
  const districtFilter = document.getElementById('districtFilter');
  districts.forEach(district => {
    const option = document.createElement('option');
    option.value = district.id;
    option.textContent = district.name;
    districtFilter.appendChild(option);
  });
}

function updateDeviceStats() {
  const totalDevices = allDevices.length;
  const activeDevices = allDevices.filter(d => d.status === 'active').length;
  const totalDataUsage = allDevices.reduce((sum, d) => sum + (d.data_usage || 0), 0);
  
  document.getElementById('totalDevices').textContent = totalDevices;
  document.getElementById('activeDevices').textContent = activeDevices;
  document.getElementById('dataUsage').textContent = formatBytes(totalDataUsage);
}

function updateSecurityStats(events) {
  const unresolvedEvents = events.filter(e => !e.resolved).length;
  document.getElementById('securityEvents').textContent = unresolvedEvents;
}

function displayDevices() {
  const tbody = document.getElementById('deviceTableBody');
  tbody.innerHTML = '';
  
  const startIndex = (currentPage - 1) * devicesPerPage;
  const endIndex = startIndex + devicesPerPage;
  const pageDevices = filteredDevices.slice(startIndex, endIndex);
  
  pageDevices.forEach(device => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${device.device_name || 'Unknown'}</td>
      <td>${device.mac_address}</td>
      <td>${device.ip_address || 'N/A'}</td>
      <td><span class="device-type-badge">${device.device_type || 'Unknown'}</span></td>
      <td>${device.district_name || 'Unknown'}</td>
      <td><span class="status-badge status-${device.status}">${device.status}</span></td>
      <td>${formatDateTime(device.last_seen)}</td>
      <td>${device.connection_count || 0}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="viewDeviceDetails(${device.id})">View</button>
        <button class="btn btn-sm btn-secondary" onclick="viewDeviceLogs(${device.id})">Logs</button>
      </td>
    `;
    tbody.appendChild(row);
  });
  
  updatePagination();
}

function displaySecurityEvents(events) {
  const container = document.getElementById('securityEventsList');
  container.innerHTML = '';
  
  if (events.length === 0) {
    container.innerHTML = '<p>No security events found.</p>';
    return;
  }
  
  events.forEach(event => {
    const eventDiv = document.createElement('div');
    eventDiv.className = `security-event ${event.severity}`;
    eventDiv.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong>${event.event_type}</strong> - ${event.description}
          <br><small>${formatDateTime(event.timestamp)} | IP: ${event.ip_address}</small>
        </div>
        ${!event.resolved ? `<button class="btn btn-sm btn-success" onclick="resolveSecurityEvent(${event.id})">Resolve</button>` : '<span class="status-badge status-active">Resolved</span>'}
      </div>
    `;
    container.appendChild(eventDiv);
  });
}

function filterDevices() {
  const districtFilter = document.getElementById('districtFilter').value;
  const statusFilter = document.getElementById('statusFilter').value;
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  
  filteredDevices = allDevices.filter(device => {
    const matchesDistrict = !districtFilter || device.district_id == districtFilter;
    const matchesStatus = !statusFilter || device.status === statusFilter;
    const matchesSearch = !searchTerm || 
      (device.device_name && device.device_name.toLowerCase().includes(searchTerm)) ||
      (device.mac_address && device.mac_address.toLowerCase().includes(searchTerm));
    
    return matchesDistrict && matchesStatus && matchesSearch;
  });
  
  currentPage = 1;
  displayDevices();
}

function resetFilters() {
  document.getElementById('districtFilter').value = '';
  document.getElementById('statusFilter').value = '';
  document.getElementById('searchInput').value = '';
  filteredDevices = allDevices;
  currentPage = 1;
  displayDevices();
}

function updatePagination() {
  const totalPages = Math.ceil(filteredDevices.length / devicesPerPage);
  const pagination = document.getElementById('pagination');
  pagination.innerHTML = '';
  
  if (totalPages <= 1) return;
  
  // Previous button
  const prevBtn = document.createElement('button');
  prevBtn.textContent = 'Previous';
  prevBtn.className = 'btn btn-secondary';
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => goToPage(currentPage - 1);
  pagination.appendChild(prevBtn);
  
  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      const pageBtn = document.createElement('button');
      pageBtn.textContent = i;
      pageBtn.className = i === currentPage ? 'btn btn-primary' : 'btn btn-secondary';
      pageBtn.onclick = () => goToPage(i);
      pagination.appendChild(pageBtn);
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      const dots = document.createElement('span');
      dots.textContent = '...';
      pagination.appendChild(dots);
    }
  }
  
  // Next button
  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next';
  nextBtn.className = 'btn btn-secondary';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => goToPage(currentPage + 1);
  pagination.appendChild(nextBtn);
}

function goToPage(page) {
  currentPage = page;
  displayDevices();
}

async function viewDeviceDetails(deviceId) {
  try {
    const device = allDevices.find(d => d.id === deviceId);
    if (!device) return;
    
    const logsResponse = await fetch(`/api/device-logs?device_id=${deviceId}&limit=10`);
    const logs = await logsResponse.json();
    
    const detailsHtml = `
      <h3>${device.device_name || 'Unknown Device'}</h3>
      <p><strong>MAC Address:</strong> ${device.mac_address}</p>
      <p><strong>IP Address:</strong> ${device.ip_address || 'N/A'}</p>
      <p><strong>Type:</strong> ${device.device_type || 'Unknown'}</p>
      <p><strong>Vendor:</strong> ${device.vendor || 'Unknown'}</p>
      <p><strong>OS:</strong> ${device.os_type || 'Unknown'}</p>
      <p><strong>District:</strong> ${device.district_name || 'Unknown'}</p>
      <p><strong>Status:</strong> <span class="status-badge status-${device.status}">${device.status}</span></p>
      <p><strong>First Seen:</strong> ${formatDateTime(device.first_seen)}</p>
      <p><strong>Last Seen:</strong> ${formatDateTime(device.last_seen)}</p>
      <p><strong>Connection Count:</strong> ${device.connection_count || 0}</p>
      <p><strong>Data Usage:</strong> ${formatBytes(device.data_usage || 0)}</p>
      
      <h4>Recent Activity</h4>
      <div style="max-height: 200px; overflow-y: auto;">
        ${logs.length > 0 ? logs.map(log => `
          <div style="padding: 8px; border-bottom: 1px solid #eee;">
            <strong>${log.action}</strong> - ${formatDateTime(log.timestamp)}
            <br><small>Duration: ${log.duration ? formatDuration(log.duration) : 'N/A'} | Data: ${formatBytes(log.data_transferred || 0)}</small>
          </div>
        `).join('') : '<p>No recent activity found.</p>'}
      </div>
    `;
    
    document.getElementById('deviceDetails').innerHTML = detailsHtml;
    document.getElementById('deviceModal').style.display = 'block';
  } catch (error) {
    console.error('Error loading device details:', error);
  }
}

async function viewDeviceLogs(deviceId) {
  try {
    const response = await fetch(`/api/device-logs?device_id=${deviceId}&limit=50`);
    const logs = await response.json();
    
    const device = allDevices.find(d => d.id === deviceId);
    const logsHtml = `
      <h3>Activity Logs - ${device?.device_name || 'Unknown Device'}</h3>
      <div style="max-height: 400px; overflow-y: auto;">
        ${logs.length > 0 ? logs.map(log => `
          <div style="padding: 10px; border-bottom: 1px solid #eee;">
            <strong>${log.action}</strong> - ${formatDateTime(log.timestamp)}
            <br><small>IP: ${log.ip_address || 'N/A'} | Duration: ${log.duration ? formatDuration(log.duration) : 'N/A'} | Data: ${formatBytes(log.data_transferred || 0)} | Signal: ${log.signal_strength || 'N/A'}%</small>
            ${log.user_agent ? `<br><small>User Agent: ${log.user_agent}</small>` : ''}
          </div>
        `).join('') : '<p>No logs found for this device.</p>'}
      </div>
    `;
    
    document.getElementById('deviceDetails').innerHTML = logsHtml;
    document.getElementById('deviceModal').style.display = 'block';
  } catch (error) {
    console.error('Error loading device logs:', error);
  }
}

async function resolveSecurityEvent(eventId) {
  try {
    const response = await fetch(`/api/security-events/${eventId}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      loadSecurityEvents();
    } else {
      alert('Failed to resolve security event');
    }
  } catch (error) {
    console.error('Error resolving security event:', error);
    alert('Failed to resolve security event');
  }
}

async function simulateDevice() {
  try {
    const response = await fetch('/api/simulate-device', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      loadDevices();
      alert('Device simulated successfully!');
    } else {
      alert('Failed to simulate device');
    }
  } catch (error) {
    console.error('Error simulating device:', error);
    alert('Failed to simulate device');
  }
}

function refreshDevices() {
  loadDevices();
  loadSecurityEvents();
}

function closeModal() {
  document.getElementById('deviceModal').style.display = 'none';
}

// Utility functions
function formatDateTime(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString();
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(seconds) {
  if (!seconds) return 'N/A';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// Close modal when clicking outside
window.onclick = function(event) {
  const modal = document.getElementById('deviceModal');
  if (event.target === modal) {
    modal.style.display = 'none';
  }
}
