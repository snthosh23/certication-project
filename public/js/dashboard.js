// Admin Dashboard Management Script

let currentUser = null;
let currentCertificatesPage = 1;
let currentCertificatesTotalPages = 1;
let certificatesSearchQuery = '';
let certificatesStatusFilter = '';
let certificatesCourseFilter = '';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Theme
  initTheme();

  // Guard Check
  if (!isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  // Load Admin Profile
  loadUserProfile();

  // Navigation Tabs Toggles
  initDashboardTabs();

  // Load Overview Data & Charts
  loadOverviewData();

  // Certificates CRUD operations
  initCertificatesTab();

  // Bulk CSV file drop and templates
  initBulkTab();

  // User Management
  initUsersTab();

  // Branding Customization setup
  initBrandingTab();

  // Audit logs tab
  initAuditTab();

  // Mobile Menu toggles and overlay handler
  const sbToggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  if (sbToggle && sidebar) {
    sbToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }
  if (sidebarOverlay && sidebar) {
    sidebarOverlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
    });
  }
});

// Theme Configuration (Light / Dark Mode)
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

    // Re-render charts with new theme colors if on overview tab
    const overviewTab = document.getElementById('tab-overview');
    if (overviewTab && overviewTab.style.display !== 'none') {
      loadOverviewData();
    }
  });
}

// 1. User Profile Setup
async function loadUserProfile() {
  try {
    const token = getAuthToken();
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    
    if (data.success) {
      currentUser = data.user;
      document.getElementById('welcomeUser').innerText = `Welcome back, ${currentUser.username}`;
      const badge = document.getElementById('userRoleBadge');
      badge.innerText = currentUser.role;
      badge.className = `badge role-${currentUser.role === 'SuperAdmin' ? 'super' : 'admin'}`;
      
      // Show SuperAdmin-only elements
      if (currentUser.role === 'SuperAdmin') {
        document.querySelectorAll('.superadmin-only').forEach(el => el.style.display = 'block');
      }
    } else {
      // Session invalid, redirect
      clearAuth();
      window.location.href = 'login.html';
    }
  } catch (error) {
    console.error('Error fetching admin profile:', error);
  }
}

// 2. Tab Navigation controls
function initDashboardTabs() {
  const links = document.querySelectorAll('.sidebar-link[data-tab]');
  const sections = document.querySelectorAll('.tab-section');
  
  links.forEach(link => {
    link.addEventListener('click', () => {
      const tabId = link.getAttribute('data-tab');
      
      links.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      
      sections.forEach(sec => {
        if (sec.id === tabId) {
          sec.style.display = 'block';
        } else {
          sec.style.display = 'none';
        }
      });

      // Reload appropriate tab data on view switch
      if (tabId === 'tab-overview') loadOverviewData();
      if (tabId === 'tab-certificates') {
        loadCourseFilterOptions();
        loadCertificates(1);
      }
      if (tabId === 'tab-users') loadUsers();
      if (tabId === 'tab-audit') loadAuditLogs(1);

      // Close mobile sidebar
      document.getElementById('sidebar').classList.remove('open');
    });
  });
}

// 3. Load Overview tab Counters and Chart.js datasets
let courseChartInstance = null;
let statusChartInstance = null;

