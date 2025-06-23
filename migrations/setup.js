const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function setupDatabase() {
  try {
    console.log('Setting up Supabase tables...');

    // Note: For Supabase, you should create tables using the Supabase dashboard
    // or SQL editor. This script will verify the tables exist.

    console.log('Checking if tables exist...');

    // Check video_frames table
    const { data: videoFramesTable, error: videoFramesError } = await supabase
      .from('video_frames')
      .select('*')
      .limit(1);

    if (videoFramesError && videoFramesError.code === '42P01') {
      console.log('❌ video_frames table does not exist');
      console.log('Please create it in your Supabase dashboard with this SQL:');
      console.log(`
CREATE TABLE video_frames (
  id BIGSERIAL PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  frame_data TEXT NOT NULL,
  size INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_video_frames_device_created
ON video_frames(device_id, created_at DESC);
      `);
    } else {
      console.log('✅ video_frames table exists');
    }

    // Check device_logs table
    const { data: deviceLogsTable, error: deviceLogsError } = await supabase
      .from('device_logs')
      .select('*')
      .limit(1);

    if (deviceLogsError && deviceLogsError.code === '42P01') {
      console.log('❌ device_logs table does not exist');
      console.log('Please create it in your Supabase dashboard with this SQL:');
      console.log(`
CREATE TABLE device_logs (
  id BIGSERIAL PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  camera_enabled BOOLEAN DEFAULT FALSE,
  streaming_active BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_device_logs_device_created
ON device_logs(device_id, created_at DESC);
      `);
    } else {
      console.log('✅ device_logs table exists');
    }

    console.log('\n🎉 Database setup check completed!');
    console.log('If you saw any ❌ errors above, please:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Click "SQL Editor"');
    console.log('3. Run the SQL commands shown above');

  } catch (error) {
    console.error('Error checking database:', error.message);
    console.log('\nTo create tables manually:');
    console.log('1. Go to https://ysoqstmjrpyzdwkmtuyf.supabase.co');
    console.log('2. Click "SQL Editor"');
    console.log('3. Run the SQL commands to create the tables');
  }
}

// Run setup if called directly
if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase };
