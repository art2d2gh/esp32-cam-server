/**
 * ESP32-CAM Server Test Script
 * 
 * This script simulates an ESP32-CAM device for testing purposes.
 * Run this alongside your server to test the functionality.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const SERVER_URL = 'https://esp32-cam-server.vercel.app';
const DEVICE_ID = 'test_esp32_cam_001';

class ESP32CamSimulator {
    constructor() {
        this.cameraEnabled = false;
        this.streamingActive = false;
        this.heartbeatInterval = null;
        this.streamInterval = null;
    }

    async start() {
        console.log('🚀 Starting ESP32-CAM Simulator...');
        console.log(`📡 Server URL: ${SERVER_URL}`);
        console.log(`🆔 Device ID: ${DEVICE_ID}`);
        
        // Start heartbeat
        this.startHeartbeat();
        
        // Simulate camera turning on after 3 seconds
        setTimeout(() => {
            this.cameraEnabled = true;
            console.log('📷 Camera enabled');
        }, 3000);
        
        // Start streaming after 5 seconds
        setTimeout(() => {
            this.streamingActive = true;
            this.startStreaming();
            console.log('🎥 Streaming started');
        }, 5000);
    }

    startHeartbeat() {
        this.heartbeatInterval = setInterval(async () => {
            try {
                const response = await axios.post(`${SERVER_URL}/api/heartbeat`, {
                    device_id: DEVICE_ID,
                    camera_enabled: this.cameraEnabled,
                    streaming_active: this.streamingActive,
                    timestamp: Date.now()
                });

                console.log(`💓 Heartbeat sent - Status: ${response.status}`);
                
                // Check for commands
                if (response.data.command) {
                    console.log(`📨 Received command: ${response.data.command}`);
                    this.handleCommand(response.data.command);
                }
                
            } catch (error) {
                console.error('❌ Heartbeat failed:', error.message);
            }
        }, 5000); // Every 5 seconds
    }

    startStreaming() {
        if (!this.cameraEnabled || !this.streamingActive) return;
        
        this.streamInterval = setInterval(async () => {
            if (this.cameraEnabled && this.streamingActive) {
                await this.sendFrame();
            }
        }, 1000); // Send frame every second
    }

    stopStreaming() {
        if (this.streamInterval) {
            clearInterval(this.streamInterval);
            this.streamInterval = null;
        }
    }

    async sendFrame() {
        try {
            // Create a simple test image (1x1 pixel JPEG)
            const testImageBuffer = this.createTestImage();
            
            const response = await axios.post(`${SERVER_URL}/api/stream`, testImageBuffer, {
                headers: {
                    'Content-Type': 'image/jpeg',
                    'X-Device-ID': DEVICE_ID
                }
            });

            console.log(`📸 Frame sent - Size: ${testImageBuffer.length} bytes, ID: ${response.data.frameId}`);
            
        } catch (error) {
            console.error('❌ Frame upload failed:', error.message);
        }
    }

    createTestImage() {
        // Minimal JPEG header for a 1x1 pixel image
        const jpegHeader = Buffer.from([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
            0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
            0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
            0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
            0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
            0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
            0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
            0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
            0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
            0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xFF, 0xC4,
            0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C,
            0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0x8A, 0x00,
            0xFF, 0xD9
        ]);
        
        return jpegHeader;
    }

    handleCommand(command) {
        switch (command) {
            case 'camera_on':
                this.cameraEnabled = true;
                console.log('📷 Camera turned ON');
                break;
            case 'camera_off':
                this.cameraEnabled = false;
                this.streamingActive = false;
                this.stopStreaming();
                console.log('📷 Camera turned OFF');
                break;
            case 'start_stream':
                if (this.cameraEnabled) {
                    this.streamingActive = true;
                    this.startStreaming();
                    console.log('🎥 Streaming started');
                }
                break;
            case 'stop_stream':
                this.streamingActive = false;
                this.stopStreaming();
                console.log('🎥 Streaming stopped');
                break;
            default:
                console.log(`❓ Unknown command: ${command}`);
        }
    }

    stop() {
        console.log('🛑 Stopping ESP32-CAM Simulator...');
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        if (this.streamInterval) {
            clearInterval(this.streamInterval);
        }
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down simulator...');
    process.exit(0);
});

// Start the simulator
const simulator = new ESP32CamSimulator();
simulator.start();

console.log('\n📋 Test Commands:');
console.log('- Open http://localhost:3000 in your browser');
console.log('- Select "test_esp32_cam_001" from the device dropdown');
console.log('- Try the camera control buttons');
console.log('- Watch the console for command responses');
console.log('- Press Ctrl+C to stop the simulator\n');
