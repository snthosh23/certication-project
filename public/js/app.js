// Client App Logic

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMobileNav();
  initSearchTabs();
  initVerificationSearch();
  initQRScanner();
  loadPublicActivityLogs();
});

// 1. Theme Configuration (Light / Dark Mode)
function initTheme() {
  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;

  const currentTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', currentTheme);

  themeToggle.addEventListener('click', () => {
    let theme = document.documentElement.getAttribute('data-theme');
    let targetTheme = theme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', targetTheme);
    localStorage.setItem('theme', targetTheme);
  });
}

// 2. Mobile Responsive Nav Hamburger
function initMobileNav() {
  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('navMenu');
  
  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
      const icon = menuToggle.querySelector('i');
      if (navMenu.classList.contains('open')) {
        icon.className = 'fa-solid fa-xmark';
      } else {
        icon.className = 'fa-solid fa-bars';
      }
    });

    // Close menu when clicking links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        menuToggle.querySelector('i').className = 'fa-solid fa-bars';
      });
    });
  }
}

// 3. Search Panel Tabs Toggles
function initSearchTabs() {
  const tabId = document.getElementById('tabId');
  const tabQr = document.getElementById('tabQr');
  const idSection = document.getElementById('idSearchSection');
  const qrSection = document.getElementById('qrScannerSection');
  
  if (tabId && tabQr && idSection && qrSection) {
    tabId.addEventListener('click', () => {
      tabId.classList.add('active');
      tabQr.classList.remove('active');
      idSection.style.display = 'flex';
      qrSection.style.display = 'none';
      stopScanner();
    });
    
    tabQr.addEventListener('click', () => {
      tabQr.classList.add('active');
      tabId.classList.remove('active');
      qrSection.style.display = 'flex';
      idSection.style.display = 'none';
      startScanner();
    });
  }
}

// 4. Verification Form Submissions
function initVerificationSearch() {
  const verifyBtn = document.getElementById('verifyBtn');
  const certIdInput = document.getElementById('certIdInput');
  
  if (verifyBtn && certIdInput) {
    const performSearch = () => {
      const id = certIdInput.value.trim();
      if (!id) {
        showToast('Please enter a Certificate ID', 'warning');
        return;
      }
      window.location.href = `verify.html?id=${encodeURIComponent(id)}`;
    };

    verifyBtn.addEventListener('click', performSearch);
    certIdInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') performSearch();
    });
  }
}

// 5. QR Code Camera Scanning via html5-qrcode
let html5QrcodeScanner = null;

function startScanner() {
  const stopBtn = document.getElementById('stopScannerBtn');
  if (stopBtn) {
    stopBtn.style.display = 'inline-flex';
    stopBtn.onclick = () => {
      stopScanner();
      document.getElementById('tabId').click(); // switch back to ID search
    };
  }

  // Create Scanner instance
  html5QrcodeScanner = new Html5Qrcode("qr-reader");
  
  const qrCodeSuccessCallback = (decodedText) => {
    // Decoded QR text should contain URL, extract cert ID or verify directly
    try {
      stopScanner();
      
      let certId = decodedText;
      if (decodedText.includes('verify.html?id=')) {
        const url = new URL(decodedText);
        certId = url.searchParams.get('id');
      } else if (decodedText.startsWith('http')) {
        // Fallback: If it's a full URL of the system
        window.location.href = decodedText;
        return;
      }
      
      window.location.href = `verify.html?id=${encodeURIComponent(certId)}`;
    } catch (err) {
      console.error('QR parsing error:', err);
      showToast('Invalid QR Code configuration scanned', 'error');
    }
  };
  
  const config = { fps: 15, qrbox: { width: 220, height: 220 } };
  
  // Choose camera (back camera preferred for mobiles)
  html5QrcodeScanner.start(
    { facingMode: "environment" }, 
    config, 
    qrCodeSuccessCallback
  ).catch(err => {
    console.error('Camera Access Error:', err);
    showToast('Failed to access camera feed. Please check permissions.', 'error');
    document.getElementById('tabId').click();
  });
}

function stopScanner() {
  if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
    html5QrcodeScanner.stop().then(() => {
      html5QrcodeScanner = null;
    }).catch(err => console.error('Error stopping scanner:', err));
  }
}

// 6. Recent Verification Timeline feed
async function loadPublicActivityLogs() {
  const tableBody = document.getElementById('publicLogsBody');
  if (!tableBody) return;

  try {
    const res = await fetch('/api/analytics/verifications?limit=5');
    const data = await res.json();

    if (data.success && data.logs && data.logs.length > 0) {
      tableBody.innerHTML = '';
      data.logs.forEach(log => {
        const dateStr = new Date(log.timestamp).toLocaleString('en-US', {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        
        let statusBadge = `<span class="badge status-success">Valid</span>`;
        if (log.status === 'Failed') {
          statusBadge = `<span class="badge status-failed">Invalid</span>`;
        }

        // Simplify user agent
        let platform = 'Mobile/Web';
        if (log.userAgent.toLowerCase().includes('windows')) platform = 'Windows';
        else if (log.userAgent.toLowerCase().includes('macintosh')) platform = 'macOS';
        else if (log.userAgent.toLowerCase().includes('android')) platform = 'Android';
        else if (log.userAgent.toLowerCase().includes('iphone')) platform = 'iOS';

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${log.certificateId}</strong></td>
          <td>${statusBadge}</td>
          <td>${dateStr}</td>
          <td><i class="fa-solid fa-desktop" style="font-size: 0.8rem; margin-right: 0.4rem;"></i> ${platform}</td>
        `;
        tableBody.appendChild(tr);
      });
    } else {
      tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No validation inquiries logged yet.</td></tr>';
    }
  } catch (error) {
    console.error('Could not load verification timeline:', error);
    tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Failed to load activity logs feed.</td></tr>';
  }
}
