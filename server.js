const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const axios = require('axios');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  secret: 'conscious-consumption-secret-key-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Database connection
const db = new sqlite3.Database(path.join(__dirname, 'db', 'entries.db'), (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
  } else {
    console.log("Database connected!");
    // Create entries table
    db.run(`CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      apps TEXT,
      screen_time INTEGER,
      reflection TEXT,
      tags TEXT,
      created_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`, (err) => {
      if (err) console.error("Error creating entries table:", err.message);
    });

    // Add user_id column to existing entries table if it doesn't exist
    db.run(`ALTER TABLE entries ADD COLUMN user_id INTEGER`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error("Error adding user_id column:", err.message);
      } else if (!err) {
        console.log("Added user_id column to entries table");
      }
    });

    // Create users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) console.error("Error creating users table:", err.message);
      else console.log("Database setup complete!");
    });
  }
});

// Routes

// Serve index page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve doctor consult page
app.get('/doctor', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'doctor_consult.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Serve login/signup page
app.get('/auth', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});
// Save journal entry
app.post('/api/entries', (req, res) => {
  try {
    const { apps, screenTime, reflection, tags, userId } = req.body;
    const sessionUserId = req.session.userId;
    
    console.log('POST /api/entries - Request body:', req.body);
    console.log('POST /api/entries - Session userId:', sessionUserId);
    console.log('POST /api/entries - Session:', req.session);
    
    // Input validation
    if (!apps || !screenTime || !reflection || !tags) {
      return res.status(400).json({ 
        success: false,
        error: 'All fields are required' 
      });
    }
    
    if (!Array.isArray(apps) || apps.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Please select at least one app' 
      });
    }
    
    if (typeof screenTime !== 'number' || screenTime < 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid screen time value' 
      });
    }
    
    if (typeof reflection !== 'string' || reflection.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Reflection is required' 
      });
    }
    
    if (!Array.isArray(tags)) {
      return res.status(400).json({ 
        success: false,
        error: 'Tags must be an array' 
      });
    }
    
    // Get current IST time (Indian Standard Time)
    const now = new Date();
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const localTime = istTime.toISOString();
    
    // Use session userId if available, otherwise use provided userId
    const finalUserId = sessionUserId || userId || null;
    
    const stmt = `INSERT INTO entries (user_id, apps, screen_time, reflection, tags, created_at) VALUES (?, ?, ?, ?, ?, ?)`;

    db.run(stmt, [finalUserId, JSON.stringify(apps), screenTime, reflection.trim(), JSON.stringify(tags), localTime], function(err) {
      if (err) {
        console.error('Database error saving entry:', err.message);
        return res.status(500).json({ 
          success: false,
          error: 'Failed to save entry. Please try again.' 
        });
      }
      
      console.log(`Entry saved successfully (ID: ${this.lastID})`);
      res.json({ 
        success: true,
        id: this.lastID, 
        message: 'Entry saved successfully' 
      });
    });
  } catch (error) {
    console.error('Entry save error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error. Please try again later.' 
    });
  }
});

