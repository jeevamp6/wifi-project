let selectedUserType = 'user';

function selectUserType(type) {
  selectedUserType = type;
  
  // Update button styles
  document.querySelectorAll('.user-type-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  if (type === 'user') {
    document.querySelector('.user-type-btn:first-child').classList.add('active');
  } else {
    document.querySelector('.user-type-btn:last-child').classList.add('active');
  }
}

async function loginUser() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const errorMsg = document.getElementById("errorMsg");

  // Clear previous error
  errorMsg.innerText = "";

  // Log login attempt
  console.log(`Login attempt: ${username} as ${selectedUserType}`);

  try {
    // Send login request to backend
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username,
        password: password,
        loginType: selectedUserType
      })
    });

    const data = await response.json();

    if (response.ok) {
      // Log successful login
      console.log(`Successful login: ${username} (${data.user.role})`);
      
      // Save login state to localStorage
      localStorage.setItem("login", "true");
      localStorage.setItem("userRole", data.user.role);
      localStorage.setItem("username", data.user.username);
      localStorage.setItem("fullname", data.user.fullname);
      localStorage.setItem("userId", data.user.id);
      localStorage.setItem("email", data.user.email);
      localStorage.setItem("loginType", selectedUserType);
      localStorage.setItem("loginTime", new Date().toISOString());

      // Log activity to localStorage for immediate feedback
      const loginActivity = {
        timestamp: new Date().toISOString(),
        user: username,
        action: `Successfully logged in as ${selectedUserType} (${data.user.role})`,
        type: 'login_success'
      };
      
      // Store in localStorage for activity tracking
      let activities = JSON.parse(localStorage.getItem('loginActivities') || '[]');
      activities.unshift(loginActivity);
      activities = activities.slice(0, 50); // Keep last 50 activities
      localStorage.setItem('loginActivities', JSON.stringify(activities));

      // Redirect based on role
      if (data.user.role === 'admin') {
        window.location.href = "admin.html";
      } else if (data.user.role === 'viewer') {
        window.location.href = "viewer.html";
      } else {
        window.location.href = "home.html";
      }
    } else {
      // Log failed login
      console.log(`Failed login: ${username} - ${data.error}`);
      
      // Store failed login attempt
      const failedActivity = {
        timestamp: new Date().toISOString(),
        user: username,
        action: `Failed login attempt as ${selectedUserType}: ${data.error}`,
        type: 'login_failed'
      };
      
      let activities = JSON.parse(localStorage.getItem('loginActivities') || '[]');
      activities.unshift(failedActivity);
      activities = activities.slice(0, 50);
      localStorage.setItem('loginActivities', JSON.stringify(activities));
      
      errorMsg.innerText = data.error || "Login failed";
    }
  } catch (error) {
    console.error('Login error:', error);
    
    // Log network error
    const errorActivity = {
      timestamp: new Date().toISOString(),
      user: username,
      action: `Network error during login: ${error.message}`,
      type: 'login_error'
    };
    
    let activities = JSON.parse(localStorage.getItem('loginActivities') || '[]');
    activities.unshift(errorActivity);
    activities = activities.slice(0, 50);
    localStorage.setItem('loginActivities', JSON.stringify(activities));
    
    errorMsg.innerText = "Network error. Please try again.";
  }

  return false; // prevent form reload
}

async function forgotPassword() {
  const username = prompt("Enter your username to reset password:");
  if (!username) return;

  try {
    const response = await fetch('/auth/forgot-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        username: username,
        userType: selectedUserType 
      })
    });

    const data = await response.json();

    if (response.ok) {
      const newPassword = prompt("Enter your new password (min 8 characters):");
      if (newPassword && newPassword.length >= 8) {
        const confirmResponse = await fetch('/auth/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            username: username, 
            newPassword: newPassword,
            userType: selectedUserType 
          })
        });

        const confirmData = await confirmResponse.json();
        if (confirmResponse.ok) {
          alert("Password reset successfully! Please login with your new password.");
        } else {
          alert("Password reset failed: " + (confirmData.error || "Unknown error"));
        }
      } else {
        alert("Password must be at least 8 characters long.");
      }
    } else {
      alert(data.error || "Username not found.");
    }
  } catch (error) {
    console.error('Password reset error:', error);
    alert("Network error. Please try again.");
  }
}
