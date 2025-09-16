const sqlite3 = require('sqlite3').verbose();

// Create or open database
const db = new sqlite3.Database('database.db', (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Database connected!');
  }
});

// Create entries table
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    apps TEXT,
    screen_time INTEGER,
    reflection TEXT,
    tags TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating table', err.message);
    } else {
      console.log('Table "entries" created or already exists.');
    }
  });
});

// Close database
db.close((err) => {
  if (err) {
    console.error('Error closing database', err.message);
  } else {
    console.log('Database setup complete!');
  }
});