// Get all entries (for dashboard)
app.get('/api/entries', (req, res) => {
  try {
    const userId = req.session.userId;
    
    console.log('GET /api/entries - Session userId:', userId);
    console.log('GET /api/entries - Session:', req.session);
    
    // If user is logged in, get only their entries, otherwise get all entries
    const query = userId ? 
      `SELECT * FROM entries WHERE user_id = ? ORDER BY created_at DESC` : 
      `SELECT * FROM entries ORDER BY created_at DESC`;
    const params = userId ? [userId] : [];
    
    console.log('GET /api/entries - Query:', query);
    console.log('GET /api/entries - Params:', params);
    
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Database error fetching entries:', err.message);
        return res.status(500).json({ 
          success: false,
          error: 'Failed to fetch entries. Please try again.' 
        });
      }
      
      console.log('GET /api/entries - Raw rows:', rows);
      
      // Parse JSON fields in entries
      const parsedRows = rows.map(row => ({
        ...row,
        apps: row.apps ? JSON.parse(row.apps) : [],
        tags: row.tags ? JSON.parse(row.tags) : []
      }));
      
      console.log('GET /api/entries - Parsed rows:', parsedRows);
      
      res.json({
        success: true,
        entries: parsedRows,
        userId: userId,
        count: parsedRows.length
      });
    });
  } catch (error) {
    console.error('Get entries error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error. Please try again later.' 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
// Authentication endpoints

// User Registration
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Input validation
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'All fields are required' 
      });
    }
    
    if (name.trim().length < 2) {
      return res.status(400).json({ 
        success: false,
        error: 'Name must be at least 2 characters long' 
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        error: 'Password must be at least 6 characters long' 
      });
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ 
        success: false,
        error: 'Please enter a valid email address' 
      });
    }
    
    // Check if user already exists
    db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()], async (err, row) => {
      if (err) {
        console.error('Database error during user lookup:', err.message);
        return res.status(500).json({ 
          success: false,
          error: 'Database error. Please try again.' 
        });
      }
      
      if (row) {
        return res.status(400).json({ 
          success: false,
          error: 'User already exists with this email address' 
        });
      }
      
      try {
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);
        
        // Insert new user
        db.run(
          'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
          [name.trim(), email.toLowerCase().trim(), hashedPassword],
          function(err) {
            if (err) {
              console.error('Database error during user creation:', err.message);
              return res.status(500).json({ 
                success: false,
                error: 'Failed to create user account. Please try again.' 
              });
            }
            
            console.log(`New user registered: ${email} (ID: ${this.lastID})`);
            res.json({ 
              success: true, 
              message: 'Account created successfully! You can now log in.',
              userId: this.lastID 
            });
          }
        );
      } catch (hashError) {
        console.error('Password hashing error:', hashError);
        res.status(500).json({ 
          success: false,
          error: 'Server error during account creation' 
        });
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error. Please try again later.' 
    });
  }
});

// User Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Input validation
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'Email and password are required' 
      });
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ 
        success: false,
        error: 'Please enter a valid email address' 
      });
    }
    
    // Find user by email
    db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()], async (err, user) => {
      if (err) {
        console.error('Database error during login:', err.message);
        return res.status(500).json({ 
          success: false,
          error: 'Database error. Please try again.' 
        });
      }
      
      if (!user) {
        return res.status(401).json({ 
          success: false,
          error: 'Invalid email or password' 
        });
      }
      
      try {
        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
          return res.status(401).json({ 
            success: false,
            error: 'Invalid email or password' 
          });
        }
        
        // Create session
        req.session.userId = user.id;
        req.session.userEmail = user.email;
        req.session.userName = user.name;
        
        console.log(`User logged in: ${user.email} (ID: ${user.id})`);
        
        // Return user data (without password)
        res.json({ 
          success: true, 
          message: 'Login successful',
          user: {
            id: user.id,
            name: user.name,
            email: user.email
          }
        });
      } catch (compareError) {
        console.error('Password comparison error:', compareError);
        res.status(500).json({ 
          success: false,
          error: 'Server error during login' 
        });
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error. Please try again later.' 
    });
  }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// Check authentication middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  } else {
    return res.status(401).json({ error: 'Authentication required' });
  }
}

