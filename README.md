# ESP32-CAM Remote Server

A Node.js server for remote control and live video streaming from ESP32-CAM devices.

## Features

- 📹 **Live Video Streaming**: Real-time video feed from your ESP32-CAM
- 🎮 **Remote Control**: Turn camera on/off and control streaming
- 🌐 **Web Interface**: Modern, responsive web UI for easy control
- 💾 **Frame Storage**: PostgreSQL database for storing video frames
- 📊 **Device Management**: Monitor multiple ESP32-CAM devices
- 📝 **Activity Logging**: Real-time activity logs and device status

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Database Setup
You can use either a local PostgreSQL database or Supabase (recommended).

#### Option A: Supabase (Recommended)
1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings > Database and copy your connection string
4. Create a `.env` file and add your database URL:
```bash
cp .env.example .env
# Edit .env and add your Supabase DATABASE_URL
```

#### Option B: Local PostgreSQL
1. Install PostgreSQL locally
2. Create a database named `esp32cam_db`
3. Update `.env` with your local database URL

### 3. Initialize Database
```bash
npm run migrate
```

### 4. Start the Server
```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

### 5. Access the Web Interface
Open your browser and go to: `http://localhost:3000`

## ESP32-CAM Integration

Your ESP32-CAM should send:

### Heartbeat (every 30 seconds)
```http
POST /api/heartbeat
Content-Type: application/json

{
  "device_id": "esp32_cam_001",
  "camera_enabled": true,
  "streaming_active": true,
  "timestamp": 1640995200000
}
```

### Video Frames
```http
POST /api/stream
Content-Type: multipart/form-data
X-Device-ID: esp32_cam_001

[JPEG frame data]
```

### Command Response
The ESP32 should check for commands in heartbeat responses:
```json
{
  "status": "ok",
  "command": "camera_on"  // or "camera_off", "start_stream", "stop_stream"
}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Server status and web interface |
| POST | `/api/heartbeat` | Device heartbeat and command polling |
| POST | `/api/stream` | Upload video frames |
| GET | `/api/devices` | List all connected devices |
| GET | `/api/frames/:deviceId/latest` | Get latest frame from device |
| GET | `/api/frames/:deviceId` | Get frame history |
| POST | `/api/control/:deviceId` | Send control commands |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment mode | development |
| `DATABASE_URL` | PostgreSQL connection string | Required |

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run database migrations
npm run migrate
```

## Troubleshooting

### No devices showing up?
- Check that your ESP32-CAM is sending heartbeats to `/api/heartbeat`
- Verify the device_id in the heartbeat payload
- Check server logs for any errors

### Video not loading?
- Ensure ESP32-CAM is sending frames to `/api/stream`
- Check that frames are being saved (check database or server logs)
- Try refreshing the video stream manually

### Database connection issues?
- Verify your DATABASE_URL in the `.env` file
- For Supabase, ensure your project is not paused
- For local PostgreSQL, ensure the service is running

## License

MIT License - see LICENSE file for details.