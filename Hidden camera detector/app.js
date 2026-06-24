// SentryEye Main Application Controller
document.addEventListener("DOMContentLoaded", () => {
  
  // App state variables
  let currentStepIndex = 0; // 0 to 3
  let activeFilter = 'normal';
  let isFlashlightOn = false;
  let isEcoMode = false;
  let isAudioMuted = false;
  let stream = null;
  let scanAnimationId = null;
  let simulatedAnomalyActive = false;
  
  // Scanned results logs
  const scanReports = {
    corners: { checked: false, threats: [] },
    mirrors: { checked: false, threats: [] },
    bulbs: { checked: false, threats: [] },
    objects: { checked: false, threats: [] }
  };

  const stepsData = [
    {
      id: 1,
      title: "Scan Room Corners",
      desc: "Hidden cameras are frequently placed high in corners to maximize field of view. Check joints where walls meet the ceiling, vents, and wall mounts.",
      tips: [
        "Hold your phone vertically and scan slowly.",
        "Look specifically at ceiling corners and joints.",
        "Keep distance within 1.5 to 2.5 meters."
      ],
      zoneId: "corners",
      zoneTitle: "CORNERS & JOINTS"
    },
    {
      id: 2,
      title: "Scan Mirrors & Glass",
      desc: "Two-way mirrors can conceal hidden lenses. Check mirrors in bathrooms, bedrooms, and glass partitions closely.",
      tips: [
        "Activate the Glint filter and look for retro-reflections.",
        "Verify mirror depth by doing the finger-touch test.",
        "Examine mirror frames and backing for seams or holes."
      ],
      zoneId: "mirrors",
      zoneTitle: "MIRRORS & GLASS"
    },
    {
      id: 3,
      title: "Scan Bulbs & Fixtures",
      desc: "Light bulbs, lamps, and smoke detector casings are prime spots due to continuous access to power.",
      tips: [
        "Point your camera directly into bulbs and light mounts.",
        "Use the Infrared scanner to identify active night-vision LEDs.",
        "Inspect the center points of lamps and clock faces."
      ],
      zoneId: "bulbs",
      zoneTitle: "BULBS & FIXTURES"
    },
    {
      id: 4,
      title: "Scan Personal Objects",
      desc: "Check chargers, USB cubes, wall plugs, smoke detectors, tissue boxes, and shelf decorations.",
      tips: [
        "Examine charging bricks for camera holes near USB ports.",
        "Move phone within 0.5 meters for proximity detection.",
        "Use Edge detection to verify internal lens circularity."
      ],
      zoneId: "objects",
      zoneTitle: "PERSONAL OBJECTS"
    }
  ];

  // DOM Elements
  const viewHome = document.getElementById("view-home");
  const viewGuide = document.getElementById("view-guide");
  const viewScanner = document.getElementById("view-scanner");
  const viewReport = document.getElementById("view-report");

  const btnStartSweep = document.getElementById("btn-start-sweep");
  const btnPrevStep = document.getElementById("btn-prev-step");
  const btnLaunchScanner = document.getElementById("btn-launch-scanner");
  const btnScannerBack = document.getElementById("btn-scanner-back");
  const btnNextStepScan = document.getElementById("btn-next-step-scan");
  
  const videoFeed = document.getElementById("video-feed");
  const canvasOverlay = document.getElementById("canvas-overlay");
  const ctxOverlay = canvasOverlay.getContext("2d");
  const alertFlash = document.getElementById("alert-flash");

  // HUD Elements
  const scannerZoneName = document.getElementById("scanner-current-zone");
  const proximityVal = document.querySelector("#hud-metric-prox .metric-value");
  const proximityBar = document.querySelector("#hud-metric-prox .metric-progress");
  const anomalyVal = document.querySelector("#hud-metric-anomaly .metric-value");
  const anomalyBar = document.querySelector("#hud-metric-anomaly .metric-progress");
  const handVal = document.querySelector("#hud-metric-hand .metric-value");
  const handBar = document.querySelector("#hud-metric-hand .metric-progress");

  // NEW: Waveform Canvas
  const canvasWaveform = document.getElementById("canvas-waveform");
  const ctxWaveform = canvasWaveform.getContext("2d");
  let threatHistory = new Array(60).fill(0);

  // Controls Elements
  const btnToggleAudio = document.getElementById("btn-toggle-audio");
  const btnToggleFlashlight = document.getElementById("btn-toggle-flashlight");
  const btnToggleEco = document.getElementById("btn-toggle-eco");
  const batteryPill = document.getElementById("battery-saver-pill");
  const sliderDistance = document.getElementById("slider-distance");
  const sliderDistanceVal = document.getElementById("slider-distance-val");
  const sliderSensitivity = document.getElementById("slider-sensitivity");
  const sliderSensitivityVal = document.getElementById("slider-sensitivity-val");
  const btnSimulateThreat = document.getElementById("btn-simulate-threat");
  const btnLogAnomaly = document.getElementById("btn-log-anomaly");
  const filterTabs = document.querySelectorAll(".filter-tab");
  const toast = document.getElementById("status-toast");
  const toastMessage = document.getElementById("toast-message");

  // Report Elements
  const reportGaugeFill = document.getElementById("report-gauge-fill");
  const reportScoreVal = document.getElementById("report-score");
  const reportStatusBadge = document.getElementById("report-status-badge");
  const reportVerdict = document.getElementById("report-verdict");
  const reportTimestamp = document.getElementById("report-timestamp");
  const btnRestartSweep = document.getElementById("btn-restart-sweep");
  const btnShareReport = document.getElementById("btn-share-report");

  /* ----------------------------------------------------
     NAVIGATION METHODS (SPA ROUTING)
     ---------------------------------------------------- */
  function navigateTo(targetView) {
    [viewHome, viewGuide, viewScanner, viewReport].forEach(view => {
      view.classList.remove("active");
    });
    targetView.classList.add("active");
  }

  // Toast status reporter
  function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 2500);
  }

  // Load Step in Guide view
  function loadStep(index) {
    currentStepIndex = index;
    const step = stepsData[currentStepIndex];
    
    // Update texts
    document.getElementById("guide-current-step").textContent = step.id;
    document.getElementById("guide-title").textContent = step.title;
    document.getElementById("guide-desc").textContent = step.desc;
    
    // Update strategy tips list
    const tipsList = document.getElementById("guide-tips");
    tipsList.innerHTML = "";
    step.tips.forEach(tip => {
      const li = document.createElement("li");
      li.textContent = tip;
      tipsList.appendChild(li);
    });

    // Update active guide dots
    const dots = document.querySelectorAll(".step-dots .dot");
    dots.forEach((dot, dIdx) => {
      if (dIdx === currentStepIndex) dot.classList.add("active");
      else dot.classList.remove("active");
    });

    // Update wireframe visual
    const illBox = document.getElementById("guide-illustration");
    illBox.className = "illustration-box";
    illBox.innerHTML = "";
    
    const wireframe = document.createElement("div");
    wireframe.className = `room-wireframe step-${step.id}-visual`;

    // Render beautiful dynamic step layouts in mock window
    if (step.id === 1) { // Corner
      wireframe.innerHTML = `
        <div class="grid-line wall-left"></div>
        <div class="grid-line wall-right"></div>
        <div class="grid-line ceiling"></div>
        <div class="target-marker" style="top: 25%; left: 50%;"></div>
      `;
    } else if (step.id === 2) { // Mirror
      wireframe.innerHTML = `
        <div style="width:70px; height:120px; border:2px solid rgba(255,255,255,0.25); background:linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02)); border-radius:4px; position:absolute; top:25px; left:calc(50% - 35px); display:flex; justify-content:center; align-items:center;">
          <div class="target-marker" style="top:50%; left:50%; position:absolute;"></div>
        </div>
      `;
    } else if (step.id === 3) { // Bulbs
      wireframe.innerHTML = `
        <div style="width:40px; height:40px; border-radius:50%; border:2px solid rgba(255,255,255,0.25); background:radial-gradient(circle, #fff 0%, transparent 60%); position:absolute; top:40px; left:calc(50% - 20px);">
          <div class="target-marker" style="top:50%; left:50%; position:absolute;"></div>
        </div>
      `;
    } else { // Objects
      wireframe.innerHTML = `
        <div style="width:50px; height:50px; border-radius:8px; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.05); position:absolute; top:50px; left:calc(50% - 25px); display:flex; justify-content:center; align-items:center;">
          <div style="width:8px; height:16px; border:1px solid #aaa; border-radius:2px; display:inline-block; margin-right:4px;"></div>
          <div class="target-marker" style="top:45%; left:55%; position:absolute;"></div>
        </div>
      `;
    }
    illBox.appendChild(wireframe);
  }

  /* ----------------------------------------------------
     CAMERA STREAM HANDLING & FRAME PROCESSING
     ---------------------------------------------------- */
  async function startScanner() {
    navigateTo(viewScanner);
    
    // Set scanner titles
    const step = stepsData[currentStepIndex];
    scannerZoneName.textContent = step.zoneTitle;

    // Reset simulator and sensors
    simulatedAnomalyActive = false;
    btnSimulateThreat.classList.remove("btn-primary");
    btnSimulateThreat.textContent = "SIMULATE ANOMALY";
    
    // Adjust next step scan button label
    if (currentStepIndex === stepsData.length - 1) {
      btnNextStepScan.querySelector("span").textContent = "COMPILE REPORT";
    } else {
      btnNextStepScan.querySelector("span").textContent = "NEXT STEP";
    }

    // Try starting camera
    try {
      const constraints = {
        video: {
          facingMode: "environment", // Preferred back camera
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      };

      stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoFeed.srcObject = stream;
      videoFeed.setAttribute("playsinline", true);
      videoFeed.play();

      // Hook metadata loaded to size canvases
      videoFeed.onloadedmetadata = () => {
        setupCanvases();
        startScanLoop();
      };
      
      showToast("Camera scanner active. Slow sweeps.");
      
    } catch (err) {
      console.error("Camera access failed, running fallback simulation mode:", err);
      showToast("Camera blocked. Running mock simulation.");
      
      // Fallback: render dummy video frames
      runMockVideoFeed();
    }
  }

  function stopScanner() {
    if (scanAnimationId) {
      cancelAnimationFrame(scanAnimationId);
      scanAnimationId = null;
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    videoFeed.srcObject = null;
    
    // Stop sound alarm when leaving scanner
    window.SentryAudio.setThreatLevel(0);
  }

  function setupCanvases() {
    // Make visible overlay canvas match video viewport bounds
    const rect = videoFeed.getBoundingClientRect();
    canvasOverlay.width = rect.width;
    canvasOverlay.height = rect.height;
    
    // Scale scanner canvas inputs
    window.SentryScanner.resizeOffscreen(videoFeed.videoWidth || 640, videoFeed.videoHeight || 480, isEcoMode);

    // Size waveform canvas
    canvasWaveform.width = canvasWaveform.offsetWidth;
    canvasWaveform.height = canvasWaveform.offsetHeight;
  }

  // Core drawing and CV cycle
  function startScanLoop() {
    const loop = () => {
      if (videoFeed.paused || videoFeed.ended) {
        scanAnimationId = requestAnimationFrame(loop);
        return;
      }

      // Process frames in scanner.js
      const result = window.SentryScanner.processFrame(videoFeed, canvasOverlay, activeFilter, isEcoMode);

      if (result) {
        let anomalies = result.anomalies;
        let threatChance = result.threatChance;

        // Anomaly Simulation Injection (for demonstrations/mock testing)
        if (simulatedAnomalyActive) {
          anomalies.push({
            x: 0.5 + Math.sin(Date.now() / 600) * 0.15,
            y: 0.45 + Math.cos(Date.now() / 600) * 0.1,
            radius: 16,
            type: 'lens',
            label: 'Retro-Reflective Glass Core'
          });
          
          // Boost threat metrics
          threatChance = Math.max(85, threatChance);
        }

        // Send alert level directly to Geiger sound synth
        window.SentryAudio.setThreatLevel(threatChance);

        // Render Canvas filters and target crosshairs
        renderScannerCanvas(result.processedData, anomalies, threatChance);
        
        // Render HUD metrics panel
        updateHUDMetrics(threatChance);
      }

      scanAnimationId = requestAnimationFrame(loop);
    };
    
    scanAnimationId = requestAnimationFrame(loop);
  }

  // Draw scaled video/filters and vector annotations onto HUD
  function renderScannerCanvas(processedImgData, anomalies, threatChance) {
    const oWidth = canvasOverlay.width;
    const oHeight = canvasOverlay.height;
    
    // Draw the processed pixels
    // Since processing canvas is low resolution, we write to offscreen buffer first and draw scaled
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = processedImgData.width;
    tempCanvas.height = processedImgData.height;
    tempCanvas.getContext('2d').putImageData(processedImgData, 0, 0);

    ctxOverlay.clearRect(0, 0, oWidth, oHeight);
    
    // GPU-accelerated scaled paint
    ctxOverlay.drawImage(tempCanvas, 0, 0, oWidth, oHeight);

    // Apply scanned grid aesthetics
    drawHUDScanlines(ctxOverlay, oWidth, oHeight);

    // Visual reticle color toggle (red if anomaly triggers alarm, cyber green normally)
    const scannerReticle = document.querySelector(".scanner-reticle");
    if (threatChance > 60) {
      scannerReticle.classList.add("warning");
      alertFlash.classList.add("firing");
    } else {
      scannerReticle.classList.remove("warning");
      alertFlash.classList.remove("firing");
    }

    // Draw individual detected anomalies
    anomalies.forEach(anomaly => {
      const ax = anomaly.x * oWidth;
      const ay = anomaly.y * oHeight;
      const ar = anomaly.radius * (oWidth / 320); // Scale radius

      // Draw anomaly warning markers
      ctxOverlay.beginPath();
      ctxOverlay.arc(ax, ay, ar, 0, 2 * Math.PI);
      ctxOverlay.strokeStyle = anomaly.type === 'lens' ? 'var(--color-danger)' : 'var(--color-warning)';
      ctxOverlay.lineWidth = 2.5;
      ctxOverlay.stroke();

      // Pulsing secondary outer ring
      ctxOverlay.beginPath();
      ctxOverlay.arc(ax, ay, ar + 8 + Math.abs(Math.sin(Date.now() / 150)) * 6, 0, 2 * Math.PI);
      ctxOverlay.strokeStyle = anomaly.type === 'lens' ? 'rgba(255, 0, 84, 0.25)' : 'rgba(247, 127, 0, 0.25)';
      ctxOverlay.lineWidth = 1;
      ctxOverlay.stroke();

      // Dynamic text label banner
      ctxOverlay.fillStyle = 'rgba(6, 9, 19, 0.8)';
      ctxOverlay.fillRect(ax - 50, ay - ar - 20, 100, 15);
      
      ctxOverlay.fillStyle = anomaly.type === 'lens' ? 'var(--color-danger)' : 'var(--color-warning)';
      ctxOverlay.font = "bold 8px 'JetBrains Mono'";
      ctxOverlay.textAlign = "center";
      ctxOverlay.fillText(anomaly.label, ax, ay - ar - 10);

      // NEW: "Tracking" lines from reticle to closest anomaly
      if (threatChance > 40) {
        ctxOverlay.beginPath();
        ctxOverlay.setLineDash([5, 5]);
        ctxOverlay.moveTo(oWidth / 2, oHeight / 2);
        ctxOverlay.lineTo(ax, ay);
        ctxOverlay.strokeStyle = "rgba(255, 0, 84, 0.3)";
        ctxOverlay.stroke();
        ctxOverlay.setLineDash([]);
      }
    });
  }

  // Draw scientific overlay pings
  function drawHUDScanlines(ctx, w, h) {
    ctx.strokeStyle = "rgba(0, 245, 212, 0.03)";
    ctx.lineWidth = 1;
    // Horizontal scanlines every 8px
    for (let y = 0; y < h; y += 8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  // Write readings to Left-HUD panel
  function updateHUDMetrics(threatChance) {
    // Proximity
    const distance = window.SentrySensors.getProximity();
    proximityVal.textContent = `${distance.toFixed(1)}m`;
    const proxPercent = Math.min(100, (distance / 3.0) * 100);
    proximityBar.style.width = `${proxPercent}%`;

    // Threat anomaly percentage
    anomalyVal.textContent = `${threatChance}%`;
    anomalyBar.style.width = `${threatChance}%`;
    const anomalyMetricItem = document.getElementById("hud-metric-anomaly");
    if (threatChance > 60) {
      anomalyMetricItem.classList.add("danger");
    } else {
      anomalyMetricItem.classList.remove("danger");
    }

    // Accelerometer scanning speeds
    const speedState = window.SentrySensors.getSpeedState();
    const speedPercent = window.SentrySensors.getSpeedVal();
    handVal.textContent = speedState;
    handBar.style.width = `${speedPercent}%`;
    
    const speedBarEl = document.querySelector(".speed-color");
    if (speedState === "TOO FAST") {
      speedBarEl.style.backgroundColor = "var(--color-danger)";
    } else if (speedState === "SWEEPING") {
      speedBarEl.style.backgroundColor = "var(--color-warning)";
    } else {
      speedBarEl.style.backgroundColor = "var(--color-secondary)";
    }

    // Update Waveform History
    threatHistory.push(threatChance);
    threatHistory.shift();
    renderWaveform();
  }

  function renderWaveform() {
    const w = canvasWaveform.width;
    const h = canvasWaveform.height;
    ctxWaveform.clearRect(0, 0, w, h);

    ctxWaveform.beginPath();
    ctxWaveform.strokeStyle = "var(--color-accent)";
    ctxWaveform.lineWidth = 2;
    ctxWaveform.lineJoin = "round";

    const step = w / (threatHistory.length - 1);
    for (let i = 0; i < threatHistory.length; i++) {
      const x = i * step;
      const y = h - (threatHistory[i] / 100 * h * 0.8) - 5;
      if (i === 0) ctxWaveform.moveTo(x, y);
      else ctxWaveform.lineTo(x, y);
    }
    ctxWaveform.stroke();

    // Fill area under curve
    ctxWaveform.lineTo(w, h);
    ctxWaveform.lineTo(0, h);
    ctxWaveform.fillStyle = "rgba(0, 245, 212, 0.1)";
    ctxWaveform.fill();
  }

  /* ----------------------------------------------------
     MOCK SIMULATOR FEED FOR BROWSERS WITHOUT WEBCAM
     ---------------------------------------------------- */
  let mockAnimFrame = null;
  function runMockVideoFeed() {
    const mockCanvas = document.createElement('canvas');
    mockCanvas.width = 320;
    mockCanvas.height = 240;
    const mCtx = mockCanvas.getContext('2d');

    const drawMock = () => {
      // Background static sweep
      mCtx.fillStyle = "#0c1224";
      mCtx.fillRect(0, 0, 320, 240);

      // Draw moving lines to simulate scanning
      mCtx.strokeStyle = "rgba(0, 245, 212, 0.05)";
      mCtx.lineWidth = 2;
      const lineY = (Date.now() / 40) % 240;
      mCtx.beginPath();
      mCtx.moveTo(0, lineY);
      mCtx.lineTo(320, lineY);
      mCtx.stroke();

      // Simulated bulb object in center
      mCtx.fillStyle = "#22325c";
      mCtx.beginPath();
      mCtx.arc(160, 120, 50, 0, 2 * Math.PI);
      mCtx.fill();

      // Sim glass reflection glints
      mCtx.fillStyle = "#fff";
      mCtx.beginPath();
      mCtx.arc(160, 120, 2, 0, 2 * Math.PI);
      mCtx.fill();

      // Extract image data to simulate feed
      const srcData = mCtx.getImageData(0, 0, 320, 240);
      const dstData = mCtx.createImageData(320, 240);
      
      // Access the scanner engine instance
      const scanner = window.SentryScanner;
      scanner.anomalies = [];
      
      if (activeFilter === 'edge') {
        scanner.runSobelEdgeFilter(srcData, dstData);
      } else if (activeFilter === 'glint') {
        scanner.runGlintReflectionAnalyzer(srcData, dstData);
      } else if (activeFilter === 'infrared') {
        scanner.runInfraredSpectralFilter(srcData, dstData);
      } else {
        dstData.data.set(srcData.data);
      }

      scanner.calculateThreatChance(activeFilter);
      let anomalies = scanner.anomalies;
      let threatChance = scanner.threatChance;

      if (simulatedAnomalyActive) {
        anomalies.push({
          x: 0.5 + Math.sin(Date.now() / 600) * 0.15,
          y: 0.45 + Math.cos(Date.now() / 600) * 0.1,
          radius: 16,
          type: 'lens',
          label: 'Retro-Reflective Glass Core'
        });
        threatChance = Math.max(85, threatChance);
      }

      window.SentryAudio.setThreatLevel(threatChance);
      renderScannerCanvas(dstData, anomalies, threatChance);
      updateHUDMetrics(threatChance);

      mockAnimFrame = requestAnimationFrame(drawMock);
    };

    mockAnimFrame = requestAnimationFrame(drawMock);
    // Overwrite the normal stream loops
    scanAnimationId = mockAnimFrame;
  }

  /* ----------------------------------------------------
     CONTROL EVENT LISTENERS
     ---------------------------------------------------- */
  // Distance calibration slider changes
  sliderDistance.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    sliderDistanceVal.textContent = `${val.toFixed(1)}m`;
    window.SentrySensors.setProximity(val);
  });

  sliderSensitivity.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    sliderSensitivityVal.textContent = val;
    window.SentryScanner.setSensitivity(val);
  });

  // Toggle filter tabs
  filterTabs.forEach(tab => {
    tab.addEventListener("click", (e) => {
      filterTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      activeFilter = tab.dataset.filter;
      showToast(`Filter changed: ${activeFilter.toUpperCase()}`);
    });
  });

  // Simulated flash triggers
  btnToggleFlashlight.addEventListener("click", () => {
    isFlashlightOn = !isFlashlightOn;
    btnToggleFlashlight.classList.toggle("active", isFlashlightOn);
    
    // Toggle camera hardware flash if support is available
    if (stream) {
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      if (capabilities.torch) {
        track.applyConstraints({
          advanced: [{ torch: isFlashlightOn }]
        }).catch(err => console.warn("Torch control failed:", err));
      }
    }

    showToast(isFlashlightOn ? "Flashlight active. Scanning glints." : "Flashlight inactive.");
  });

  // Toggle Audio Alarm Mute
  btnToggleAudio.addEventListener("click", () => {
    isAudioMuted = !isAudioMuted;
    
    const iconOn = btnToggleAudio.querySelector(".icon-on");
    const iconOff = btnToggleAudio.querySelector(".icon-off");

    if (isAudioMuted) {
      btnToggleAudio.classList.remove("active");
      iconOn.style.display = "none";
      iconOff.style.display = "block";
      window.SentryAudio.setMute(true);
      showToast("Audio alerts muted.");
    } else {
      btnToggleAudio.classList.add("active");
      iconOn.style.display = "block";
      iconOff.style.display = "none";
      window.SentryAudio.setMute(false);
      showToast("Audio alerts active.");
    }
  });

  // Toggle Battery ECO Mode
  btnToggleEco.addEventListener("click", () => {
    isEcoMode = !isEcoMode;
    btnToggleEco.classList.toggle("active", isEcoMode);
    
    if (isEcoMode) {
      batteryPill.className = "hud-pill battery-saver-on";
      batteryPill.querySelector("span").textContent = "ECO ON";
      showToast("Eco Mode active. Reduced frame rates.");
    } else {
      batteryPill.className = "hud-pill battery-saver-off";
      batteryPill.querySelector("span").textContent = "ECO OFF";
      showToast("Eco Mode deactivated.");
    }

    // Re-adjust offscreen sizes
    if (videoFeed.videoWidth > 0) {
      setupCanvases();
    }
  });

  // Anomaly Simulation trigger
  btnSimulateThreat.addEventListener("click", () => {
    simulatedAnomalyActive = !simulatedAnomalyActive;
    if (simulatedAnomalyActive) {
      btnSimulateThreat.classList.add("btn-primary");
      btnSimulateThreat.textContent = "CLEAR ANOMALY";
      showToast("Camera anomaly simulated.");
    } else {
      btnSimulateThreat.classList.remove("btn-primary");
      btnSimulateThreat.textContent = "SIMULATE ANOMALY";
      showToast("Cleared simulation.");
    }
  });

  // Manual log of suspects
  btnLogAnomaly.addEventListener("click", () => {
    const step = stepsData[currentStepIndex];

    // Capture thumbnail from processed canvas
    // We capture a centered crop
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 120;
    thumbCanvas.height = 120;
    const tCtx = thumbCanvas.getContext('2d');

    // Draw center of main overlay
    const sourceX = (canvasOverlay.width / 2) - 60;
    const sourceY = (canvasOverlay.height / 2) - 60;
    tCtx.drawImage(canvasOverlay, sourceX, sourceY, 120, 120, 0, 0, 120, 120);

    const logData = {
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type: activeFilter === 'infrared' ? 'Infrared Source' : 'Glint Reflection',
      distance: window.SentrySensors.getProximity(),
      description: `Suspect lens spotted in ${step.title} via ${activeFilter.toUpperCase()} filter.`,
      thumbnail: thumbCanvas.toDataURL('image/jpeg', 0.7)
    };

    scanReports[step.zoneId].threats.push(logData);
    showToast(`Logged suspect in ${step.zoneTitle}!`);
    
    // Play lock sound
    window.SentryAudio.playLockSound();

    // Visual flash feedback
    alertFlash.classList.remove("captured");
    void alertFlash.offsetWidth; // Trigger reflow
    alertFlash.classList.add("captured");

    // Add simple vibration feedback if supported
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  });

  /* ----------------------------------------------------
     STEP TRANSITIONS AND REPORT GENERATION
     ---------------------------------------------------- */
  // Start sweep clicked
  btnStartSweep.addEventListener("click", () => {
    // Wake up Web Audio context
    window.SentryAudio.init();
    // Wake up device motion listeners
    window.SentrySensors.init();
    
    loadStep(0);
    navigateTo(viewGuide);
  });

  // Back step in guide
  btnPrevStep.addEventListener("click", () => {
    if (currentStepIndex > 0) {
      loadStep(currentStepIndex - 1);
    } else {
      navigateTo(viewHome);
    }
  });

  // Launch camera clicked
  btnLaunchScanner.addEventListener("click", () => {
    startScanner();
  });

  // Back button on scanner HUD
  btnScannerBack.addEventListener("click", () => {
    stopScanner();
    navigateTo(viewGuide);
  });

  // Next step click from scanner HUD
  btnNextStepScan.addEventListener("click", () => {
    const step = stepsData[currentStepIndex];
    scanReports[step.zoneId].checked = true;

    stopScanner();

    if (currentStepIndex < stepsData.length - 1) {
      loadStep(currentStepIndex + 1);
      navigateTo(viewGuide);
    } else {
      compileReport();
    }
  });

  // Compile scan variables into final report
  function compileReport() {
    navigateTo(viewReport);
    reportTimestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let score = 100;
    let cautionZones = [];
    let threatZones = [];

    // Evaluate reports per zone
    Object.keys(scanReports).forEach(zoneKey => {
      const zRep = scanReports[zoneKey];
      const zRow = document.getElementById(`report-zone-${zoneKey}`);
      const zBadge = zRow.querySelector(".zone-badge");
      
      zRow.className = "zone-row"; // Reset classes

      if (!zRep.checked) {
        zBadge.className = "zone-badge";
        zBadge.textContent = "SKIPPED";
        zBadge.style.backgroundColor = "rgba(255,255,255,0.05)";
        zBadge.style.color = "var(--color-text-muted)";
      } else if (zRep.threats.length === 0) {
        zRow.classList.add("safe");
        zBadge.className = "zone-badge safe";
        zBadge.textContent = "CLEAN";
      } else {
        // We have threat alerts!
        const count = zRep.threats.length;
        if (count === 1) {
          zRow.classList.add("caution");
          zBadge.className = "zone-badge caution";
          zBadge.textContent = "CAUTION";
          score -= 15;
          cautionZones.push(zoneKey);
        } else {
          zRow.classList.add("threat");
          zBadge.className = "zone-badge threat";
          zBadge.textContent = "WARNING";
          score -= 35;
          threatZones.push(zoneKey);
        }
      }
    });

    score = Math.max(0, score);
    
    // Set score counter
    reportScoreVal.textContent = score;

    // Render radial gauge fill
    // Gauge dasharray is 264. Dashoffset = 264 - (264 * score / 100)
    const offset = 264 - (264 * score / 100);
    reportGaugeFill.style.strokeDashoffset = offset;

    // Populate threat gallery
    const gallery = document.getElementById("report-threat-gallery");
    const container = document.getElementById("threat-logs-container");
    container.innerHTML = "";

    let allThreats = [];
    Object.values(scanReports).forEach(z => {
      allThreats = allThreats.concat(z.threats);
    });

    if (allThreats.length > 0) {
      gallery.style.display = "block";
      allThreats.forEach(t => {
        const item = document.createElement("div");
        item.className = "threat-log-item";
        item.innerHTML = `
          <div class="threat-log-visual">
            <img src="${t.thumbnail}" alt="Suspect Capture">
          </div>
          <div class="threat-log-content">
            <div class="threat-log-header">
              <span class="threat-log-type">${t.type}</span>
              <span class="threat-log-time">${t.timestamp}</span>
            </div>
            <p class="threat-log-desc">${t.description} (Dist: ${t.distance}m)</p>
          </div>
        `;
        container.appendChild(item);
      });
    } else {
      gallery.style.display = "none";
    }

    // Report status categorizer
    if (score >= 90) {
      reportStatusBadge.className = "status-badge safe";
      reportStatusBadge.textContent = "SECURE";
      reportVerdict.textContent = "No hidden cameras detected. The room appears safe and private.";
      reportGaugeFill.style.stroke = "var(--color-success)";
    } else if (score >= 60) {
      reportStatusBadge.className = "status-badge warning";
      reportStatusBadge.textContent = "CAUTION";
      reportVerdict.textContent = `A few suspicious lens reflections were registered. Double-check ${cautionZones.join(" and ")} areas.`;
      reportGaugeFill.style.stroke = "var(--color-warning)";
    } else {
      reportStatusBadge.className = "status-badge threat";
      reportStatusBadge.textContent = "THREATS FOUND";
      reportVerdict.textContent = `CRITICAL WARNING: High threat nodes detected. Suspected spy cams logged in ${threatZones.concat(cautionZones).join(", ")}.`;
      reportGaugeFill.style.stroke = "var(--color-danger)";
    }
  }

  // Restart new sweep
  btnRestartSweep.addEventListener("click", () => {
    Object.keys(scanReports).forEach(key => {
      scanReports[key].checked = false;
      scanReports[key].threats = [];
    });
    navigateTo(viewHome);
  });

  // Export report
  btnShareReport.addEventListener("click", () => {
    let rawText = `--- SENTRYEYE SAFETY AUDIT REPORT ---\n`;
    rawText += `Date: ${new Date().toLocaleDateString()}\n`;
    rawText += `Time: ${new Date().toLocaleTimeString()}\n`;
    rawText += `Safety Score: ${reportScoreVal.textContent}/100\n`;
    rawText += `Status: ${reportStatusBadge.textContent}\n\n`;
    
    Object.keys(scanReports).forEach(zone => {
      const z = scanReports[zone];
      rawText += `[${zone.toUpperCase()}] Check-status: ${z.checked ? "Done" : "Skipped"}, Anomalies logged: ${z.threats.length}\n`;
      z.threats.forEach((t, i) => {
        rawText += `  - Alert #${i+1} at ${t.timestamp}: Distance ${t.distance}m. Description: ${t.description}\n`;
      });
    });

    const blob = new Blob([rawText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentryeye_safety_audit.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("Safety report exported.");
  });

});