// AI Analysis endpoint
app.post('/api/ai-analysis', requireAuth, async (req, res) => {
  try {
    console.log('AI Analysis request received');
    console.log('Session userId:', req.session.userId);
    console.log('Request body:', req.body);
    
    const { apps, screenTime, reflection, tags } = req.body;
    
    if (!apps || !screenTime || !reflection || !tags) {
      console.log('Missing required fields for AI analysis');
      return res.status(400).json({ error: 'Missing required fields for AI analysis' });
    }

    // Prepare the prompt for Gemini AI
    const prompt = `
You are a digital wellness coach. Analyze this user's digital consumption data and provide personalized suggestions, tips, and micro habits.

User Data:
- Apps used: ${JSON.stringify(apps)}
- Screen time: ${screenTime} minutes
- Reflection: "${reflection}"
- Emotional tags: ${JSON.stringify(tags)}

Please provide:
1. A brief analysis of their digital consumption pattern
2. 3 specific suggestions for improvement
3. 2 micro habits they can implement today
4. 1 motivational tip

Keep the response concise, actionable, and encouraging. Focus on practical steps they can take immediately.

Format your response as JSON with these keys: analysis, suggestions, microHabits, motivationalTip
`;

    // Call Gemini API
    console.log('Calling Gemini API with prompt:', prompt);
    
    const geminiResponse = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': 'YOUR_API_KEY'
        }
      }
    );
    
    console.log('Gemini API response status:', geminiResponse.status);
    console.log('Gemini API response data:', geminiResponse.data);

    // Extract the AI response
    const aiText = geminiResponse.data.candidates[0].content.parts[0].text;
    
    // Try to parse as JSON, if not possible, format it properly
    let analysisResult;
    try {
      analysisResult = JSON.parse(aiText);
    } catch (parseError) {
      // If AI didn't return proper JSON, create a structured response
      analysisResult = {
        analysis: "Based on your digital consumption patterns, I can see areas for improvement.",
        suggestions: [
          "Set specific time limits for social media apps",
          "Practice the 20-20-20 rule: every 20 minutes, look at something 20 feet away for 20 seconds",
          "Create a mindful app usage routine"
        ],
        microHabits: [
          "Take a 5-minute break after every 30 minutes of screen time",
          "Write down your intention before opening any app"
        ],
        motivationalTip: "Remember, small changes lead to big transformations. You're taking the first step towards conscious digital consumption!",
        rawResponse: aiText
      };
    }

    res.json(analysisResult);

  } catch (error) {
    console.error('AI Analysis Error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to generate AI analysis',
      fallback: {
        analysis: "I can see you're being mindful about your digital consumption. Keep tracking your usage patterns!",
        suggestions: [
          "Set specific time limits for your most used apps",
          "Practice mindful scrolling by asking 'Why am I opening this app?'",
          "Create device-free zones in your home"
        ],
        microHabits: [
          "Take a deep breath before unlocking your phone",
          "Set your phone to grayscale mode to reduce visual appeal"
        ],
        motivationalTip: "Every moment of awareness is progress. You're building healthier digital habits!"
      }
    });
  }
});

// Test Gemini API endpoint
app.get('/test-gemini', async (req, res) => {
  try {
    console.log('🔍 Testing Gemini API key...');
    
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        contents: [
          {
            parts: [
              {
                text: "Hello! Please respond with 'API key is working perfectly' if you can read this message."
              }
            ]
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': 'AIzaSyDAw_ktJOpRTHYJ9dTMYaichgkG107GzXE'
        }
      }
    );

    console.log('✅ SUCCESS! Your Gemini API key is working!');
    const aiResponse = response.data.candidates[0].content.parts[0].text;
    
    res.json({
      status: 'success',
      message: 'Gemini API key is working!',
      response: aiResponse
    });
    
  } catch (error) {
    console.log('❌ ERROR: Your Gemini API key is not working');
    console.log('Error details:', error.response?.data || error.message);
    
    let errorMessage = 'API key error';
    if (error.response?.status === 401) {
      errorMessage = 'Authentication error - check your API key';
    } else if (error.response?.status === 403) {
      errorMessage = 'Permission error - check your API key permissions';
    } else if (error.response?.status === 429) {
      errorMessage = 'Rate limit exceeded - try again later';
    }
    
    res.json({
      status: 'error',
      message: errorMessage,
      details: error.response?.data || error.message
    });
  }
});

// Session refresh endpoint
app.get('/api/session/refresh', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({
      success: true,
      userId: req.session.userId,
      userEmail: req.session.userEmail,
      userName: req.session.userName
    });
  } else {
    res.json({
      success: false,
      message: 'No active session'
    });
  }
});

// Debug: check session status
app.get('/debug/session', (req, res) => {
  res.json({
    sessionId: req.sessionID,
    session: req.session,
    userId: req.session.userId,
    userEmail: req.session.userEmail,
    userName: req.session.userName
  });
});

// Debug: see all entries in browser
app.get('/debug/entries', (req, res) => {
  db.all("SELECT * FROM entries ORDER BY created_at DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});