async function loadOverviewData() {
  try {
    const token = getAuthToken();
    const res = await fetch('/api/analytics/dashboard', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      // Update Counters
      document.getElementById('countIssued').innerText = data.counters.totalIssued;
      document.getElementById('countScans').innerText = data.counters.totalVerifications;
      document.getElementById('countUsers').innerText = data.counters.activeUsers;

      // Update Recent Verifications Table
      const tbody = document.getElementById('recentVerificationsTable');
      if (data.recentVerifications && data.recentVerifications.length > 0) {
        tbody.innerHTML = '';
        data.recentVerifications.forEach(v => {
          const dateStr = new Date(v.timestamp).toLocaleString();
          const badgeClass = v.status === 'Success' ? 'valid' : 'revoked';
          const badgeText = v.status === 'Success' ? 'Valid' : 'Invalid';
          
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${v.certificateId}</strong></td>
            <td>${v.certificateRef?.recipientName || 'Registry Lookup'}</td>
            <td>${v.certificateRef?.courseName || 'Unregistered Code'}</td>
            <td>${v.ipAddress}</td>
            <td>${dateStr}</td>
            <td><span class="badge ${badgeClass}">${badgeText}</span></td>
          `;
          tbody.appendChild(tr);
        });
      } else {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No activity logged yet.</td></tr>';
      }

      // Draw Charts
      renderOverviewCharts(data.charts);
    }
  } catch (err) {
    console.error('Overview loading failed:', err);
  }
}

function renderOverviewCharts(chartData) {
  // Chart.js requires script imports (defered in HTML)
  if (typeof Chart === 'undefined') return;

  const barCtx = document.getElementById('courseBarChart').getContext('2d');
  const pieCtx = document.getElementById('statusPieChart').getContext('2d');

  // Destroy previous instances to avoid rendering issues
  if (courseChartInstance) courseChartInstance.destroy();
  if (statusChartInstance) statusChartInstance.destroy();

  // Check if datasets are empty
  const hasCourses = chartData.courseBreakdown && chartData.courseBreakdown.length > 0;
  const hasStatus = chartData.statusBreakdown.valid > 0 || chartData.statusBreakdown.revoked > 0;

  // Determine current theme colors
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#cbd5e1' : '#475569';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
  const borderColor = isDark ? '#0f172a' : '#ffffff';

  // Render Bar Chart (Top Courses)
  courseChartInstance = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: hasCourses ? chartData.courseBreakdown.map(c => c.course) : ['No Data'],
      datasets: [{
        label: 'Certificates Count',
        data: hasCourses ? chartData.courseBreakdown.map(c => c.count) : [0],
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderColor: '#3b82f6',
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: textColor }
        }
      },
      scales: {
        y: { 
          beginAtZero: true, 
          grid: { color: gridColor },
          ticks: { color: textColor }
        },
        x: { 
          grid: { display: false },
          ticks: { color: textColor }
        }
      }
    }
  });

  // Render Pie Chart (Valid vs Revoked status)
  statusChartInstance = new Chart(pieCtx, {
    type: 'doughnut',
    data: {
      labels: ['Valid', 'Revoked'],
      datasets: [{
        data: hasStatus ? [chartData.statusBreakdown.valid, chartData.statusBreakdown.revoked] : [1, 0],
        backgroundColor: ['#10b981', '#ef4444'],
        borderWidth: 2,
        borderColor: borderColor
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { 
          position: 'bottom',
          labels: { color: textColor }
        }
      }
    }
  });
}

// 4. Certificates CRUD operations
function initCertificatesTab() {
  const searchInput = document.getElementById('certSearchInput');
  const openModal = document.getElementById('openIssueModalBtn');
  const closeModal = document.getElementById('closeIssueModal');
  const cancelBtn = document.getElementById('cancelIssueBtn');
  const issueForm = document.getElementById('issueCertForm');
  const issueModal = document.getElementById('issueCertModal');

  // Search and filter listeners
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      certificatesSearchQuery = e.target.value;
      loadCertificates(1);
    });
  }

  const statusFilter = document.getElementById('certStatusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      certificatesStatusFilter = e.target.value;
      loadCertificates(1);
    });
  }

  const courseFilter = document.getElementById('certCourseFilter');
  if (courseFilter) {
    courseFilter.addEventListener('change', (e) => {
      certificatesCourseFilter = e.target.value;
      loadCertificates(1);
    });
  }

  // Modal display toggles
  if (openModal) openModal.addEventListener('click', () => issueModal.classList.add('active'));
  if (closeModal) closeModal.addEventListener('click', () => issueModal.classList.remove('active'));
  if (cancelBtn) cancelBtn.addEventListener('click', () => issueModal.classList.remove('active'));

  // Issue Certificate form submit
  if (issueForm) {
    issueForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const token = getAuthToken();
      const formData = new FormData();
      
      formData.append('recipientName', document.getElementById('recipientNameInput').value);
      formData.append('recipientEmail', document.getElementById('recipientEmailInput').value);
      formData.append('courseName', document.getElementById('courseNameInput').value);
      formData.append('organization', document.getElementById('orgInput').value);
      formData.append('expiryDate', document.getElementById('expiryDateInput').value);

      // Append branding config parameters
      const branding = getSavedBranding();
      formData.append('templateConfig[primaryColor]', branding.primaryColor);
      formData.append('templateConfig[secondaryColor]', branding.secondaryColor);
      formData.append('templateConfig[customText]', branding.customText);

      // Append files if selected
      const logoInput = document.getElementById('brandLogoInput');
      const bgInput = document.getElementById('brandBgInput');
      if (logoInput && logoInput.files[0]) formData.append('logo', logoInput.files[0]);
      if (bgInput && bgInput.files[0]) formData.append('backgroundImage', bgInput.files[0]);

      try {
        const res = await fetch('/api/certificates', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });

        const data = await res.json();
        if (data.success) {
          showToast('Certificate generated successfully!', 'success');
          issueForm.reset();
          issueModal.classList.remove('active');
          loadCertificates(1);
        } else {
          showToast(data.message || 'Issuance failed', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('Error issuing certificate', 'error');
      }
    });
  }

  // Pagination page click events
  document.getElementById('prevPageBtn').addEventListener('click', () => {
    if (currentCertificatesPage > 1) loadCertificates(currentCertificatesPage - 1);
  });

  document.getElementById('nextPageBtn').addEventListener('click', () => {
    if (currentCertificatesPage < currentCertificatesTotalPages) loadCertificates(currentCertificatesPage + 1);
  });

  // Edit Certificate form logic
  const editModal = document.getElementById('editCertModal');
  const closeEdit = document.getElementById('closeEditModal');
  const cancelEdit = document.getElementById('cancelEditBtn');
  const editForm = document.getElementById('editCertForm');

  if (closeEdit) closeEdit.addEventListener('click', () => editModal.classList.remove('active'));
  if (cancelEdit) cancelEdit.addEventListener('click', () => editModal.classList.remove('active'));

  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const token = getAuthToken();
      const id = document.getElementById('editCertIdHidden').value;
      const body = {
        recipientName: document.getElementById('editRecipientNameInput').value,
        recipientEmail: document.getElementById('editRecipientEmailInput').value,
        courseName: document.getElementById('editCourseNameInput').value,
        organization: document.getElementById('editOrgInput').value,
        status: document.getElementById('editStatusInput').value
      };

      try {
        const res = await fetch(`/api/certificates/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(body)
        });

        const data = await res.json();
        if (data.success) {
          showToast('Certificate entry updated', 'success');
          editModal.classList.remove('active');
          loadCertificates(currentCertificatesPage);
        } else {
          showToast(data.message || 'Update failed', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('Error updating entry', 'error');
      }
    });
  }
}

async function loadCertificates(page) {
  const tbody = document.getElementById('certificatesListTable');
  if (!tbody) return;

  try {
    const token = getAuthToken();
    const res = await fetch(`/api/certificates?page=${page}&limit=8&search=${encodeURIComponent(certificatesSearchQuery)}&status=${certificatesStatusFilter}&course=${encodeURIComponent(certificatesCourseFilter)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      tbody.innerHTML = '';
      currentCertificatesPage = data.currentPage;
      currentCertificatesTotalPages = data.pages;

      // Update Pagination state
      document.getElementById('paginationInfo').innerText = `Showing ${(data.currentPage - 1) * 8 + 1} to ${(data.currentPage - 1) * 8 + data.certificates.length} of ${data.total} records`;
      document.getElementById('prevPageBtn').disabled = currentCertificatesPage <= 1;
      document.getElementById('nextPageBtn').disabled = currentCertificatesPage >= currentCertificatesTotalPages;

      if (data.certificates.length > 0) {
        data.certificates.forEach(c => {
          const dateStr = new Date(c.issueDate).toLocaleDateString();
          const badgeClass = c.status.toLowerCase();
          
          const isSuper = currentUser && currentUser.role === 'SuperAdmin';
          const delBtn = isSuper 
            ? `<button class="pagination-btn delete-btn" onclick="deleteCertificateClick('${c.certificateId}')" style="background: rgba(239,68,68,0.1); color: var(--danger); border-color: rgba(239,68,68,0.2);"><i class="fa-solid fa-trash"></i></button>`
            : '';

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${c.certificateId}</strong></td>
            <td>${c.recipientName}</td>
            <td>${c.courseName}</td>
            <td>${dateStr}</td>
            <td>${c.verificationCount}</td>
            <td><span class="badge ${badgeClass}">${c.status}</span></td>
            <td>
              <div style="display: flex; gap: 0.4rem;">
                <button class="pagination-btn" onclick="editCertificateClick('${c.certificateId}', '${c.recipientName}', '${c.recipientEmail}', '${c.courseName}', '${c.organization}', '${c.status}')"><i class="fa-solid fa-pen"></i></button>
                <button class="pagination-btn" onclick="emailCertificateClick('${c.certificateId}')" style="background: rgba(124,58,237,0.1); color: var(--color-secondary); border-color: rgba(124,58,237,0.2);" title="Email to Recipient"><i class="fa-solid fa-paper-plane"></i></button>
                <a href="/api/certificates/download/${c.certificateId}" class="pagination-btn" style="background: rgba(37,99,235,0.1); color: var(--color-primary); border-color: rgba(37,99,235,0.2); display: inline-flex; align-items: center;" title="Download PDF"><i class="fa-solid fa-download"></i></a>
                ${delBtn}
              </div>
            </td>
          `;
          tbody.appendChild(tr);
        });
      } else {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No certificates match this criteria.</td></tr>';
      }
    }
  } catch (err) {
    console.error('Certificates retrieval failed:', err);
  }
}

