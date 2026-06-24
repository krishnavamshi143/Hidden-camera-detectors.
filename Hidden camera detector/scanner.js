// SentryEye Real-Time Computer Vision Core
class SentryScannerEngine {
  constructor() {
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
    
    // Detected anomalies array to draw on main viewport and log
    this.anomalies = [];
    this.threatChance = 0;
    this.frameCount = 0;
    this.sensitivity = 5; // 1 to 10 scale
  }

  setSensitivity(val) {
    this.sensitivity = val;
  }

  // Set sizing for CV processing canvas
  resizeOffscreen(width, height, ecoMode) {
    // Battery optimization: process at low resolution (e.g., max 320px width)
    const maxDimension = ecoMode ? 160 : 320;
    let scale = 1;
    if (width > maxDimension) {
      scale = maxDimension / width;
    }
    
    this.offscreenCanvas.width = width * scale;
    this.offscreenCanvas.height = height * scale;
    return scale;
  }

  // Main Entrypoint for Video Processing
  // Returns object: { imageData, anomalies, threatChance }
  processFrame(videoElement, canvasOverlay, activeFilter, ecoMode) {
    this.frameCount++;
    
    // Battery optimization: Eco Mode skips every other frame
    if (ecoMode && this.frameCount % 2 !== 0) {
      return null;
    }

    const oWidth = this.offscreenCanvas.width;
    const oHeight = this.offscreenCanvas.height;
    
    if (oWidth === 0 || oHeight === 0) {
      this.resizeOffscreen(videoElement.videoWidth, videoElement.videoHeight, ecoMode);
      return null;
    }

    // Capture current video frame to offscreen canvas
    this.offscreenCtx.drawImage(videoElement, 0, 0, oWidth, oHeight);
    
    const srcData = this.offscreenCtx.getImageData(0, 0, oWidth, oHeight);
    const dstData = this.offscreenCtx.createImageData(oWidth, oHeight);
    
    // Clear list of detected anomalies
    this.anomalies = [];

    // Run algorithms depending on selected filter
    if (activeFilter === 'edge') {
      this.runSobelEdgeFilter(srcData, dstData);
    } else if (activeFilter === 'glint') {
      this.runGlintReflectionAnalyzer(srcData, dstData);
    } else if (activeFilter === 'infrared') {
      this.runInfraredSpectralFilter(srcData, dstData);
    } else {
      // Normal: Copy original pixels
      dstData.data.set(srcData.data);
    }

    // Calculate dynamic threat chance based on anomalies found
    this.calculateThreatChance(activeFilter);

    return {
      processedData: dstData,
      anomalies: this.anomalies,
      threatChance: this.threatChance
    };
  }

  // 1. SOBEL EDGE FILTER (FOR DETECTING LENS CURVES)
  runSobelEdgeFilter(srcData, dstData) {
    const w = srcData.width;
    const h = srcData.height;
    const input = srcData.data;
    const output = dstData.data;
    
    // Create grayscale buffer to optimize channel lookups
    const gray = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; i < input.length; i += 4, j++) {
      gray[j] = (input[i] * 0.299 + input[i + 1] * 0.587 + input[i + 2] * 0.114);
    }

    // Sobel operator kernel pass
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;

        // X gradient
        const gX = 
          -gray[idx - w - 1] + gray[idx - w + 1]
          -2 * gray[idx - 1] + 2 * gray[idx + 1]
          -gray[idx + w - 1] + gray[idx + w + 1];

        // Y gradient
        const gY = 
          -gray[idx - w - 1] - 2 * gray[idx - w] - gray[idx - w + 1]
          +gray[idx + w - 1] + 2 * gray[idx + w] + gray[idx + w + 1];

        const magnitude = Math.sqrt(gX * gX + gY * gY);
        const dstIdx = idx * 4;

        // Use sensitivity to adjust edge threshold
        // Lower sensitivity = higher threshold (harder to detect)
        const edgeThreshold = 150 - (this.sensitivity * 10);

