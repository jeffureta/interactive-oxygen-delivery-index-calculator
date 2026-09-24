document.addEventListener("DOMContentLoaded", () => {
  const inputs = {
    ci: document.getElementById("input-ci"),
    hgb: document.getElementById("input-hgb"),
    sao2: document.getElementById("input-sao2"),
    pao2: document.getElementById("input-pao2")
  };
  
  const displays = {
    ci: document.getElementById("disp-ci"),
    hgb: document.getElementById("disp-hgb"),
    sao2: document.getElementById("disp-sao2"),
    pao2: document.getElementById("disp-pao2")
  };

  const results = {
    cao2: document.getElementById("val-cao2"),
    do2i: document.getElementById("val-do2i"),
    status: document.getElementById("val-status"),
    statusContainer: document.getElementById("status-container"),
    statusTooltipTitle: document.getElementById("status-tooltip-title"),
    statusTooltipText: document.getElementById("status-tooltip-text"),
    ratioBar: document.getElementById("ratio-bar"),
    ratioFill: document.getElementById("ratio-fill"),
    ratioText: document.getElementById("ratio-text"),
    tooltipText: document.getElementById("tooltip-text")
  };

  const pills = document.querySelectorAll(".chip");
  const playBtn = document.getElementById("play-pause-btn");
  const playIcon = document.getElementById("play-icon");
  const canvas = document.getElementById("flowCanvas");
  const ctx = canvas.getContext("2d");

  let isPlaying = true;
  let particles = [];
  let animationFrame;

  function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function updateSliderFill(input) {
    const min = parseFloat(input.min) || 0;
    const max = parseFloat(input.max) || 100;
    const val = parseFloat(input.value);
    const percentage = ((val - min) / (max - min)) * 100;
    input.style.setProperty('--progress', `${percentage}%`);
  }

  // Particle Class: Fixed continuous flow with permanent individual speeds
  class Particle {
    constructor() {
      this.reset(true);
    }
    reset(randomX = false) {
      // Staggered off-screen respawn prevents particles from entering in clumps
      this.x = randomX ? Math.random() * canvas.width : -(Math.random() * 60 + 10);
      this.baseY = (canvas.height / 2) + (Math.random() * 40 - 20);
      this.radius = Math.random() * 3 + 3;
      this.phase = Math.random() * Math.PI * 2;
      this.alpha = Math.random() * 0.4 + 0.6;
      // Assign a permanent unique speed to each particle to ensure continuous mixing
      this.speedMultiplier = 1.2 + (Math.random() * 1.5);
    }
    update(speed) {
      if (isPlaying) {
        this.x += speed * this.speedMultiplier;
        this.y = this.baseY + Math.sin(this.x * 0.03 + this.phase) * 8;
        
        if (this.x - this.radius > canvas.width) {
          this.reset();
        }
      }
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(234, 67, 53, ${this.alpha})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(this.x - (this.radius * 0.3), this.y - (this.radius * 0.3), this.radius * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, 0.4)`;
      ctx.fill();
    }
  }

  for (let i = 0; i < 60; i++) {
    particles.push(new Particle());
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const ci = parseFloat(inputs.ci.value);
    const speed = Math.max(0.2, ci * 0.5);

    particles.forEach(p => {
      p.update(speed);
      p.draw();
    });

    animationFrame = requestAnimationFrame(animate);
  }
  animate();

  playBtn.addEventListener("click", () => {
    isPlaying = !isPlaying;
    playIcon.textContent = isPlaying ? "⏸" : "▶";
  });

  function updateHemodynamics() {
    const ci = parseFloat(inputs.ci.value);
    const hgb = parseFloat(inputs.hgb.value);
    const sao2 = parseFloat(inputs.sao2.value);
    const pao2 = parseFloat(inputs.pao2.value);

    Object.values(inputs).forEach(input => updateSliderFill(input));

    displays.ci.textContent = ci.toFixed(1);
    displays.hgb.textContent = hgb.toFixed(1);
    displays.sao2.textContent = Math.round(sao2);
    displays.pao2.textContent = Math.round(pao2);

    const bound = hgb * 1.34 * (sao2 / 100);
    const dissolved = pao2 * 0.0031;
    const cao2 = bound + dissolved;
    const do2i = ci * cao2 * 10;

    const boundPercent = (bound / cao2) * 100;
    const plasmaPercent = (dissolved / cao2) * 100;

    results.cao2.textContent = cao2.toFixed(2);
    results.do2i.textContent = Math.round(do2i);

    results.status.className = "status-chip";
    if (do2i < 500) {
      results.status.textContent = "Low";
      results.status.classList.add("status-low");
      results.statusContainer.classList.add("has-tooltip");
      results.statusTooltipTitle.textContent = "Clinical Alert: Low DO₂I (< 500 mL/min/m²)";
      results.statusTooltipText.innerHTML = "Systemic oxygen delivery is insufficient for baseline tissue demands. Signals impaired transport from cardiogenic failure, severe anemia, or hypoxemia with risk of tissue hypoxia and lactic acidosis.";
    } else if (do2i > 600) {
      results.status.textContent = "High";
      results.status.classList.add("status-high");
      results.statusContainer.classList.add("has-tooltip");
      results.statusTooltipTitle.textContent = "Clinical Caveat: High DO₂I (> 600 mL/min/m²)";
      results.statusTooltipText.innerHTML = "Reflects a hyperdynamic state (distributive/septic shock, high fever, burns, thyrotoxicosis, or high inotropes) or polycythemia.<br><em>Caveat:</em> Supranormal delivery does <strong>not</strong> guarantee adequate cellular utilization if microvascular shunting or mitochondrial uptake is impaired.";
    } else {
      results.status.textContent = "Normal";
      results.status.classList.add("status-normal");
      results.statusContainer.classList.remove("has-tooltip");
    }

    results.ratioFill.style.width = `${boundPercent}%`;
    results.ratioText.textContent = `Bound: ${boundPercent.toFixed(1)}% / Plasma: ${plasmaPercent.toFixed(1)}%`;

    results.tooltipText.innerHTML = `
      <strong>${boundPercent.toFixed(1)}% (${bound.toFixed(2)} mL/dL)</strong> carried chemically by Hemoglobin (Bound).<br>
      <strong>${plasmaPercent.toFixed(1)}% (${dissolved.toFixed(2)} mL/dL)</strong> dissolved physically in plasma liquid.<br>
      <em>Hemoglobin carries the vast majority of oxygen; dissolved PaO₂ contributes very little to total content.</em>
    `;

    const targetParticleCount = Math.floor(hgb * 4.5); 
    while(particles.length < targetParticleCount) particles.push(new Particle());
    while(particles.length > targetParticleCount) particles.pop();
  }

  Object.values(inputs).forEach(input => {
    input.addEventListener("input", () => {
      updateHemodynamics();
      setActivePill("custom");
    });
  });

  const scenarios = {
    normal: { ci: 3.0, hgb: 14.0, sao2: 98, pao2: 95 },
    anemia: { ci: 3.5, hgb: 7.0, sao2: 98, pao2: 95 },
    hypoxemia: { ci: 3.8, hgb: 14.0, sao2: 85, pao2: 50 },
    cardiogenic: { ci: 1.5, hgb: 14.0, sao2: 98, pao2: 90 },
    custom: null
  };

  function setActivePill(scenarioId) {
    pills.forEach(p => p.classList.remove("active"));
    const targetPill = document.querySelector(`.chip[data-scenario="${scenarioId}"]`);
    if (targetPill) targetPill.classList.add("active");
  }

  pills.forEach(pill => {
    pill.addEventListener("click", (e) => {
      const type = e.currentTarget.dataset.scenario;
      setActivePill(type);
      
      if (scenarios[type]) {
        inputs.ci.value = scenarios[type].ci;
        inputs.hgb.value = scenarios[type].hgb;
        inputs.sao2.value = scenarios[type].sao2;
        inputs.pao2.value = scenarios[type].pao2;
        updateHemodynamics();
      }
    });
  });

  updateHemodynamics();
});