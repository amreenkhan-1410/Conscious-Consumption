// Authentication JavaScript

// Tab switching functionality
const tabBtns = document.querySelectorAll('.tab-btn');
const authForms = document.querySelectorAll('.auth-form');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetTab = btn.getAttribute('data-tab');
    
    // Remove active class from all tabs and forms
    tabBtns.forEach(t => t.classList.remove('active'));
    authForms.forEach(f => f.classList.remove('active'));
    
    // Add active class to clicked tab and corresponding form
    btn.classList.add('active');
    document.getElementById(`${targetTab}-form`).classList.add('active');
    
    // Clear any existing error messages
    clearAllErrors();
  });
});

// Clear all error messages
function clearAllErrors() {
  const errorMessages = document.querySelectorAll('.error-message');
  const errorInputs = document.querySelectorAll('.form-group input.error');
  
  errorMessages.forEach(msg => {
    msg.textContent = '';
    msg.style.display = 'none';
  });
  
  errorInputs.forEach(input => {
    input.classList.remove('error');
  });
}

// Show error message
function showError(fieldId, message) {
  const errorElement = document.getElementById(`${fieldId}Error`);
  const inputElement = document.getElementById(fieldId);
  
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
  }
  
  if (inputElement) {
    inputElement.classList.add('error');
  }
}

// Hide error message
function hideError(fieldId) {
  const errorElement = document.getElementById(`${fieldId}Error`);
  const inputElement = document.getElementById(fieldId);
  
  if (errorElement) {
    errorElement.style.display = 'none';
  }
  
  if (inputElement) {
    inputElement.classList.remove('error');
  }
}

// Show success message
function showSuccess(message) {
  const form = document.querySelector('.auth-form.active');
  const existingSuccess = form.querySelector('.success-message');
  
  if (existingSuccess) {
    existingSuccess.remove();
  }
  
  const successDiv = document.createElement('div');
  successDiv.className = 'success-message';
  successDiv.textContent = message;
  
  form.insertBefore(successDiv, form.firstChild.nextSibling);
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (successDiv.parentNode) {
      successDiv.remove();
    }
  }, 5000);
}

// Email validation
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Password strength checker
function checkPasswordStrength(password) {
  let strength = 0;
  let feedback = [];
  
  if (password.length >= 6) strength++;
  else feedback.push('At least 6 characters');
  
  if (/[a-z]/.test(password)) strength++;
  else feedback.push('Lowercase letter');
  
  if (/[A-Z]/.test(password)) strength++;
  else feedback.push('Uppercase letter');
  
  if (/[0-9]/.test(password)) strength++;
  else feedback.push('Number');
  
  if (/[^A-Za-z0-9]/.test(password)) strength++;
  else feedback.push('Special character');
  
  const strengthFill = document.getElementById('strengthFill');
  const strengthText = document.getElementById('strengthText');
  
  strengthFill.className = 'strength-fill';
  
  if (strength <= 2) {
    strengthFill.classList.add('weak');
    strengthText.textContent = 'Weak password';
  } else if (strength <= 3) {
    strengthFill.classList.add('medium');
    strengthText.textContent = 'Medium strength';
  } else {
    strengthFill.classList.add('strong');
    strengthText.textContent = 'Strong password';
  }
  
  return { strength, feedback };
}

// Password strength indicator
const signupPassword = document.getElementById('signupPassword');
if (signupPassword) {
  signupPassword.addEventListener('input', (e) => {
    checkPasswordStrength(e.target.value);
  });
}

// Real-time validation
function setupRealTimeValidation() {
  // Email validation
  const emailInputs = document.querySelectorAll('input[type="email"]');
  emailInputs.forEach(input => {
    input.addEventListener('blur', (e) => {
      const email = e.target.value.trim();
      const fieldId = e.target.id;
      
      if (email && !validateEmail(email)) {
        showError(fieldId, 'Please enter a valid email address');
      } else {
        hideError(fieldId);
      }
    });
  });
  
  // Name validation
  const nameInput = document.getElementById('signupName');
  if (nameInput) {
    nameInput.addEventListener('blur', (e) => {
      const name = e.target.value.trim();
      
      if (name && name.length < 2) {
        showError('signupName', 'Name must be at least 2 characters long');
      } else {
        hideError('signupName');
      }
    });
  }
  
  // Password confirmation
  const confirmPassword = document.getElementById('confirmPassword');
  if (confirmPassword) {
    confirmPassword.addEventListener('blur', (e) => {
      const password = document.getElementById('signupPassword').value;
      const confirmPass = e.target.value;
      
      if (confirmPass && password !== confirmPass) {
        showError('confirmPassword', 'Passwords do not match');
      } else {
        hideError('confirmPassword');
      }
    });
  }
}

