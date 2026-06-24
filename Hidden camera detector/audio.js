// SentryEye Web Audio Synthesizer Engine
class SentryAudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.intervalId = null;
    this.threatLevel = 0; // 0 to 100
    this.currentDelay = 1000;
  }

  // Initialize Audio Context on user interaction
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      console.log("Audio Context initialized successfully.");
      this.startLoop();
    } catch (e) {
      console.warn("Web Audio API not supported in this browser:", e);
    }
  }

  setMute(mute) {
    this.isMuted = mute;
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Adjust threat level (0 - 100) to speed up or slow down beeps
  setThreatLevel(level) {
    this.threatLevel = Math.max(0, Math.min(100, level));
    
    // Scale threat level to a millisecond tick delay
    // 0% threat = 1000ms delay (steady idle ping)
    // 100% threat = 40ms delay (virtually continuous alarm)
    if (this.threatLevel === 0) {
      this.currentDelay = 1000;
    } else if (this.threatLevel < 20) {
      this.currentDelay = 600 - (this.threatLevel * 15); // 600ms down to 300ms
    } else if (this.threatLevel < 70) {
      this.currentDelay = 300 - ((this.threatLevel - 20) * 4.4); // 300ms down to 80ms
    } else {
      this.currentDelay = 80 - ((this.threatLevel - 70) * 1.3); // 80ms down to 40ms
    }
  }

  // Emit a single technical click/beep
  playTick() {
    if (!this.ctx || this.isMuted) return;

    // Resume if context got suspended (browser security)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);
    
    // Low threat = dry clicks; High threat = high-frequency warning tones
    if (this.threatLevel < 25) {
      // Short woodblock-style click
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      gainNode.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.015);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.02);
    } else if (this.threatLevel < 70) {
      // Rapid beeping
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1000, this.ctx.currentTime);
      gainNode.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } else {
      // High-alert alarming tone
      osc.type = 'sine';
      // Add a slight frequency modulation sweep for extra emergency feel
      osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1800, this.ctx.currentTime + 0.06);
      
      gainNode.gain.setValueAtTime(0.18, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.07);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    }
  }

  // Play a confirmed lock-on sound
  playLockSound() {
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  // Loop runner using setTimeout to allow dynamic rate updates
  startLoop() {
    const run = () => {
      this.playTick();
      this.intervalId = setTimeout(run, this.currentDelay);
    };
    run();
  }

  stop() {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
  }
}

// Global instance exports
window.SentryAudio = new SentryAudioEngine();
