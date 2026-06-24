// SentryEye Sensor Integration and Calibration Engine
class SentrySensorsEngine {
  constructor() {
    this.speedState = "STEADY"; // "STEADY", "SWEEPING", "TOO FAST"
    this.speedVal = 10; // Numeric percentage for HUD bar
    this.proximityVal = 1.4; // Default starting calibration (in meters)
    
    this.lastX = null;
    this.lastY = null;
    this.lastZ = null;
    this.lastUpdate = 0;
    this.initialized = false;
  }

  // Ask for and initialize motion detectors
  async init() {
    if (this.initialized) return;

    // iOS 13+ requires explicit permissions for DeviceMotionEvent
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const permissionState = await DeviceMotionEvent.requestPermission();
        if (permissionState === 'granted') {
          this.startMotionListener();
          this.initialized = true;
        } else {
          console.warn("Motion sensor permission denied.");
        }
      } catch (error) {
        console.error("Error requesting motion permission:", error);
      }
    } else {
      // Standard Android/Chrome or older iOS
      this.startMotionListener();
      this.initialized = true;
    }
  }

  startMotionListener() {
    window.addEventListener('devicemotion', (event) => {
      const acceleration = event.accelerationIncludingGravity;
      if (!acceleration) return;

      const curTime = Date.now();
      // Rate limit updates to 100ms
      if ((curTime - this.lastUpdate) > 100) {
        const diffTime = curTime - this.lastUpdate;
        this.lastUpdate = curTime;

        const x = acceleration.x;
        const y = acceleration.y;
        const z = acceleration.z;

        if (this.lastX !== null) {
          // Calculate delta changes
          const deltaX = Math.abs(x - this.lastX);
          const deltaY = Math.abs(y - this.lastY);
          const deltaZ = Math.abs(z - this.lastZ);
          
          const speed = (deltaX + deltaY + deltaZ) / diffTime * 10000;

          // Map speed to user-friendly speed states
          if (speed < 12) {
            this.speedState = "STEADY";
            this.speedVal = 8 + (speed * 1.5);
          } else if (speed < 35) {
            this.speedState = "SWEEPING";
            this.speedVal = 20 + ((speed - 12) * 2);
          } else {
            this.speedState = "TOO FAST";
            this.speedVal = 70 + Math.min(30, (speed - 35));
          }
        }

        this.lastX = x;
        this.lastY = y;
        this.lastZ = z;
      }
    });
  }

  // Calibrate current focal proximity distance
  setProximity(distance) {
    this.proximityVal = parseFloat(distance);
  }

  getProximity() {
    return this.proximityVal;
  }

  getSpeedState() {
    return this.speedState;
  }

  getSpeedVal() {
    return this.speedVal;
  }
}

window.SentrySensors = new SentrySensorsEngine();
