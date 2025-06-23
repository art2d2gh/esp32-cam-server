class ESP32CamController {
    constructor() {
        this.selectedDevice = null;
        this.streamInterval = null;
        this.deviceRefreshInterval = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.startDeviceRefresh();
        this.updateServerTime();
        this.log('ESP32-CAM Controller initialized');
    }

    bindEvents() {
        // Device selection
        document.getElementById('device-select').addEventListener('change', (e) => {
            this.selectedDevice = e.target.value;
            this.updateDeviceStatus();
            if (this.selectedDevice) {
                this.startVideoStream();
            } else {
                this.stopVideoStream();
            }
        });

        // Control buttons
        document.getElementById('camera-on-btn').addEventListener('click', () => {
            this.sendCommand('camera_on');
        });

        document.getElementById('camera-off-btn').addEventListener('click', () => {
            this.sendCommand('camera_off');
        });

        document.getElementById('start-stream-btn').addEventListener('click', () => {
            this.sendCommand('start_stream');
        });

        document.getElementById('stop-stream-btn').addEventListener('click', () => {
            this.sendCommand('stop_stream');
        });

        // Refresh buttons
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.refreshVideoStream();
        });

        document.getElementById('refresh-devices-btn').addEventListener('click', () => {
            this.refreshDevices();
        });

        document.getElementById('clear-log-btn').addEventListener('click', () => {
            this.clearLog();
        });

        // Video stream error handling
        document.getElementById('video-stream').addEventListener('load', () => {
            this.hideVideoOverlay();
            this.updateConnectionStatus(true);
        });

        document.getElementById('video-stream').addEventListener('error', () => {
            this.showVideoOverlay();
            this.log('Failed to load video frame', 'error');
        });
    }

    async refreshDevices() {
        try {
            const response = await fetch('/api/devices');
            const devices = await response.json();
            
            const select = document.getElementById('device-select');
            select.innerHTML = '';
            
            if (Object.keys(devices).length === 0) {
                select.innerHTML = '<option value="">No devices found</option>';
                this.log('No devices currently connected');
            } else {
                Object.keys(devices).forEach(deviceId => {
                    const option = document.createElement('option');
                    option.value = deviceId;
                    option.textContent = `${deviceId} (${devices[deviceId].cameraEnabled ? 'ON' : 'OFF'})`;
                    select.appendChild(option);
                });
                this.log(`Found ${Object.keys(devices).length} device(s)`);
            }
            
            this.updateConnectionStatus(true);
        } catch (error) {
            this.log(`Error refreshing devices: ${error.message}`, 'error');
            this.updateConnectionStatus(false);
        }
    }

    async updateDeviceStatus() {
        if (!this.selectedDevice) {
            document.getElementById('device-info').innerHTML = '<p>Select a device to view status</p>';
            return;
        }

        try {
            const response = await fetch('/api/devices');
            const devices = await response.json();
            const device = devices[this.selectedDevice];
            
            if (device) {
                const statusHtml = `
                    <p><strong>Device ID:</strong> ${this.selectedDevice}</p>
                    <p><strong>Camera:</strong> ${device.cameraEnabled ? 'ON' : 'OFF'}</p>
                    <p><strong>Streaming:</strong> ${device.streamingActive ? 'ACTIVE' : 'INACTIVE'}</p>
                    <p><strong>Last Seen:</strong> ${new Date(device.lastSeen).toLocaleString()}</p>
                    <p><strong>IP Address:</strong> ${device.ip || 'Unknown'}</p>
                `;
                document.getElementById('device-info').innerHTML = statusHtml;
            } else {
                document.getElementById('device-info').innerHTML = '<p>Device not found or offline</p>';
            }
        } catch (error) {
            this.log(`Error updating device status: ${error.message}`, 'error');
        }
    }

    async sendCommand(command) {
        if (!this.selectedDevice) {
            this.log('Please select a device first', 'warning');
            return;
        }

        try {
            const response = await fetch(`/api/control/${this.selectedDevice}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ command })
            });

            const result = await response.json();
            
            if (response.ok) {
                this.log(`Command sent: ${command}`, 'success');
            } else {
                this.log(`Command failed: ${result.error}`, 'error');
            }
        } catch (error) {
            this.log(`Error sending command: ${error.message}`, 'error');
        }
    }

    startVideoStream() {
        if (!this.selectedDevice) return;
        
        this.stopVideoStream();
        this.showVideoOverlay();
        
        this.streamInterval = setInterval(() => {
            this.updateVideoFrame();
        }, 1000); // Update every second
        
        this.updateVideoFrame(); // Initial load
        this.log(`Started video stream for ${this.selectedDevice}`);
    }

    stopVideoStream() {
        if (this.streamInterval) {
            clearInterval(this.streamInterval);
            this.streamInterval = null;
        }
        this.showVideoOverlay();
        this.log('Video stream stopped');
    }

    async updateVideoFrame() {
        if (!this.selectedDevice) return;

        try {
            const timestamp = Date.now();
            const imageUrl = `/api/frames/${this.selectedDevice}/latest?t=${timestamp}`;
            
            const img = document.getElementById('video-stream');
            img.src = imageUrl;
            
            document.getElementById('frame-info').textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
            
        } catch (error) {
            this.log(`Error updating video frame: ${error.message}`, 'error');
        }
    }

    refreshVideoStream() {
        if (this.selectedDevice) {
            this.updateVideoFrame();
            this.log('Video stream refreshed manually');
        }
    }

    showVideoOverlay() {
        document.getElementById('video-overlay').style.display = 'flex';
    }

    hideVideoOverlay() {
        document.getElementById('video-overlay').style.display = 'none';
    }

    startDeviceRefresh() {
        this.refreshDevices();
        this.deviceRefreshInterval = setInterval(() => {
            this.refreshDevices();
            this.updateDeviceStatus();
        }, 5000); // Refresh every 5 seconds
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connection-status');
        if (connected) {
            statusElement.textContent = 'Connected';
            statusElement.className = 'status online';
        } else {
            statusElement.textContent = 'Disconnected';
            statusElement.className = 'status offline';
        }
    }

    updateServerTime() {
        setInterval(() => {
            document.getElementById('server-time').textContent = new Date().toLocaleString();
        }, 1000);
    }

    log(message, type = 'info') {
        const logContainer = document.getElementById('activity-log');
        const logEntry = document.createElement('p');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
        
        // Keep only last 100 log entries
        while (logContainer.children.length > 100) {
            logContainer.removeChild(logContainer.firstChild);
        }
    }

    clearLog() {
        document.getElementById('activity-log').innerHTML = '';
        this.log('Log cleared');
    }
}

// Initialize the controller when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ESP32CamController();
});
