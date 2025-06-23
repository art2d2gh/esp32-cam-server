const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const multer = require('multer');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public')); // Serve static files

// Configure multer for handling video frames
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Device status storage (in-memory for now)
const deviceStatus = new Map();

// Utility function to log with timestamp
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Database helper functions
async function saveFrame(deviceId, frameData, metadata = {}) {
  try {
    const query = `
      INSERT INTO video_frames (device_id, frame_data, size, metadata, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, created_at
    `;
    const values = [deviceId, frameData, frameData.length, JSON.stringify(metadata)];
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    log(`Error saving frame: ${error.message}`);
    throw error;
  }
}

async function getLatestFrame(deviceId) {
  try {
    const query = `
      SELECT id, device_id, frame_data, size, metadata, created_at
      FROM video_frames
      WHERE device_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await pool.query(query, [deviceId]);
    return result.rows[0];
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

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ESP32-CAM Server Running',
    timestamp: new Date().toISOString(),
    connectedDevices: deviceStatus.size
  });
});

// Receive video frames from ESP32-CAM
app.post('/api/stream', upload.single('frame'), async (req, res) => {
  try {
    const deviceId = req.headers['x-device-id'] || 'unknown';
    const frameData = req.file ? req.file.buffer : req.body;
    
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
