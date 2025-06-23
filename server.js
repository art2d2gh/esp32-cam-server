const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const multer = require('multer');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for deployment platforms
app.set('trust proxy', 1);

// Supabase connection (with fallback for testing)
let supabase = null;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY &&
      process.env.SUPABASE_ANON_KEY !== 'your_anon_key_here') {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    console.log('✅ Supabase connection configured');
  } else {
    console.log('⚠️  No Supabase configured - running in memory-only mode');
  }
} catch (error) {
  console.log('⚠️  Supabase connection failed - running in memory-only mode');
  supabase = null;
}

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(morgan('combined'));

// Parse JSON for most endpoints
app.use('/api', (req, res, next) => {
  if (req.path === '/stream') {
    // For /api/stream, parse as raw buffer
    express.raw({ type: '*/*', limit: '10mb' })(req, res, next);
  } else {
    // For other endpoints, parse as JSON
    express.json({ limit: '10mb' })(req, res, next);
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Explicit routes for static files (Vercel compatibility)
app.get('/style.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'style.css'));
});

app.get('/app.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.js'));
});

// Configure multer for handling video frames
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Device status storage (in-memory for now)
const deviceStatus = new Map();

// In-memory frame storage (fallback when no database)
const frameStorage = new Map();

// Utility function to log with timestamp
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Database helper functions
async function saveFrame(deviceId, frameData, metadata = {}) {
  try {
    if (supabase) {
      // Save to Supabase
      const { data, error } = await supabase
        .from('video_frames')
        .insert({
          device_id: deviceId,
          frame_data: frameData.toString('base64'), // Convert buffer to base64
          size: frameData.length,
          metadata: metadata
        })
        .select('id, created_at')
        .single();

      if (error) throw error;
      return data;
    } else {
      // Save to memory
      const frameId = Date.now();
      const frame = {
        id: frameId,
        device_id: deviceId,
        frame_data: frameData,
        size: frameData.length,
        metadata: metadata,
        created_at: new Date().toISOString()
      };

      if (!frameStorage.has(deviceId)) {
        frameStorage.set(deviceId, []);
      }

      const deviceFrames = frameStorage.get(deviceId);
      deviceFrames.push(frame);

      // Keep only last 50 frames per device
      if (deviceFrames.length > 50) {
        deviceFrames.shift();
      }

      return { id: frameId, created_at: frame.created_at };
    }
  } catch (error) {
    log(`Error saving frame: ${error.message}`);
    throw error;
  }
}