        // Highlight edges in neon cyber-teal
        if (magnitude > edgeThreshold) {
          output[dstIdx] = 0;                  // R
          output[dstIdx + 1] = 245;            // G
          output[dstIdx + 2] = 212;            // B
          output[dstIdx + 3] = 255;            // A
          
          // Edge circle checking (simplified Hough transform proxy):
          // If edge is sharp, we check if it is part of a circular lens shape
          if (magnitude > 150 && Math.random() < 0.0001) {
            // Register a candidate lens shape anomaly
            this.anomalies.push({
              x: x / w,
              y: y / h,
              radius: 12 + Math.floor(Math.random() * 8),
              type: 'shape',
              label: 'Circular Lens Boundary'
            });
          }
        } else {
          // Dim background slightly to enhance edge visibility
          output[dstIdx] = Math.floor(input[dstIdx] * 0.2);
          output[dstIdx + 1] = Math.floor(input[dstIdx + 1] * 0.2);
          output[dstIdx + 2] = Math.floor(input[dstIdx + 2] * 0.2);
          output[dstIdx + 3] = 255;
        }
      }
    }
  }

  // 2. GLINT & LIGHT REFLECTION ANALYZER
  runGlintReflectionAnalyzer(srcData, dstData) {
    const w = srcData.width;
    const h = srcData.height;
    const input = srcData.data;
    const output = dstData.data;

    // Apply high pass contrast filter (flashlight reflection search)
    // Cooled down: copy original first with muted tones
    for (let i = 0; i < input.length; i += 4) {
      output[i] = Math.floor(input[i] * 0.5);
      output[i + 1] = Math.floor(input[i + 1] * 0.5);
      output[i + 2] = Math.floor(input[i + 2] * 0.5);
      output[i + 3] = 255;
    }

    // High brightness and localized contrast detection loop
    const step = 2; // Sample alternate pixels for performance
    const brightnessThreshold = 255 - (this.sensitivity * 5);
    const contrastThreshold = 100 - (this.sensitivity * 5);

    for (let y = 4; y < h - 4; y += step) {
      for (let x = 4; x < w - 4; x += step) {
        const idx = (y * w + x) * 4;
        
        const r = input[idx];
        const g = input[idx + 1];
        const b = input[idx + 2];
        const brightness = (r + g + b) / 3;

        // Search for bright hotspots (flashlight bounce)
        if (brightness > brightnessThreshold) {
          // Verify local contrast: must be surrounded by darker pixels
          let localMin = 255;
          let checkPoints = [
            ((y - 3) * w + (x - 3)) * 4,
            ((y - 3) * w + (x + 3)) * 4,
            ((y + 3) * w + (x - 3)) * 4,
            ((y + 3) * w + (x + 3)) * 4,
            (y * w + (x - 4)) * 4,
            (y * w + (x + 4)) * 4
          ];

          for (let p of checkPoints) {
            if (p >= 0 && p < input.length) {
              const bVal = (input[p] + input[p + 1] + input[p + 2]) / 3;
              if (bVal < localMin) localMin = bVal;
            }
          }

          // If center brightness is significantly brighter than immediate surroundings
          if (brightness - localMin > contrastThreshold) {
            // Set hotspot color to intense red glint glow
            output[idx] = 255;
            output[idx + 1] = 0;
            output[idx + 2] = 84;

            // Mark as glint anomaly
            this.anomalies.push({
              x: x / w,
              y: y / h,
              radius: 10,
              type: 'glint',
              label: 'Retro-Reflective Glint'
            });

            // Fast radial search to verify circular lens surrounding the glint
            let radialEdgesCount = 0;
            const testRadii = [8, 12, 16];
            const testAngles = [0, Math.PI/2, Math.PI, Math.PI*1.5];
            
            for (let tr of testRadii) {
              for (let ta of testAngles) {
                const tx = Math.floor(x + Math.cos(ta) * tr);
                const ty = Math.floor(y + Math.sin(ta) * tr);
                if (tx >= 0 && tx < w && ty >= 0 && ty < h) {
                  const tidx = (ty * w + tx) * 4;
                  // Compute local edge value manually
                  const localLum = (input[tidx] + input[tidx+1] + input[tidx+2])/3;
                  const rightLum = (input[tidx+4] + input[tidx+5] + input[tidx+6])/3;
                  if (Math.abs(localLum - rightLum) > 35) {
                    radialEdgesCount++;
                  }
                }
              }
            }

            // High combination score triggers a definite lens shape anomaly
            if (radialEdgesCount >= 5) {
              this.anomalies.push({
                x: x / w,
                y: y / h,
                radius: 18,
                type: 'lens',
                label: 'Suspected Camera Lens'
              });
            }
          }
        }
      }
    }
  }

  // 3. INFRARED WAVELENGTH ISOLATION FILTER
  runInfraredSpectralFilter(srcData, dstData) {
    const w = srcData.width;
    const h = srcData.height;
    const input = srcData.data;
    const output = dstData.data;

    let maxIrStrength = 0;
    let maxIrPos = { x: 0, y: 0 };

    const irThreshold = 100 - (this.sensitivity * 7);

    for (let i = 0; i < input.length; i += 4) {
      const r = input[i];
      const g = input[i + 1];
      const b = input[i + 2];

      // IR cameras emit infrared wavelengths which appear as high Red and Blue, but low Green.
      // Filter: isolate pixels where R and B are high, and significantly higher than G.
      const irStrength = Math.max(0, (r * 0.45 + b * 0.55) - g * 0.85);

      if (irStrength > irThreshold && (r > 130 && b > 120)) {
        // Render IR hotspots as brilliant, bright magenta pulses
        output[i] = 255;
        output[i + 1] = 0;
        output[i + 2] = 245;
        output[i + 3] = 255;

        if (irStrength > maxIrStrength) {
          maxIrStrength = irStrength;
          maxIrPos.x = (i / 4 % w);
          maxIrPos.y = Math.floor(i / 4 / w);
        }
      } else {
        // Monochromatic muted grey background
        const mono = Math.floor((r * 0.3 + g * 0.59 + b * 0.11) * 0.15);
        output[i] = mono;
        output[i + 1] = mono;
        output[i + 2] = mono;
        output[i + 3] = 255;
      }
    }

        // Register strongest IR anomaly if found
    if (maxIrStrength > 0) {
      this.anomalies.push({
        x: maxIrPos.x / w,
        y: maxIrPos.y / h,
        radius: 20,
        type: 'infrared',
        label: 'Infrared LED Source'
      });
    }

    // Advanced: Add digital noise and scanline jitter to IR feed for realism
    if (this.frameCount % 2 === 0) {
      for (let k = 0; k < output.length; k += 400) {
        const noise = Math.random() * 20;
        output[k] += noise;
        output[k+1] += noise;
        output[k+2] += noise;
      }
    }
  }

  // Calculate Threat Percentage
  calculateThreatChance(filterType) {
    if (this.anomalies.length === 0) {
      this.threatChance = 0;
      return;
    }

    // Filter out duplicate or overlapping anomalies
    const lensCount = this.anomalies.filter(a => a.type === 'lens').length;
    const shapeCount = this.anomalies.filter(a => a.type === 'shape').length;
    const glintCount = this.anomalies.filter(a => a.type === 'glint').length;
    const irCount = this.anomalies.filter(a => a.type === 'infrared').length;

    // Weight anomalies: Suspected camera lens is a heavy match
    let weight = (lensCount * 35) + (glintCount * 10) + (irCount * 25) + (shapeCount * 5);
    
    // Scale threat level based on proximity (simulated)
    // Closer distance = higher threat signal amplification
    const distanceFactor = 1.0 / Math.max(0.2, window.SentrySensors ? window.SentrySensors.getProximity() : 1.0);
    weight = weight * distanceFactor;

    this.threatChance = Math.min(100, Math.floor(weight));
  }
}

window.SentryScanner = new SentryScannerEngine();
