// Government ID validation
function validateGovId(input) {
  const govId = input.value.trim();
  const validationDiv = document.getElementById('govIdValidation');
  const submitBtn = document.getElementById('submitBtn');
  
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

// Password strength checker
function checkPasswordStrength(input) {
  const password = input.value;
  const strengthDiv = document.getElementById('passwordStrength');
  let strength = 0;
  let feedback = '';
  
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;
  
  switch (strength) {
    case 0:
    case 1:
    case 2:
      feedback = '<span class="strength-weak">Weak password - Add more complexity</span>';
      break;
    case 3:
    case 4:
      feedback = '<span class="strength-medium">Medium strength - Could be stronger</span>';
      break;
    case 5:
    case 6:
      feedback = '<span class="strength-strong">Strong password ✓</span>';
      break;
  }
  
  strengthDiv.innerHTML = feedback;
  checkFormValidity();
}

// Password match checker
function checkPasswordMatch() {
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const matchDiv = document.getElementById('passwordMatch');
  
  if (confirmPassword.length === 0) {
    matchDiv.textContent = '';
    matchDiv.className = 'validation-message';
    return;
  }
  
  if (password === confirmPassword) {
    matchDiv.textContent = 'Passwords match ✓';
    matchDiv.className = 'validation-message validation-success';
  } else {
    matchDiv.textContent = 'Passwords do not match';
    matchDiv.className = 'validation-message validation-error';
  }
  
  checkFormValidity();
}

// Check overall form validity
function checkFormValidity() {
  const submitBtn = document.getElementById('submitBtn');
  const form = document.getElementById('adminRegistrationForm');
  const govIdValid = validateGovId(document.getElementById('govId'));
  const passwordMatch = document.getElementById('password').value === document.getElementById('confirmPassword').value;
  const formValid = form.checkValidity() && govIdValid && passwordMatch && document.getElementById('password').value.length >= 8;
  
  submitBtn.disabled = !formValid;
}

// Admin registration function
async function registerAdmin() {
  const form = document.getElementById('adminRegistrationForm');
  const submitBtn = document.getElementById('submitBtn');
  
  // Double-check validations
  if (!form.checkValidity()) {
    form.reportValidity();
    return false;
  }
  
  const formData = {
    fullname: document.getElementById('fullname').value.trim(),
    email: document.getElementById('email').value.trim(),
    username: document.getElementById('username').value.trim(),
    govId: document.getElementById('govId').value.trim().toUpperCase(),
    department: document.getElementById('department').value,
    password: document.getElementById('password').value,
    role: 'admin',
    registrationType: 'government_admin'
  };
  
  // Disable submit button
  submitBtn.disabled = true;
  submitBtn.textContent = 'Registering...';
  
  try {
    const response = await fetch('/api/auth/admin-register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Log successful registration
      console.log('Admin registration successful:', data);
      
      alert('Admin account created successfully! Your registration is pending verification.\n\n' +
            'Registration ID: ' + data.registrationId + '\n' +
            'Please save this ID for your records.\n\n' +
            'You will be notified once your account is verified and activated.');
      
      // Redirect to login
      window.location.href = 'login.html';
    } else {
      alert('Registration failed: ' + (data.error || 'Unknown error'));
      submitBtn.disabled = false;
      submitBtn.textContent = 'Register Admin Account';
    }
  } catch (error) {
    console.error('Registration error:', error);
    alert('Network error during registration. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Register Admin Account';
  }
  
  return false; // prevent form reload
}

// Initialize form validation on page load
document.addEventListener('DOMContentLoaded', function() {
  // Add input event listeners for real-time validation
  document.getElementById('govId').addEventListener('input', function() {
    validateGovId(this);
  });
  
  document.getElementById('password').addEventListener('input', function() {
    checkPasswordStrength(this);
  });
  
  document.getElementById('confirmPassword').addEventListener('input', checkPasswordMatch);
  
  // Add form submission listener
  document.getElementById('adminRegistrationForm').addEventListener('submit', function(e) {
    e.preventDefault();
    registerAdmin();
  });
  
  console.log('Admin registration form initialized');
});
