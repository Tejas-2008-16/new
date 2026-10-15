/**
 * EXAMRESIZER.IN — CORE HIGH-PERFORMANCE ENGINE
 * Features:
 * - 100% Client-Side Canvas & Blob processing (Zero server transmissions)
 * - Binary Search Iterative Compression Algorithm targeting exact KB bounds
 * - Signature Background Whitener & Contrast Boost Filter
 * - Dimension & Aspect-ratio enforcement
 * - Verified Exam Presets auto-configuration
 * - Download generator and error handling
 */

(function () {
  'use strict';

  // --- State Variables ---
  let originalImage = null;       // HTMLImageElement
  let originalFile = null;        // File object
  let processedBlob = null;       // Blob of compressed output
  let processedDataUrl = null;    // Object URL for download
  let isAspectLocked = true;
  let currentAspectRatio = 1.0;
  let activePreset = null;
  let isProcessing = false;

  // DOM Elements
  const fileInput = document.getElementById('file-input');
  const dropzone = document.getElementById('dropzone');
  const dropPrompt = document.getElementById('drop-prompt');
  const imageStage = document.getElementById('image-stage');
  const sourcePreview = document.getElementById('source-preview');
  const liveFileBadge = document.getElementById('live-file-badge');
  const origFormatBadge = document.getElementById('orig-format-badge');
  const origDimensionsBadge = document.getElementById('orig-dimensions-badge');
  const origSizeBadge = document.getElementById('orig-size-badge');

  const presetSelect = document.getElementById('exam-preset-select');
  const presetStatusTag = document.getElementById('preset-status-tag');
  const presetCitationInfo = document.getElementById('preset-citation-info');
  const citationSourceName = document.getElementById('citation-source-name');
  const citationDate = document.getElementById('citation-date');
  const citationNotes = document.getElementById('citation-notes');

  const targetWidthInput = document.getElementById('target-width');
  const targetHeightInput = document.getElementById('target-height');
  const aspectLockCheckbox = document.getElementById('aspect-lock');
  const physicalHelperText = document.getElementById('physical-helper-text');

  const targetKbDisplay = document.getElementById('target-kb-display');
  const targetKbRange = document.getElementById('target-kb-range');
  const cleanSignatureToggle = document.getElementById('clean-signature-toggle');

  const resultStatusTitle = document.getElementById('result-status-title');
  const resultDot = document.getElementById('result-dot');
  const resultExecTime = document.getElementById('result-exec-time');
  const resDims = document.getElementById('res-dims');
  const resSize = document.getElementById('res-size');
  const resFmt = document.getElementById('res-fmt');
  const resCompliance = document.getElementById('res-compliance');
  const btnDownload = document.getElementById('btn-download');

  // --- Initialization ---
  window.addEventListener('DOMContentLoaded', () => {
    initEvents();
    renderExamTable('all');
    // Set default target
    setTargetKb(50);
  });

  function initEvents() {
    // File picker change
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('drag-over');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('drag-over');
      }, false);
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0) {
        processIncomingFile(files[0]);
      }
    });

    // Keyboard trigger on dropzone
    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });
  }

  // --- File Intake & Preview ---
  function handleFileSelect(e) {
    if (e.target.files && e.target.files[0]) {
      processIncomingFile(e.target.files[0]);
    }
  }

  function processIncomingFile(file) {
    if (!file.type.match('image.*')) {
      alert('Please upload a valid image file (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      alert('File is too large (> 15MB). Please choose a smaller source image.');
      return;
    }

    originalFile = file;

    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        originalImage = img;
        currentAspectRatio = img.naturalWidth / img.naturalHeight;

        // Populate badges
        origFormatBadge.textContent = file.type.split('/')[1].toUpperCase();
        origDimensionsBadge.textContent = `${img.naturalWidth} × ${img.naturalHeight} px`;
        origSizeBadge.textContent = formatBytes(file.size);
        liveFileBadge.style.display = 'flex';

        // Switch dropzone view to stage
        dropPrompt.style.display = 'none';
        imageStage.style.display = 'flex';
        sourcePreview.src = e.target.result;

        // Set dimensions if not set by a preset
        if (!activePreset) {
          targetWidthInput.value = img.naturalWidth;
          targetHeightInput.value = img.naturalHeight;
        }

        // Trigger processing pipeline
        runIterativeProcessing();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  window.triggerReplaceFile = function () {
    fileInput.click();
  };

  window.resetWorkspace = function () {
    originalImage = null;
    originalFile = null;
    if (processedDataUrl) {
      URL.revokeObjectURL(processedDataUrl);
      processedDataUrl = null;
    }
    processedBlob = null;
    fileInput.value = '';
    sourcePreview.src = '';

    liveFileBadge.style.display = 'none';
    imageStage.style.display = 'none';
    dropPrompt.style.display = 'flex';

    resDims.textContent = '—';
    resSize.textContent = '—';
    resCompliance.textContent = 'Awaiting image';
    btnDownload.disabled = true;

    resultStatusTitle.textContent = 'Ready to Process';
    resultDot.className = 'status-dot';
    resultExecTime.textContent = '0 ms';
  };

  // --- Dimension and Ratio Handlers ---
  window.onDimensionChange = function (changedField) {
    if (!targetWidthInput.value || !targetHeightInput.value) return;

    if (isAspectLocked && currentAspectRatio > 0) {
      if (changedField === 'width') {
        const newW = parseInt(targetWidthInput.value, 10);
        if (!isNaN(newW) && newW > 0) {
          targetHeightInput.value = Math.round(newW / currentAspectRatio);
        }
      } else {
        const newH = parseInt(targetHeightInput.value, 10);
        if (!isNaN(newH) && newH > 0) {
          targetWidthInput.value = Math.round(newH * currentAspectRatio);
        }
      }
    }
    updatePhysicalHelper();
    runIterativeProcessing();
  };

  window.toggleAspectLock = function () {
    isAspectLocked = aspectLockCheckbox.checked;
    if (isAspectLocked && targetWidthInput.value && targetHeightInput.value) {
      currentAspectRatio = parseInt(targetWidthInput.value, 10) / parseInt(targetHeightInput.value, 10);
    }
  };

  window.resetToOriginalDims = function () {
    if (originalImage) {
      targetWidthInput.value = originalImage.naturalWidth;
      targetHeightInput.value = originalImage.naturalHeight;
      currentAspectRatio = originalImage.naturalWidth / originalImage.naturalHeight;
      updatePhysicalHelper();
      runIterativeProcessing();
    }
  };

  function updatePhysicalHelper() {
    const w = parseInt(targetWidthInput.value, 10) || 0;
    const h = parseInt(targetHeightInput.value, 10) || 0;
    // Approximating standard 100-150 DPI for web submission
    const cmW = (w / 118).toFixed(1);
    const cmH = (h / 118).toFixed(1);
    physicalHelperText.textContent = `Equivalent to ~${cmW} cm × ${cmH} cm (~${(w * 0.0264).toFixed(1)} cm) for online application forms.`;
  }

  // --- Target KB Controls ---
  window.setTargetKb = function (kb) {
    targetKbDisplay.textContent = kb;
    targetKbRange.value = kb;

    // Highlight active chip
    document.querySelectorAll('.btn-kb-chip').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.trim() === `${kb} KB`);
    });

    runIterativeProcessing();
  };

  window.onKbSliderChange = function (val) {
    targetKbDisplay.textContent = val;
    document.querySelectorAll('.btn-kb-chip').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.trim() === `${val} KB`);
    });
    runIterativeProcessing();
  };

  window.handleProcessUpdate = function () {
    runIterativeProcessing();
  };

  // --- Preset Selection ---
  window.onPresetSelected = function (presetId) {
    if (presetId === 'custom') {
      activePreset = null;
      presetStatusTag.textContent = 'Custom Mode';
      presetCitationInfo.style.display = 'none';
      return;
    }

    const preset = window.EXAM_PRESETS_DATA.find(p => p.id === presetId);
    if (!preset) return;

    activePreset = preset;
    presetStatusTag.textContent = `Preset: ${preset.authority.split('(')[0].trim()}`;
    
    // Set Dimensions
    targetWidthInput.value = preset.width;
    targetHeightInput.value = preset.height;
    currentAspectRatio = preset.width / preset.height;
    
    // Set KB Ceiling
    setTargetKb(preset.maxKb);

    // Format selection
    const formatRadios = document.getElementsByName('output-format');
    for (let radio of formatRadios) {
      if (radio.value === preset.format) {
        radio.checked = true;
      }
    }

    // Set signature clean-up toggle if signature preset
    if (preset.type === 'signature') {
      cleanSignatureToggle.checked = true;
    }

    // Display Citation
    citationSourceName.innerHTML = `<a href="${preset.sourceUrl}" target="_blank" rel="noopener noreferrer">${preset.sourceTitle}</a>`;
    citationDate.textContent = `${preset.cycle} (${preset.verifiedDate})`;
    citationNotes.textContent = preset.instructions;
    presetCitationInfo.style.display = 'block';

    updatePhysicalHelper();
    runIterativeProcessing();
  };

  window.applyExamPreset = function (presetId) {
    presetSelect.value = presetId;
    window.onPresetSelected(presetId);
    scrollToWorkspace();
  };

  window.applyKbPreset = function (kb) {
    presetSelect.value = 'custom';
    window.onPresetSelected('custom');
    setTargetKb(kb);
    scrollToWorkspace();
  };

  window.loadKbUtility = function (kb) {
    presetSelect.value = 'custom';
    window.onPresetSelected('custom');
    setTargetKb(kb);
    scrollToWorkspace();
  };

  window.loadSignatureMode = function () {
    presetSelect.value = 'ssc-cgl-sign';
    window.onPresetSelected('ssc-cgl-sign');
    cleanSignatureToggle.checked = true;
    scrollToWorkspace();
  };

  function scrollToWorkspace() {
    const el = document.getElementById('app-workspace');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // --- Signature Background Filter (Canvas Image Processing) ---
  function applySignatureCleanFilter(ctx, width, height) {
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      // High pass threshold: convert near-white paper shadows to pure #FFF, sharpen ink to black
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Luminance calculation
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        if (lum > 175) {
          // Whitening gray background paper
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
        } else if (lum < 110) {
          // Darkening black ink
          data[i] = 10;
          data[i + 1] = 10;
          data[i + 2] = 10;
        } else {
          // Contrast stretch midtones
          const contrast = (lum - 110) / 65;
          const val = Math.round(contrast * 255);
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } catch (e) {
      console.warn('Canvas filter error:', e);
    }
  }

  // --- Iterative Compression Core Algorithm ---
  async function runIterativeProcessing() {
    if (!originalImage) return;
    if (isProcessing) return;

    isProcessing = true;
    const startTime = performance.now();

    resultStatusTitle.textContent = 'Iteratively Compressing...';
    resultDot.className = 'status-dot processing';

    const targetW = parseInt(targetWidthInput.value, 10) || originalImage.naturalWidth;
    const targetH = parseInt(targetHeightInput.value, 10) || originalImage.naturalHeight;
    const targetKb = parseInt(targetKbDisplay.textContent, 10) || 50;
    const targetBytes = targetKb * 1024;

    const formatRadios = document.getElementsByName('output-format');
    let selectedFormat = 'image/jpeg';
    for (let r of formatRadios) {
      if (r.checked) selectedFormat = r.value;
    }

    // Step 1: Draw on Offscreen / Scaled Canvas
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Fill white background for transparent images / JPEGs
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetW, targetH);

    // High quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(originalImage, 0, 0, targetW, targetH);

    // Apply Signature Cleaner if active
    if (cleanSignatureToggle.checked) {
      applySignatureCleanFilter(ctx, targetW, targetH);
    }

    // Step 2: Binary Search Iterative Encoding Loop
    let lowQ = 0.05;
    let highQ = 1.0;
    let bestBlob = null;
    let iterations = 0;
    const maxIterations = 8; // Converges rapidly in ~5-7 steps

    // PNG does not support quality parameter in toBlob, handled directly
    if (selectedFormat === 'image/png') {
      bestBlob = await canvasToBlobAsync(canvas, 'image/png', 1.0);
    } else {
      while (iterations < maxIterations) {
        iterations++;
        const testQ = (lowQ + highQ) / 2;
        const testBlob = await canvasToBlobAsync(canvas, selectedFormat, testQ);

        if (testBlob.size <= targetBytes) {
          bestBlob = testBlob;
          // Can we get better quality without exceeding?
          lowQ = testQ;
        } else {
          // File is too large, reduce quality ceiling
          highQ = testQ;
        }

        // Precision convergence threshold
        if (highQ - lowQ < 0.02) {
          break;
        }
      }

      // If even lowest quality didn't fit (very small KB target for large dimensions), fallback
      if (!bestBlob) {
        bestBlob = await canvasToBlobAsync(canvas, selectedFormat, 0.05);
      }
    }

    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    // Step 3: Update Output State & UI
    if (processedDataUrl) {
      URL.revokeObjectURL(processedDataUrl);
    }
    processedBlob = bestBlob;
    processedDataUrl = URL.createObjectURL(bestBlob);

    // Update Metrics
    resDims.textContent = `${targetW} × ${targetH} px`;
    resSize.textContent = `${(bestBlob.size / 1024).toFixed(1)} KB`;
    resFmt.textContent = selectedFormat.split('/')[1].toUpperCase();

    const isUnderMax = bestBlob.size <= targetBytes;
    if (isUnderMax) {
      resCompliance.textContent = `Strictly under ${targetKb} KB Limit`;
      resCompliance.className = 'metric-val text-success';
    } else {
      resCompliance.textContent = `Exceeds by ${((bestBlob.size - targetBytes) / 1024).toFixed(1)} KB`;
      resCompliance.className = 'metric-val text-danger';
    }

    resultStatusTitle.textContent = 'Optimization Complete';
    resultDot.className = 'status-dot success';
    resultExecTime.textContent = `${duration} ms (${iterations} passes)`;

    btnDownload.disabled = false;
    isProcessing = false;
  }

  function canvasToBlobAsync(canvas, mimeType, quality) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, mimeType, quality);
    });
  }

  // --- Download Final Image ---
  window.downloadProcessedImage = function () {
    if (!processedBlob || !processedDataUrl) return;

    const link = document.createElement('a');
    let filename = 'exam_resizer_output.jpg';

    if (activePreset) {
      filename = `${activePreset.id}_compliant.jpg`;
    } else if (originalFile) {
      const ext = processedBlob.type === 'image/png' ? '.png' : processedBlob.type === 'image/webp' ? '.webp' : '.jpg';
      filename = `resized_${originalFile.name.replace(/\.[^/.]+$/, '')}${ext}`;
    }

    link.href = processedDataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Exam Directory Table Generation ---
  function renderExamTable(filterCat) {
    const tbody = document.getElementById('exam-table-body');
    if (!tbody || !window.EXAM_PRESETS_DATA) return;

    tbody.innerHTML = '';
    const filtered = filterCat === 'all' 
      ? window.EXAM_PRESETS_DATA 
      : window.EXAM_PRESETS_DATA.filter(item => item.category === filterCat);

    filtered.forEach(item => {
      const tr = document.createElement('tr');
      const isPhoto = item.type === 'photo';

      tr.innerHTML = `
        <td>
          <span class="table-exam-title">${item.name}</span>
          <span class="table-exam-sub">${item.authority}</span>
        </td>
        <td>
          <div>${item.cycle}</div>
          <a href="${item.sourceUrl}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-cyan); font-size:0.75rem;">Official PDF Source &rarr;</a>
        </td>
        <td>
          <strong>${item.width} × ${item.height} px</strong><br>
          <span style="color:var(--text-muted); font-size:0.75rem;">${item.physicalDim}</span><br>
          <span style="color:var(--accent-cyan); font-size:0.75rem; font-family:var(--font-mono);">${item.minKb} KB – ${item.maxKb} KB</span>
        </td>
        <td>
          <span style="color:var(--text-muted); font-size:0.8rem;">${item.bgColor}</span>
        </td>
        <td>
          <span class="status-pill-verified">
            ✓ ${item.verifiedDate}
          </span>
        </td>
        <td>
          <button type="button" class="btn btn-sm btn-outline" onclick="applyExamPreset('${item.id}')">
            Load Preset
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  window.filterExamTable = function (cat, tabBtn) {
    document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
    tabBtn.classList.add('active');
    renderExamTable(cat);
  };

  // --- Report Modal & Navigation Handlers ---
  window.openReportModal = function () {
    document.getElementById('report-modal').style.display = 'flex';
  };

  window.closeReportModal = function () {
    document.getElementById('report-modal').style.display = 'none';
  };

  window.handleReportSubmit = function (e) {
    e.preventDefault();
    document.getElementById('report-feedback').style.display = 'block';
    setTimeout(() => {
      closeReportModal();
      document.getElementById('report-feedback').style.display = 'none';
      document.getElementById('report-form').reset();
    }, 2000);
  };

  window.navigateTo = function (sectionId) {
    let target = null;
    if (sectionId === 'home') target = document.getElementById('hero');
    else if (sectionId === 'exams') target = document.getElementById('exam-directory');
    else if (sectionId === 'kb-tools') target = document.getElementById('kb-tools');
    else if (sectionId === 'guides') target = document.getElementById('guides');
    else if (sectionId === 'policy') target = document.getElementById('verification-policy');

    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }

    // Active nav class
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === `#${sectionId}`);
    });
  };

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  }

})();