// Login form submission
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  
  // Clear previous errors
  clearAllErrors();
  
  // Validation
  let hasErrors = false;
  
  if (!email) {
    showError('loginEmail', 'Email is required');
    hasErrors = true;
  } else if (!validateEmail(email)) {
    showError('loginEmail', 'Please enter a valid email address');
    hasErrors = true;
  }
  
  if (!password) {
    showError('loginPassword', 'Password is required');
    hasErrors = true;
  }
  
  if (hasErrors) return;
  
  // Show loading state
  const submitBtn = e.target.querySelector('.auth-btn');
  submitBtn.classList.add('loading');
  
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      credentials: 'include', // Include cookies for session
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      showSuccess('Login successful! Redirecting...');
      
      // Store user data in localStorage
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('isLoggedIn', 'true');
      
      // Redirect to dashboard after 1.5 seconds
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 1500);
      
    } else {
      showError('loginPassword', data.error || 'Login failed');
    }
    
  } catch (error) {
    console.error('Login error:', error);
    showError('loginPassword', 'Network error. Please try again.');
  } finally {
    submitBtn.classList.remove('loading');
  }
});

// Signup form submission
document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const agreeTerms = document.getElementById('agreeTerms').checked;
  
  // Clear previous errors
  clearAllErrors();
  
  // Validation
  let hasErrors = false;
  
  if (!name) {
    showError('signupName', 'Name is required');
    hasErrors = true;
  } else if (name.length < 2) {
    showError('signupName', 'Name must be at least 2 characters long');
    hasErrors = true;
  }
  
  if (!email) {
    showError('signupEmail', 'Email is required');
    hasErrors = true;
  } else if (!validateEmail(email)) {
    showError('signupEmail', 'Please enter a valid email address');
    hasErrors = true;
  }
  
  if (!password) {
    showError('signupPassword', 'Password is required');
    hasErrors = true;
  } else if (password.length < 6) {
    showError('signupPassword', 'Password must be at least 6 characters long');
    hasErrors = true;
  }
  
  if (!confirmPassword) {
    showError('confirmPassword', 'Please confirm your password');
    hasErrors = true;
  } else if (password !== confirmPassword) {
    showError('confirmPassword', 'Passwords do not match');
    hasErrors = true;
  }
  
  if (!agreeTerms) {
    showError('agreeTerms', 'Please agree to the terms and conditions');
    hasErrors = true;
  }
  
  if (hasErrors) return;
  
  // Show loading state
  const submitBtn = e.target.querySelector('.auth-btn');
  submitBtn.classList.add('loading');
  
  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      credentials: 'include', // Include cookies for session
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, email, password }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      showSuccess('Account created successfully! You can now log in.');
      
      // Switch to login tab after 2 seconds
      setTimeout(() => {
        document.querySelector('[data-tab="login"]').click();
        document.getElementById('loginEmail').value = email;
        document.getElementById('loginPassword').value = '';
      }, 2000);
      
    } else {
      showError('signupEmail', data.error || 'Registration failed');
    }
    
  } catch (error) {
    console.error('Registration error:', error);
    showError('signupEmail', 'Network error. Please try again.');
  } finally {
    submitBtn.classList.remove('loading');
  }
});

// Initialize real-time validation
setupRealTimeValidation();

// Check if user is already logged in
window.addEventListener('load', () => {
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  if (isLoggedIn === 'true') {
    // User is already logged in, redirect to dashboard
    window.location.href = '/dashboard.html';
  }
});

// Social login placeholder (for future implementation)
document.querySelectorAll('.social-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    alert('Social login will be implemented in a future update!');
  });
});

// Forgot password placeholder
document.querySelector('.forgot-password')?.addEventListener('click', (e) => {
  e.preventDefault();
  alert('Password reset functionality will be implemented soon!');
});
