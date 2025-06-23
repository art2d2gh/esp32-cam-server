const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function setupDatabase() {
  try {
    console.log('Setting up database tables...');

    // Create video_frames table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS video_frames (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(255) NOT NULL,
        frame_data BYTEA NOT NULL,
        size INTEGER NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create index for faster queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_video_frames_device_created 
      ON video_frames(device_id, created_at DESC)
    `);

    // Create device_logs table for heartbeat history
    await pool.query(`
      CREATE TABLE IF NOT EXISTS device_logs (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(255) NOT NULL,
        camera_enabled BOOLEAN DEFAULT FALSE,
        streaming_active BOOLEAN DEFAULT FALSE,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create index for device logs
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_device_logs_device_created 
      ON device_logs(device_id, created_at DESC)
    `);

    console.log('Database setup completed successfully!');
    console.log('Tables created:');
    console.log('- video_frames: Stores video frames from ESP32-CAM');
    console.log('- device_logs: Stores device heartbeat history');

  } catch (error) {
    console.error('Error setting up database:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run setup if called directly
if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase };
