import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({ baseURL: API_BASE, headers: { 'Content-Type': 'application/json' } });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status === 401) {
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const res = await axios.post(`${API_BASE}/api/v1/auth/refresh`, { refresh_token: refresh });
          const newToken = res.data.data.access_token;
          localStorage.setItem('access_token', newToken);
          error.config.headers.Authorization = `Bearer ${newToken}`;
          return axios(error.config);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ── Auth ──────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email, password) => api.post('/api/v1/auth/login', { email, password }),
  logout: () => api.post('/api/v1/auth/logout'),
  refresh: (token) => api.post('/api/v1/auth/refresh', { refresh_token: token }),
  me: () => api.get('/api/v1/auth/me'),
  changePassword: (newPassword) => api.post('/api/v1/auth/change-password', { new_password: newPassword }),
};

// ── Source ────────────────────────────────────────────────────────────────
export const sourceApi = {
  uploadResume: (file, jobRoleId) => {
    const fd = new FormData(); fd.append('file', file);
    if (jobRoleId) fd.append('job_role_id', jobRoleId);
    return api.post('/api/v1/source/upload-resume', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  searchCandidates: (params) => api.get('/api/v1/source/candidates/search', { params }),
  getCandidate: (id, params) => api.get(`/api/v1/source/candidates/${id}`, { params }),

  listJobRoles: () => api.get('/api/v1/source/job-roles'),
  createJobRole: (data) => api.post('/api/v1/source/job-roles', data),
  deleteJobRole: (id) => api.delete(`/api/v1/source/job-roles/${id}`),
  deleteAllJobRoles: () => api.delete('/api/v1/source/job-roles'),
  sendInvite: (data) => api.post('/api/v1/source/send-invite', data),
  inviteStatus: (jobRoleId) => api.get(`/api/v1/source/invite-status/${jobRoleId}`),
  previewOfferLetter: (id, data) => api.post(`/api/v1/source/candidates/${id}/offer-preview`, data),
  convertCandidate: (id, data) => api.post(`/api/v1/source/candidates/${id}/convert`, data),
  convertToEmployee: (id, data) => api.post(`/api/v1/source/candidates/${id}/convert`, data),
  scoreCandidates: (data) => api.post('/api/v1/source/score-candidates', data),
  deleteCandidate: (id) => api.delete(`/api/v1/source/candidates/${id}`),
  activeCandidates: () => api.get('/api/v1/source/active-candidates'),
  revertToCandidate: (id) => api.post(`/api/v1/source/employees/${id}/revert`),
  getBulkUploads: () => api.get('/api/v1/source/bulk-uploads'),
  getBulkUploadStatus: (id) => api.get(`/api/v1/source/bulk-uploads/${id}`),
  cancelBulkUpload: (id) => api.post(`/api/v1/source/bulk-uploads/${id}/cancel`, {}),
};

// ── Verify ────────────────────────────────────────────────────────────────
export const verifyApi = {
  createAssessment: (data) => api.post('/api/v1/verify/assessments', data),
  listAssessments: () => api.get('/api/v1/verify/assessments'),
  getAssessment: (id) => api.get(`/api/v1/verify/assessments/${id}`),
  publishAssessment: (id) => api.post(`/api/v1/verify/assessments/${id}/publish`),
  assignAssessment: (id, data) => api.post(`/api/v1/verify/assessments/${id}/assign`, data),
  myAssessments: () => api.get('/api/v1/verify/my-assessments'),
  submitAssessment: (data) => api.post('/api/v1/verify/submit', data),
  runCode: (data) => api.post('/api/v1/verify/run-code', data),
  generateCodingMeta: (data) => api.post('/api/v1/verify/generate-coding-meta', data),
  myResults: () => api.get('/api/v1/verify/my-results'),
  getResult: (id) => api.get(`/api/v1/verify/result/${id}`),
  leaderboard: (id) => api.get(`/api/v1/verify/leaderboard/${id}`),
  analytics: (id) => api.get(`/api/v1/verify/analytics/${id}`),
  assessmentSubmissions: (id) => api.get(`/api/v1/verify/assessments/${id}/submissions`),
  releaseResult: (id) => api.post(`/api/v1/verify/result/${id}/release`),
  importQuestions: (formData) => api.post('/api/v1/verify/import-questions', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  importFromUrl: (url) => api.post('/api/v1/verify/import-url', { url }),
  randomizeAssessment: (data) => api.post('/api/v1/verify/randomize-assessment', data),
  getUserResults: (userId) => api.get(`/api/v1/verify/users/${userId}/results`),
  uploadQuestionImage: (file) => {
    const fd = new FormData(); fd.append('file', file);
    return api.post('/api/v1/verify/questions/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  uploadSubmissionFile: (file) => {
    const fd = new FormData(); fd.append('file', file);
    return api.post('/api/v1/verify/submissions/upload-file', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// ── Forge ─────────────────────────────────────────────────────────────────
export const forgeApi = {
  dashboard: () => api.get('/api/v1/forge/dashboard'),
  createCourse: (data) => api.post('/api/v1/forge/courses', data),
  listCourses: () => api.get('/api/v1/forge/courses'),
  getCourse: (id) => api.get(`/api/v1/forge/courses/${id}`),
  updateCourse: (id, data) => api.put(`/api/v1/forge/courses/${id}`, data),
  deleteCourse: (id) => api.delete(`/api/v1/forge/courses/${id}`),
  publishCourse: (id) => api.post(`/api/v1/forge/courses/${id}/publish`),
  submitForReview: (id) => api.post(`/api/v1/forge/courses/${id}/submit-review`),
  courseEnrollments: (id) => api.get(`/api/v1/forge/courses/${id}/enrollments`),
  library: (params) => api.get('/api/v1/forge/library', { params }),
  myCourses: () => api.get('/api/v1/forge/my-courses'),
  enroll: (courseId) => api.post('/api/v1/forge/enroll', null, { params: { course_id: courseId } }),
  bulkEnroll: (data) => api.post('/api/v1/forge/bulk-enroll', data),
  completeSection: (sectionId, data) => api.post(`/api/v1/forge/sections/${sectionId}/complete`, data),
  myCertificates: (userId) => api.get(`/api/v1/forge/certificates/${userId}`),
  verifyCertificate: (code) => api.get(`/api/v1/forge/verify-certificate/${code}`),
  teamAnalytics: () => api.get('/api/v1/forge/team-analytics'),
  transcript: () => api.get('/api/v1/forge/transcript'),
  uploadVideo: (fileData) => api.post('/api/v1/forge/upload-video', fileData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  bulkUploadZip: (file) => {
    // For large raw binary uploads, we want to avoid Axios transformations
    return api.post('/api/v1/forge/courses/bulk-zip', file, {
      headers: {
        'Content-Type': 'application/zip',
        'X-Filename': file?.name || 'course-package.zip',
      },
      transformRequest: [(data) => data], // Don't transform the File object
    });
  },
};

// ── Deploy ────────────────────────────────────────────────────────────────
export const deployApi = {
  listEmployees: (params) => api.get('/api/v1/deploy/employees', { params }),
  getEmployee: (id) => api.get(`/api/v1/deploy/employees/${id}`),
  createEmployee: (data) => api.post('/api/v1/deploy/employees', data),
  updateEmployee: (id, data) => api.put(`/api/v1/deploy/employees/${id}`, data),
  addSkill: (empId, data) => api.post(`/api/v1/deploy/employees/${empId}/skills`, data),
  removeSkill: (empId, skillId) => api.delete(`/api/v1/deploy/employees/${empId}/skills/${skillId}`),
  departments: () => api.get('/api/v1/deploy/departments'),
  myProfile: () => api.get('/api/v1/deploy/my-profile'),
  skillMap: (params) => api.get('/api/v1/deploy/skill-map', { params }),
  createProject: (data) => api.post('/api/v1/deploy/project-requirements', data),
  listProjects: () => api.get('/api/v1/deploy/project-requirements'),
  matchProject: (id) => api.get(`/api/v1/deploy/project-match/${id}`),
  assign: (employeeIds, requirementId) => api.post('/api/v1/deploy/assign', employeeIds, { params: { project_requirement_id: requirementId } }),
  analytics: () => api.get('/api/v1/deploy/analytics'),
  analyticsDetailed: () => api.get('/api/v1/deploy/analytics/detailed'),
  // Attendance
  getTodayStatus: () => api.get('/api/v1/deploy/attendance/status'),
  clockIn: () => api.post('/api/v1/deploy/attendance/clock-in'),
  clockOut: (data) => api.post('/api/v1/deploy/attendance/clock-out', data),
  getAttendance: (params) => api.get('/api/v1/deploy/attendance', { params }),
  myAttendance: (params) => api.get('/api/v1/deploy/attendance', { params }),
  teamAttendance: () => api.get('/api/v1/deploy/attendance/team'),
  // Leave
  getLeaveBalance: (empId) => api.get('/api/v1/deploy/leave/balance', { params: { employee_id: empId } }),
  applyLeave: (data) => api.post('/api/v1/deploy/leave/apply', data),
  requestLeave: (data) => api.post('/api/v1/deploy/leave/apply', data),
  leaveRequests: (params) => api.get('/api/v1/deploy/leave/requests', { params }),
  approveLeave: (id, approve, reason = null) => api.put(`/api/v1/deploy/leave/${id}/approve`, { approve, reason }),
  offboardEmployee: (id, data) => api.post(`/api/v1/deploy/employees/${id}/offboard`, data),
  uploadEmployeeDocuments: (id, formData) => api.post(`/api/v1/deploy/employees/${id}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  // KRA & Training
  listKras: () => api.get('/api/v1/deploy/kra/library'),
  createKra: (data) => api.post('/api/v1/deploy/kra/library', data),
  requestAssessment: (params) => api.post('/api/v1/deploy/kra/assessments/request', null, { params }),
  listAssessments: (params) => api.get('/api/v1/deploy/kra/assessments', { params }),
  listPrograms: () => api.get('/api/v1/deploy/training/programs'),
  createProgram: (data) => api.post('/api/v1/deploy/training/programs', data),
  assignTraining: (data) => api.post('/api/v1/deploy/training/assign', data),
  // Payroll
  getPayrollList: (employeeId) => api.get(`/api/v1/deploy/employees/${employeeId}/payroll`),
  createPayroll: (employeeId, data) => api.post(`/api/v1/deploy/employees/${employeeId}/payroll`, data),
};

// ── Onboarding ────────────────────────────────────────────────────────────
export const onboardingApi = {
  getInvites: () => api.get('/api/v1/onboarding/invites'),
  sendInvite: (data) => api.post('/api/v1/onboarding/invite', data),
  verifyInvite: (token) => api.get(`/api/v1/onboarding/verify-token/${token}`),
  completeSetup: (data) => api.post('/api/v1/onboarding/complete', data),
};

// ── Notifications ─────────────────────────────────────────────────────────
export const notificationsApi = {
  list: () => api.get('/api/v1/notifications'),
  markRead: (id) => api.put(`/api/v1/notifications/${id}/read`),
};

// ── Admin ─────────────────────────────────────────────────────────────────
export const adminApi = {
  listUsers: (params) => api.get('/api/v1/admin/users', { params }),
  createUser: (data) => api.post('/api/v1/admin/users', data),
  updateRole: (id, role) => api.put(`/api/v1/admin/users/${id}/role`, null, { params: { role } }),
  toggleActive: (id) => api.put(`/api/v1/admin/users/${id}/toggle-active`),
  orgSettings: () => api.get('/api/v1/admin/org-settings'),
  updateOrgSettings: (data) => api.put('/api/v1/admin/org-settings', data),
  listSkills: (q) => api.get('/api/v1/admin/skills', { params: { q } }),
};

// ── Journey ───────────────────────────────────────────────────────────────
export const journeyApi = {
  createJourney: (data) => api.post('/api/v1/journey/journeys', data),
  listJourneys: () => api.get('/api/v1/journey/journeys'),
  getJourney: (id) => api.get(`/api/v1/journey/journeys/${id}`),
  updateJourney: (id, data) => api.patch(`/api/v1/journey/journeys/${id}`, data),
  assignJourney: (id, data) => api.post(`/api/v1/journey/journeys/${id}/assign`, data),
  myJourneys: () => api.get('/api/v1/journey/my-journeys'),
};

// ── Leads ─────────────────────────────────────────────────────────────────
export const leadsApi = {
  submitLead: (data) => api.post('/api/v1/leads', data),
  listLeads: () => api.get('/api/v1/leads/platform'),
  updateStatus: (id, status) => api.patch(`/api/v1/leads/platform/${id}`, { status }),
};