// Global scope action definitions for table click row events
window.editCertificateClick = (id, name, email, course, org, status) => {
  document.getElementById('editCertIdHidden').value = id;
  document.getElementById('editRecipientNameInput').value = name;
  document.getElementById('editRecipientEmailInput').value = email;
  document.getElementById('editCourseNameInput').value = course;
  document.getElementById('editOrgInput').value = org;
  document.getElementById('editStatusInput').value = status;

  document.getElementById('editCertModal').classList.add('active');
};

window.emailCertificateClick = async (id) => {
  if (!confirm(`Are you sure you want to share Certificate ID ${id} via email?`)) return;
  
  const token = getAuthToken();
  showToast('Sending email, please wait...', 'warning');

  try {
    const res = await fetch(`/api/certificates/${id}/email`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    
    if (data.success) {
      showToast('Certificate successfully emailed!', 'success');
    } else {
      showToast(data.message || 'Email dispatch failed', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Network error, check SMTP configs.', 'error');
  }
};

window.deleteCertificateClick = async (id) => {
  if (!confirm(`Are you sure you want to delete Certificate ID ${id}? This action is irreversible.`)) return;

  const token = getAuthToken();
  try {
    const res = await fetch(`/api/certificates/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    
    if (data.success) {
      showToast('Certificate permanently deleted', 'success');
      loadCertificates(currentCertificatesPage);
    } else {
      showToast(data.message || 'Deletion failed', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Error deleting entry', 'error');
  }
};

// 5. Bulk CSV Upload panel setup
function initBulkTab() {
  const dropzone = document.getElementById('csvDropzone');
  const fileInput = document.getElementById('bulkCsvInput');
  const fileNameDisplay = document.getElementById('csvFileName');
  const form = document.getElementById('bulkUploadForm');

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) {
        fileNameDisplay.innerText = fileInput.files[0].name;
      }
    });

    // Drag-drop events
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--color-primary)';
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.style.borderColor = 'var(--border-glass)';
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--border-glass)';
      if (e.dataTransfer.files[0]) {
        fileInput.files = e.dataTransfer.files;
        fileNameDisplay.innerText = e.dataTransfer.files[0].name;
      }
    });
  }

  // Handle upload form
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!fileInput.files[0]) {
        showToast('Please select a CSV file first', 'warning');
        return;
      }

      const token = getAuthToken();
      const formData = new FormData();
      formData.append('csvFile', fileInput.files[0]);

      showToast('Processing bulk files, please wait...', 'warning');

      try {
        const res = await fetch('/api/certificates/bulk', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });

        const data = await res.json();
        if (data.success) {
          showToast(`Bulk issue complete! Generated ${data.count} certificates.`, 'success');
          form.reset();
          fileNameDisplay.innerText = '';
        } else {
          showToast(data.message || 'Bulk generation failed', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('Error uploading file', 'error');
      }
    });
  }

  // Mock template generator download button
  const templateBtn = document.getElementById('downloadCsvTemplateBtn');
  if (templateBtn) {
    templateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const csvContent = "data:text/csv;charset=utf-8,Name,Email,Course,Organization\nJane Doe,jane@domain.com,Full Stack Web Engineering,Digital Certs Org\nJohn Smith,john.smith@domain.com,Cloud Architecture,Tech Academy";
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "bulk_cert_issuance_template.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }
}

// 6. User settings panel (SuperAdmin restricted)
function initUsersTab() {
  const openUser = document.getElementById('openUserModalBtn');
  const closeUser = document.getElementById('closeUserModal');
  const cancelUser = document.getElementById('cancelUserBtn');
  const userForm = document.getElementById('createUserForm');
  const userModal = document.getElementById('addUserModal');

  if (openUser) openUser.addEventListener('click', () => userModal.classList.add('active'));
  if (closeUser) closeUser.addEventListener('click', () => userModal.classList.remove('active'));
  if (cancelUser) cancelUser.addEventListener('click', () => userModal.classList.remove('active'));

  if (userForm) {
    userForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const token = getAuthToken();
      const body = {
        username: document.getElementById('newUsernameInput').value,
        email: document.getElementById('newEmailInput').value,
        password: document.getElementById('newPasswordInput').value,
        role: document.getElementById('newRoleInput').value
      };

      try {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(body)
        });

        const data = await res.json();
        if (data.success) {
          showToast('Admin user created successfully!', 'success');
          userForm.reset();
          userModal.classList.remove('active');
          loadUsers();
        } else {
          showToast(data.message || 'Creation failed', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('Error creating user profile', 'error');
      }
    });
  }
}

async function loadUsers() {
  const tbody = document.getElementById('usersListTable');
  if (!tbody) return;

  try {
    const token = getAuthToken();
    const res = await fetch('/api/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      tbody.innerHTML = '';
      data.users.forEach(u => {
        const badgeClass = u.role === 'SuperAdmin' ? 'role-super' : 'role-admin';
        const statusText = u.isActive ? 'Active' : 'Deactivated';
        const toggleBtnLabel = u.isActive ? 'Deactivate' : 'Activate';
        const isSelf = currentUser && currentUser.id === u._id;
        const disableAttr = isSelf ? 'disabled' : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${u.username}</strong></td>
          <td>${u.email}</td>
          <td><span class="badge ${badgeClass}">${u.role}</span></td>
          <td><span class="badge ${u.isActive ? 'valid' : 'revoked'}">${statusText}</span></td>
          <td>${u.permissions.join(', ')}</td>
          <td>
            <button class="pagination-btn" onclick="toggleUserStatusClick('${u._id}')" ${disableAttr} style="background: rgba(245,158,11,0.1); color: var(--warning); border-color: rgba(245,158,11,0.2);">${toggleBtnLabel}</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error('Users fetch failed:', err);
  }
}

window.toggleUserStatusClick = async (id) => {
  const token = getAuthToken();
  try {
    const res = await fetch(`/api/users/${id}/status`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      showToast(data.message, 'success');
      loadUsers();
    } else {
      showToast(data.message || 'Operation failed', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Error updating status', 'error');
  }
};

// 7. Branding configurations
function initBrandingTab() {
  const form = document.getElementById('brandingTemplateForm');
  const primaryColor = document.getElementById('brandPrimaryColor');
  const primaryHex = document.getElementById('brandPrimaryHex');
  const secondaryColor = document.getElementById('brandSecondaryColor');
  const secondaryHex = document.getElementById('brandSecondaryHex');

  // Sync inputs
  if (primaryColor && primaryHex) {
    primaryColor.addEventListener('input', (e) => primaryHex.value = e.target.value);
    primaryHex.addEventListener('input', (e) => primaryColor.value = e.target.value);
  }
  if (secondaryColor && secondaryHex) {
    secondaryColor.addEventListener('input', (e) => secondaryHex.value = e.target.value);
    secondaryHex.addEventListener('input', (e) => secondaryColor.value = e.target.value);
  }

  // Logo dropzone setups
  setupBrandingDropzones();

  // Load saved branding config to view inputs
  const saved = getSavedBranding();
  if (primaryColor) {
    primaryColor.value = saved.primaryColor;
    primaryHex.value = saved.primaryColor;
  }
  if (secondaryColor) {
    secondaryColor.value = saved.secondaryColor;
    secondaryHex.value = saved.secondaryColor;
  }
  const customTextArea = document.getElementById('brandCustomText');
  if (customTextArea) customTextArea.value = saved.customText;

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const config = {
        primaryColor: primaryHex.value,
        secondaryColor: secondaryHex.value,
        customText: document.getElementById('brandCustomText').value
      };
      
      localStorage.setItem('branding_config', JSON.stringify(config));
      showToast('Branding settings saved locally. Files are queued for next issued certificate.', 'success');
    });
  }
}

function getSavedBranding() {
  const saved = localStorage.getItem('branding_config');
  return saved ? JSON.parse(saved) : {
    primaryColor: '#2563eb',
    secondaryColor: '#7c3aed',
    customText: ''
  };
}

function setupBrandingDropzones() {
  const logoDrop = document.getElementById('logoDropzone');
  const logoInput = document.getElementById('brandLogoInput');
  const logoName = document.getElementById('logoFileName');

  if (logoDrop && logoInput) {
    logoDrop.addEventListener('click', () => logoInput.click());
    logoInput.addEventListener('change', () => {
      if (logoInput.files[0]) logoName.innerText = logoInput.files[0].name;
    });
  }

  const bgDrop = document.getElementById('bgDropzone');
  const bgInput = document.getElementById('brandBgInput');
  const bgName = document.getElementById('bgFileName');

  if (bgDrop && bgInput) {
    bgDrop.addEventListener('click', () => bgInput.click());
    bgInput.addEventListener('change', () => {
      if (bgInput.files[0]) bgName.innerText = bgInput.files[0].name;
    });
  }
}

// 8. System Activity logs panel
async function loadAuditLogs(page) {
  const tbody = document.getElementById('auditLogsTable');
  if (!tbody) return;

  try {
    const token = getAuthToken();
    const res = await fetch(`/api/analytics/audit?page=${page}&limit=12`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      tbody.innerHTML = '';
      if (data.logs && data.logs.length > 0) {
        data.logs.forEach(l => {
          const dateStr = new Date(l.timestamp).toLocaleString();
          
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${dateStr}</td>
            <td><strong>${l.username}</strong></td>
            <td>${l.action}</td>
            <td>${l.targetType}</td>
            <td><code>${l.targetId || 'N/A'}</code></td>
            <td>${l.ipAddress}</td>
          `;
          tbody.appendChild(tr);
        });
      } else {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No administrative events logged yet.</td></tr>';
      }
    }
  } catch (err) {
    console.error('Audit logs fetch failed:', err);
  }
}

function initAuditTab() {
  // Add pagination for audit logs if desired, but defaults to single page load for dashboard MVP simplicity.
}

async function loadCourseFilterOptions() {
  try {
    const token = getAuthToken();
    const res = await fetch('/api/certificates?limit=100', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success && data.certificates) {
      const courses = [...new Set(data.certificates.map(c => c.courseName))].sort();
      const courseFilterDropdown = document.getElementById('certCourseFilter');
      if (courseFilterDropdown) {
        const currentSelected = certificatesCourseFilter;
        courseFilterDropdown.innerHTML = '<option value="">All Courses</option>';
        courses.forEach(course => {
          const opt = document.createElement('option');
          opt.value = course;
          opt.innerText = course;
          if (course === currentSelected) {
            opt.selected = true;
          }
          courseFilterDropdown.appendChild(opt);
        });
      }
    }
  } catch (err) {
    console.error('Failed to load courses for filter:', err);
  }
}