async function getLatestFrame(deviceId) {
  try {
    if (supabase) {
      // Get from Supabase
      const { data, error } = await supabase
        .from('video_frames')
        .select('id, device_id, frame_data, size, metadata, created_at')
        .eq('device_id', deviceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows

      if (data && data.frame_data) {
        // Convert base64 back to buffer
        data.frame_data = Buffer.from(data.frame_data, 'base64');
      }

      return data;
    } else {
      // Get from memory
      const deviceFrames = frameStorage.get(deviceId);
      if (deviceFrames && deviceFrames.length > 0) {
        return deviceFrames[deviceFrames.length - 1];
      }
      return null;
    }
  } catch (error) {
    log(`Error getting latest frame: ${error.message}`);
    throw error;
  }
}

async function getFrameHistory(deviceId, limit = 50) {
  try {
    const query = `
      SELECT id, device_id, size, metadata, created_at
      FROM video_frames
      WHERE device_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    const result = await pool.query(query, [deviceId, limit]);
    return result.rows;
  } catch (error) {
    log(`Error getting frame history: ${error.message}`);
    throw error;
  }
}

// Routes

// Serve web interface
app.get('/', (req, res) => {
  // Check if request accepts HTML (browser request)
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    // API request - return JSON status
    res.json({
      status: 'ESP32-CAM Server Running',
      timestamp: new Date().toISOString(),
      connectedDevices: deviceStatus.size
    });
  }
});

// Receive video frames from ESP32-CAM
app.post('/api/stream', upload.single('frame'), async (req, res) => {
  try {
    const deviceId = req.headers['x-device-id'] || 'unknown';

    let frameData;

    // Handle different ways frame data can be sent
    if (req.file && req.file.buffer) {
      // Multipart form data (from real ESP32-CAM)
      frameData = req.file.buffer;
    } else if (Buffer.isBuffer(req.body)) {
      // Raw buffer data (from test simulator)
      frameData = req.body;
    } else if (req.body && typeof req.body === 'object' && req.body.type === 'Buffer') {
      // Buffer sent as JSON (from test simulator)
      frameData = Buffer.from(req.body.data || req.body);
    } else {
      // Try to convert whatever we got to a buffer
      frameData = Buffer.from(req.body || '');
    }

    if (!frameData || frameData.length === 0) {
      return res.status(400).json({ error: 'No frame data received' });
    }

    // Save frame to database
    const savedFrame = await saveFrame(deviceId, frameData, {
      userAgent: req.headers['user-agent'],
      contentType: req.headers['content-type'],
      timestamp: Date.now()
    });

    log(`Received frame from ${deviceId}: ${frameData.length} bytes, saved as ID ${savedFrame.id}`);

    res.json({
      status: 'success',
      frameId: savedFrame.id,
      size: frameData.length,
      timestamp: savedFrame.created_at
    });

  } catch (error) {
    log(`Error processing stream: ${error.message}`);
    res.status(500).json({ error: 'Failed to process frame' });
  }
});

// Receive heartbeat from ESP32-CAM
app.post('/api/heartbeat', async (req, res) => {
  try {
    const { device_id, camera_enabled, streaming_active, timestamp } = req.body;

    // Get existing device status to preserve pending commands
    const existingDevice = deviceStatus.get(device_id) || {};

    // Update device status
    const updatedDevice = {
      lastSeen: new Date().toISOString(),
      cameraEnabled: camera_enabled,
      streamingActive: streaming_active,
      deviceTimestamp: timestamp,
      ip: req.ip,
      pendingCommand: existingDevice.pendingCommand,
      commandTimestamp: existingDevice.commandTimestamp
    };

    deviceStatus.set(device_id, updatedDevice);

    log(`Heartbeat from ${device_id}: camera=${camera_enabled}, streaming=${streaming_active}`);

    // Prepare response
    const response = { status: 'ok' };

    // Send pending command if available
    if (existingDevice.pendingCommand) {
      response.command = existingDevice.pendingCommand;
      log(`Sending command to ${device_id}: ${existingDevice.pendingCommand}`);

      // Clear the pending command after sending
      updatedDevice.pendingCommand = null;
      updatedDevice.commandTimestamp = null;
      deviceStatus.set(device_id, updatedDevice);
    }

    res.json(response);

  } catch (error) {
    log(`Error processing heartbeat: ${error.message}`);
    res.status(500).json({ error: 'Failed to process heartbeat' });
  }
});

// Get device status
app.get('/api/devices', (req, res) => {
  const devices = {};
  deviceStatus.forEach((status, deviceId) => {
    devices[deviceId] = status;
  });
  res.json(devices);
});

// Get latest frame for a device
app.get('/api/frames/:deviceId/latest', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const frame = await getLatestFrame(deviceId);
    
    if (!frame) {
      return res.status(404).json({ error: 'No frames found for device' });
    }

    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Length': frame.frame_data.length,
      'X-Frame-ID': frame.id,
      'X-Timestamp': frame.created_at
    });
    
    res.send(frame.frame_data);

  } catch (error) {
    log(`Error serving latest frame: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve frame' });
  }
});

// Get frame history for a device
app.get('/api/frames/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const frames = await getFrameHistory(deviceId, limit);
    
    res.json({
      deviceId,
      totalFrames: frames.length,
      frames: frames.map(frame => ({
        id: frame.id,
        size: frame.size,
        metadata: frame.metadata,
        timestamp: frame.created_at
      }))
    });

  } catch (error) {
    log(`Error getting frame history: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve frame history' });
  }
});

// Get specific frame by ID
app.get('/api/frames/:deviceId/:frameId', async (req, res) => {
  try {
    const { deviceId, frameId } = req.params;
    
    const query = `
      SELECT frame_data, created_at
      FROM video_frames
      WHERE device_id = $1 AND id = $2
    `;
    const result = await pool.query(query, [deviceId, frameId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Frame not found' });
    }

    const frame = result.rows[0];
    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Length': frame.frame_data.length,
      'X-Timestamp': frame.created_at
    });
    
    res.send(frame.frame_data);

  } catch (error) {
    log(`Error serving frame: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve frame' });
  }
});

// Send control commands to devices
app.post('/api/control/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    const { command } = req.body;
    
    if (!deviceStatus.has(deviceId)) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Store command for device to pick up on next heartbeat
    const device = deviceStatus.get(deviceId);
    device.pendingCommand = command;
    device.commandTimestamp = new Date().toISOString();
    deviceStatus.set(deviceId, device);

    log(`Control command for ${deviceId}: ${command}`);
    
    res.json({
      status: 'command_queued',
      deviceId,
      command,
      timestamp: device.commandTimestamp
    });

  } catch (error) {
    log(`Error processing control command: ${error.message}`);
    res.status(500).json({ error: 'Failed to process command' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  log(`Unhandled error: ${error.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  log(`ESP32-CAM Server running on port ${PORT}`);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
