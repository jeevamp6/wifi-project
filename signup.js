// Toggle government ID field based on role selection
function toggleGovIdField() {
  const role = document.getElementById("role").value;
  const govIdField = document.getElementById("govIdField");
  const deptField = document.getElementById("deptField");
  
  if (role === "admin") {
    govIdField.classList.add("show");
    deptField.classList.add("show");
    
    // Add admin notice
    if (!document.getElementById("adminNotice")) {
      const notice = document.createElement("div");
      notice.id = "adminNotice";
      notice.className = "admin-notice";
      notice.innerHTML = `
        <strong>⚠️ Administrator Registration:</strong> 
        Government ID is required for admin accounts. 
        Please ensure you have valid government-issued identification.
      `;
      govIdField.parentNode.insertBefore(notice, govIdField);
    }
  } else {
    govIdField.classList.remove("show");
    deptField.classList.remove("show");
    const notice = document.getElementById("adminNotice");
    if (notice) {
      notice.remove();
    }
  }
  
  checkFormValidity();
}

// Government ID validation
function validateGovId(input) {
  const govId = input.value.trim();
  const validationDiv = document.getElementById('govIdValidation');
  const submitBtn = document.getElementById('submitBtn');
  
  if (!validationDiv) return true; // Skip validation if field not visible
  
  // Check if exactly 12 characters
  if (govId.length !== 12) {
    validationDiv.textContent = `Government ID must be exactly 12 characters (${govId.length}/12)`;
    validationDiv.className = 'validation-message validation-error';
    submitBtn.disabled = true;
    return false;
  }
  
  // Check if alphanumeric only
  const alphanumericRegex = /^[A-Za-z0-9]{12}$/;
  if (!alphanumericRegex.test(govId)) {
    validationDiv.textContent = 'Government ID must contain only letters and numbers (no special characters)';
    validationDiv.className = 'validation-message validation-error';
    submitBtn.disabled = true;
    return false;
  }
  
  // Check for minimum complexity (at least 2 letters and 2 numbers)
  const letterCount = (govId.match(/[A-Za-z]/g) || []).length;
  const numberCount = (govId.match(/[0-9]/g) || []).length;
  
  if (letterCount < 2 || numberCount < 2) {
    validationDiv.textContent = 'Government ID must contain at least 2 letters and 2 numbers';
    validationDiv.className = 'validation-message validation-error';
    submitBtn.disabled = true;
    return false;
  }
  
  // Check for common patterns (basic security)
  const commonPatterns = [
    /^AAAAAAAAAAAA$/, /^BBBBBBBBBBBB$/, /^CCCCCCCCCCCC$/,
    /^111111111111$/, /^222222222222$/, /^333333333333$/,
    /^123456789012$/, /^ABCDEFGHIJKL$/, /^NOPQRSTUVWXYZ$/,
    /^0123456789AB$/
  ];
  
  for (const pattern of commonPatterns) {
    if (pattern.test(govId.toUpperCase())) {
      validationDiv.textContent = 'Government ID format is too common or predictable';
      validationDiv.className = 'validation-message validation-error';
      submitBtn.disabled = true;
      return false;
    }
  }
  
  // All validations passed
  validationDiv.textContent = 'Valid government ID format';
  validationDiv.className = 'validation-message validation-success';
  checkFormValidity();
  return true;
}

// Check overall form validity
function checkFormValidity() {
  const submitBtn = document.getElementById('submitBtn');
  const form = document.getElementById('signupForm');
  const role = document.getElementById('role').value;
  const govIdValid = role !== 'admin' || validateGovId(document.getElementById('govId'));
  const formValid = form.checkValidity() && govIdValid;
  
  submitBtn.disabled = !formValid;
}

async function signupUser() {
  const fullname = document.getElementById("fullname").value;
  const email = document.getElementById("email").value;
  const username = document.getElementById("username").value;
  const role = document.getElementById("role").value;
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const govId = document.getElementById("govId").value.trim();
  const errorMsg = document.getElementById("errorMsg");
  const successMsg = document.getElementById("successMsg");

  // Clear previous messages
  errorMsg.innerText = "";
  successMsg.innerText = "";

  // Validation
  if (password.length < 8) {
    errorMsg.innerText = "Password must be at least 8 characters long";
    return false;
  }

  if (password !== confirmPassword) {
    errorMsg.innerText = "Passwords do not match";
    return false;
  }

  // Government ID validation for admin role
  if (role === 'admin') {
    if (!govId) {
      errorMsg.innerText = "Government ID is required for administrator accounts";
      return false;
    }
    
    if (!validateGovId(document.getElementById('govId'))) {
      return false;
    }
  }

  try {
    // Send registration request to backend
    const requestBody = {
      fullname: fullname,
      email: email,
      username: username,
      role: role,
      password: password
    };

    // Add government ID and department for admin role
    if (role === 'admin') {
      requestBody.govId = govId.toUpperCase();
      requestBody.department = document.getElementById('department')?.value || 'General Administration';
      requestBody.registrationType = 'government_admin';
    }

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (response.ok) {
      // Show success message
      if (role === 'admin') {
        successMsg.innerText = "Admin registration submitted! Your account is pending verification. Registration ID: " + (data.registrationId || 'N/A');
      } else {
        successMsg.innerText = "Account created successfully! Redirecting to login...";
      }
      successMsg.style.color = "#28a745";

      // Clear form
      document.getElementById("fullname").value = "";
      document.getElementById("email").value = "";
      document.getElementById("username").value = "";
      document.getElementById("role").value = "";
      document.getElementById("password").value = "";
      document.getElementById("confirmPassword").value = "";
      if (document.getElementById("govId")) {
        document.getElementById("govId").value = "";
      }

      // Redirect to login after 3 seconds for admin, 2 seconds for others
      const redirectDelay = role === 'admin' ? 3000 : 2000;
      setTimeout(() => {
        window.location.href = "login.html";
      }, redirectDelay);
    } else {
      errorMsg.innerText = data.error || "Registration failed";
    }
  } catch (error) {
    console.error('Registration error:', error);
    errorMsg.innerText = "Network error. Please try again.";
  }

  return false; // prevent form reload
}
