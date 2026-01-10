/**
 * ==========================================
 * SCHOLAR.AI - REFACTORED PRODUCTION SPA ENGINE
 * ==========================================
 * Architecture: ES6 Module Pattern with Error Boundaries
 * Version: 3.0.0
 * Author: Scholar.AI Engineering Team
 */

// ==========================================
// API CLIENT WITH ERROR HANDLING & RETRIES
// ==========================================
class ApiClient {
  constructor() {
    this.baseURL = this.getBaseURL();
    this.timeout = 30000;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
    this.refreshTokenPromise = null;
  }

  getBaseURL() {
    return window.location.hostname.includes('github.dev') || 
           window.location.hostname.includes('app.github.dev')
      ? 'https://studious-space-telegram-5gj47g7j6rvxhvv94-3000.app.github.dev/api/v1'
      : 'http://localhost:3000/api/v1';
  }

  async request(endpoint, options = {}, attempt = 1) {
    const url = `${this.baseURL}${endpoint}`;
    const token = this.loadFromStorage('scholar_token');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const config = {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      }
    };

    try {
      console.log('📡 API Request:', url, options.method || 'GET');

      const response = await fetch(url, config);
      clearTimeout(timeoutId);

      let data;
      try {
        data = await response.json();
      } catch (e) {
        data = { error: { message: 'Invalid response from server' } };
      }

      console.log('📡 API Response:', response.status, data);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          // Attempt token refresh before redirecting to login
          if (attempt <= this.retryAttempts) {
            const refreshed = await this.refreshToken();
            if (refreshed) {
              return this.request(endpoint, options, attempt + 1);
            }
          }
          
          // Clear session and redirect to login
          this.clearSession();
          throw new Error(data.error?.message || `Request failed with status ${response.status}`);
        }
        
        throw new Error(data.error?.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      if (attempt < this.retryAttempts) {
        console.warn(`Request failed, retrying (${attempt}/${this.retryAttempts}):`, error.message);
        await this.delay(this.retryDelay * attempt);
        return this.request(endpoint, options, attempt + 1);
      }
      
      console.error('❌ API Error:', error);
      throw error;
    }
  }

  async refreshToken() {
    if (this.refreshTokenPromise) {
      return this.refreshTokenPromise;
    }

    try {
      this.refreshTokenPromise = this.performTokenRefresh();
      const result = await this.refreshTokenPromise;
      return result;
    } finally {
      this.refreshTokenPromise = null;
    }
  }

  async performTokenRefresh() {
    try {
      const refreshToken = this.loadFromStorage('scholar_refresh_token');
      if (!refreshToken) {
        return false;
      }

      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (response.ok) {
        const data = await response.json();
        await this.saveToStorage('scholar_token', data.data.tokens.accessToken);
        await this.saveToStorage('scholar_refresh_token', data.data.tokens.refreshToken);
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }

    return false;
  }

  async get(endpoint) { 
    return this.request(endpoint, { method: 'GET' }); 
  }

  async post(endpoint, body) {
    console.log('📤 POST Body:', body);
    return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) });
  }

  async patch(endpoint, body) { 
    return this.request(endpoint, { method: 'PATCH', body: JSON.stringify(body) }); 
  }

  async delete(endpoint) { 
    return this.request(endpoint, { method: 'DELETE' }); 
  }

  async upload(endpoint, formData) {
    const url = `${this.baseURL}${endpoint}`;
    const token = this.loadFromStorage('scholar_token');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // Don't set Content-Type - browser sets it with boundary
        },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Upload failed');
      return data;
    } catch (error) {
      throw error;
    }
  }

  clearSession() {
    localStorage.removeItem('scholar_token');
    localStorage.removeItem('scholar_refresh_token');
    localStorage.removeItem('currentUser');
  }

  async saveToStorage(key, data) {
    try {
      await new Promise((resolve, reject) => {
        try {
          localStorage.setItem(key, JSON.stringify(data));
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    } catch (e) {
      console.error('Storage error:', e);
      throw e;
    }
  }

  loadFromStorage(key, defaultValue = null) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.error('Storage error:', e);
      return defaultValue;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ==========================================
// GLOBAL STATE MANAGEMENT
// ==========================================
class AppStateManager {
  constructor() {
    this.state = {
      user: null,
      classes: [],
      pdfs: [],
      tasks: [],
      activities: [],
      chatSessions: [],
      currentChatId: null,
      activeClassId: null,
      stats: {
        sessions: 0,
        quizScore: 0,
        documents: 0
      },
      settings: {
        theme: 'dark',
        aiModel: 'mistralai/mistral-7b-instruct:free',
        notifications: true,
        aiPersonality: 'friendly'
      }
    };
    this.listeners = [];
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.notifyListeners();
  }

  getState() {
    return { ...this.state };
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }
}

// ==========================================
// ERROR BOUNDARY FOR UI COMPONENTS
// ==========================================
class ErrorBoundary {
  constructor() {
    this.hasError = false;
    this.error = null;
  }

  static catchError(fn, fallback = null) {
    try {
      return fn();
    } catch (error) {
      console.error('Error caught by boundary:', error);
      return fallback;
    }
  }

  static async catchErrorAsync(fn, fallback = null) {
    try {
      return await fn();
    } catch (error) {
      console.error('Async error caught by boundary:', error);
      return fallback;
    }
  }
}

// ==========================================
// UTILITIES WITH ERROR HANDLING
// ==========================================
class Utils {
  static generateId() {
    return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static showToast(message, type = 'info') {
    console.log(`🔔 Toast: [${type}] ${message}`);

    const container = document.getElementById('toastContainer');
    if (!container) {
      console.error('❌ Toast container not found');
      return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type} animate__animated animate__fadeInRight`;

    const icons = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      info: 'fa-info-circle'
    };

    toast.innerHTML = `
      <i class="fas ${icons[type]}"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove('animate__fadeInRight');
      toast.classList.add('animate__fadeOutRight');
      setTimeout(() => toast.remove(), 500);
    }, 4000);
  }

  static showLoader(message = 'Processing...') {
    const loader = document.getElementById('globalLoader');
    const text = loader.querySelector('.loader-text');
    if (text) text.textContent = message;
    loader.style.display = 'flex';
  }

  static hideLoader() {
    const loader = document.getElementById('globalLoader');
    if (loader) loader.style.display = 'none';
  }

  static formatDate(date) {
    try {
      const d = new Date(date);
      const now = new Date();
      const diff = now - d;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days < 7) return `${days}d ago`;
      return d.toLocaleDateString();
    } catch (e) {
      console.error('Date formatting error:', e);
      return 'Unknown';
    }
  }

  static async animateNumber(element, start, end, duration = 1000) {
    if (!element) return;
    
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
      current += increment;
      if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
        element.textContent = Math.round(end);
        clearInterval(timer);
      } else {
        element.textContent = Math.round(current);
      }
    }, 16);
  }

  static async saveToStorage(key, data) {
    try {
      await new Promise((resolve, reject) => {
        try {
          localStorage.setItem(key, JSON.stringify(data));
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    } catch (e) {
      console.error('Storage error:', e);
      throw e;
    }
  }

  static loadFromStorage(key, defaultValue = null) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.error('Storage error:', e);
      return defaultValue;
    }
  }
}

// ==========================================
// AUTHENTICATION MODULE
// ==========================================
class AuthModule {
  constructor(apiClient, stateManager) {
    this.apiClient = apiClient;
    this.stateManager = stateManager;
  }

  async init() {
    console.log('🚀 AuthModule initializing...');

    // Wait for DOM
    if (document.readyState === 'loading') {
      await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
    }

    const splash = document.getElementById('splashScreen');
    const loginContainer = document.getElementById('loginContainer');
    const signupContainer = document.getElementById('signupContainer');
    const appLayer = document.getElementById('appLayer');

    // Bind events immediately
    this.bindEvents();

    // Hide splash and check session
    setTimeout(async () => {
      try {
        const token = this.apiClient.loadFromStorage('scholar_token');

        if (token) {
          console.log('🔍 Verifying session...');
          const response = await this.apiClient.get('/auth/me');
          this.stateManager.setState({ user: response.data.user });


          this.loadApp();
        } else {
          throw new Error('No session');
        }
      } catch (error) {
        console.log('ℹ️ Showing login screen');
        this.apiClient.clearSession();
        this.stateManager.setState({ user: null });

        if (appLayer) appLayer.style.display = 'none';
        if (signupContainer) signupContainer.style.display = 'none';
        if (loginContainer) {
          loginContainer.style.display = 'flex';
          loginContainer.classList.add('show');
        }
      } finally {
        if (splash) {
          splash.style.opacity = '0';
          setTimeout(() => splash.style.display = 'none', 500);
        }
      }
    }, 1500);
  }

  bindEvents() {
    console.log('🔗 Binding events...');

    // Use event delegation on a parent element
    const authContainer = document.body;

    authContainer.addEventListener('submit', (e) => {
      if (e.target.id === 'loginForm') {
        e.preventDefault();
        console.log('🔥 LOGIN FORM SUBMITTED!');
        this.handleLogin(e);
      } else if (e.target.id === 'signupForm') {
        e.preventDefault();
        console.log('🔥 SIGNUP FORM SUBMITTED!');
        this.handleSignup(e);
      }
    });

    authContainer.addEventListener('click', (e) => {
      const goToSignup = e.target.closest('#goToSignup');
      const goToLogin = e.target.closest('#goToLogin');

      if (goToSignup) {
        e.preventDefault();
        console.log('🔄 Switching to signup');
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('signupContainer').style.display = 'flex';
        document.getElementById('signupContainer').classList.add('show');
      }

      if (goToLogin) {
        e.preventDefault();
        console.log('🔄 Switching to login');
        document.getElementById('signupContainer').style.display = 'none';
        document.getElementById('loginContainer').style.display = 'flex';
        document.getElementById('loginContainer').classList.add('show');
      }
    });

    console.log('✅ All events bound');
  }

  async handleLogin(e) {
    console.log('🔐 HANDLE LOGIN CALLED');

    try {
      const email = document.getElementById('loginEmail')?.value?.trim();
      const password = document.getElementById('loginPassword')?.value;

      console.log('📧 Credentials:', { email, passwordLength: password?.length });

      if (!email || !password) {
        Utils.showToast('Please enter email and password', 'error');
        return;
      }

      const btn = document.querySelector('#loginForm button[type="submit"]');
      const originalHTML = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
      btn.disabled = true;

      console.log('🚀 Sending login request via API');

      const data = await this.apiClient.post('/auth/login', { email, password });

      console.log('📦 Login response:', data);

      // Await storage operations to ensure they complete
      await this.apiClient.saveToStorage('scholar_token', data.data.tokens.accessToken);
      await this.apiClient.saveToStorage('scholar_refresh_token', data.data.tokens.refreshToken);
      await this.apiClient.saveToStorage('currentUser', JSON.stringify(data.data.user));
      this.stateManager.setState({ user: data.data.user });

      // Add small delay to ensure storage is complete
      await new Promise(resolve => setTimeout(resolve, 100));

      Utils.showToast('Welcome back!', 'success');

      document.getElementById('loginContainer').style.display = 'none';
      this.loadApp();

    } catch (error) {
      console.error('❌ Login error:', error);
      Utils.showToast(error.message || 'Login failed', 'error');
      const btn = document.querySelector('#loginForm button[type="submit"]');
      if (btn) {
        btn.innerHTML = '<span>Sign In</span><i class="fas fa-arrow-right"></i>';
        btn.disabled = false;
      }
    }
  }

  async handleSignup(e) {
    console.log('📝 HANDLE SIGNUP CALLED');

    try {
      const firstName = document.getElementById('signupFirstName')?.value?.trim();
      const lastName = document.getElementById('signupLastName')?.value?.trim();
      const email = document.getElementById('signupEmail')?.value?.trim();
      const password = document.getElementById('signupPassword')?.value;
      const education = document.getElementById('signupEducation')?.value;

      console.log('📋 Form data:', { firstName, lastName, email, education, passwordLength: password?.length });

      if (!firstName || !lastName || !email || !password || !education) {
        Utils.showToast('Please fill in all fields', 'error');
        return;
      }

      if (password.length < 8) {
        Utils.showToast('Password must be at least 8 characters', 'error');
        return;
      }

      const btn = document.querySelector('#signupForm button[type="submit"]');
      const originalHTML = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
      btn.disabled = true;

      const requestBody = {
        username: `${firstName.toLowerCase()}${Math.floor(Math.random() * 10000)}`,
        email: email,
        password: password,
        profile: { firstName, lastName },
        educationLevel: education
      };

      console.log('🚀 Sending signup request via API');
      console.log('📤 Request body:', requestBody);

      const data = await this.apiClient.post('/auth/register', requestBody);

      console.log('📦 Signup response:', data);

      // Await storage operations to ensure they complete
      await this.apiClient.saveToStorage('scholar_token', data.data.tokens.accessToken);
      await this.apiClient.saveToStorage('scholar_refresh_token', data.data.tokens.refreshToken);
      await this.apiClient.saveToStorage('currentUser', JSON.stringify(data.data.user));
      this.stateManager.setState({ user: data.data.user });

      // Add small delay to ensure storage is complete
      await new Promise(resolve => setTimeout(resolve, 100));

      Utils.showToast('Account created!', 'success');

      document.getElementById('signupContainer').style.display = 'none';
      this.loadApp();

    } catch (error) {
      console.error('❌ Signup error:', error);
      Utils.showToast(error.message || 'Signup failed', 'error');
      const btn = document.querySelector('#signupForm button[type="submit"]');
      if (btn) {
        btn.innerHTML = '<span>Create Account</span><i class="fas fa-arrow-right"></i>';
        btn.disabled = false;
      }
    }
  }

  loadApp() {
    const loginContainer = document.getElementById('loginContainer');
    const signupContainer = document.getElementById('signupContainer');
    const appLayer = document.getElementById('appLayer');

    if (loginContainer) loginContainer.style.display = 'none';
    if (signupContainer) signupContainer.style.display = 'none';
    if (appLayer) appLayer.style.display = 'flex';

    // Initialize other modules
    if (window.NavigationModule) window.NavigationModule.init();
    if (window.ClassModule) window.ClassModule.init();
    if (window.StatsModule) window.StatsModule.init();
    if (window.ProgressModule) window.ProgressModule.init();
    if (window.ActivityModule) window.ActivityModule.init();

    const userName = document.getElementById('userName');
    const avatarImg = document.querySelector('.user-profile img');

    const user = this.stateManager.getState().user;
    if (userName) userName.textContent = user?.username || 'Student';
    if (avatarImg && user) {
      avatarImg.src = user.profile?.avatar ||
          `https://ui-avatars.com/api/?name=${user.username}&background=00ed64&color=001e2b`;
    }

    if (window.NavigationModule) window.NavigationModule.navigateTo('dashboard');
  }

  async logout() {
    try {
      // Call the logout API to invalidate the refresh token
      await this.apiClient.post('/auth/logout');
    } catch (error) {
      // Even if the API call fails, still clear local storage
      console.error('Logout API call failed:', error);
    } finally {
      Utils.showToast('Logging out...', 'info');
      setTimeout(() => {
        localStorage.clear();
        location.reload();
      }, 1000);
    }
  }
}

// ==========================================
// GLOBAL ERROR HANDLING
// ==========================================
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  if (event.error && event.error.message) {
    Utils.showToast('An unexpected error occurred', 'error');
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  Utils.showToast('An unexpected error occurred', 'error');
  event.preventDefault();
});

// ==========================================
// APPLICATION INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎓 Scholar.AI - Initializing Application...');

  // Create shared instances
  const apiClient = new ApiClient();
  const stateManager = new AppStateManager();
  
  // Make them globally accessible for other modules
  window.ApiClient = apiClient;
  window.AppState = stateManager.getState();
  window.AppStateSetter = stateManager.setState.bind(stateManager);

  // Initialize auth first (blocks until complete)
  const authModule = new AuthModule(apiClient, stateManager);
  await authModule.init();

  // Make auth module available globally
  window.AuthModule = authModule;

  // Only initialize if logged in
  const token = apiClient.loadFromStorage('scholar_token');
  const user = apiClient.loadFromStorage('currentUser');

  if (token && user) {

    // Load modules in sequence
    setTimeout(() => {
      if (window.PDFModule && typeof window.PDFModule.init === 'function') {
        window.PDFModule.init();
      }
      if (window.AIModule && typeof window.AIModule.init === 'function') {
        window.AIModule.init();
      }
      if (window.EnhancedClassModule && typeof window.EnhancedClassModule.init === 'function') {
        window.EnhancedClassModule.init();
      }
    }, 500);

    // Load initial data with delays
    setTimeout(async () => {
      if (window.PDFModule && typeof window.PDFModule.loadFiles === 'function') {
        await window.PDFModule.loadFiles();
      }
      if (window.NotificationSystem && typeof window.NotificationSystem.loadNotifications === 'function') {
        await window.NotificationSystem.loadNotifications();
      }
    }, 800);
  }

  // Initialize visual effects last
  setTimeout(() => {
    console.log('🎨 Initializing visual effects...');

    // Initialize visual effects if they exist
    if (window.CursorEffect && typeof window.CursorEffect.init === 'function') {
      window.CursorEffect.init();
    }
    if (window.ParticleSystem && typeof window.ParticleSystem.init === 'function') {
      window.ParticleSystem.init();
    }
    if (window.SmoothScroll && typeof window.SmoothScroll.init === 'function') {
      window.SmoothScroll.init();
    }
    if (window.TiltEffect && typeof window.TiltEffect.init === 'function') {
      window.TiltEffect.init();
    }
    if (window.GlowEffect && typeof window.GlowEffect.init === 'function') {
      window.GlowEffect.init();
    }
    if (window.RippleEffect && typeof window.RippleEffect.init === 'function') {
      window.RippleEffect.init();
    }
    if (window.NotificationSystem && typeof window.NotificationSystem.init === 'function') {
      window.NotificationSystem.init();
    }
    if (window.KeyboardShortcuts && typeof window.KeyboardShortcuts.init === 'function') {
      window.KeyboardShortcuts.init();
    }
    if (window.LoadingAnimations && typeof window.LoadingAnimations.init === 'function') {
      window.LoadingAnimations.init();
    }
    if (window.ActivityUpdater && typeof window.ActivityUpdater.init === 'function') {
      window.ActivityUpdater.init();
    }
    if (window.i18nModule && typeof window.i18nModule.init === 'function') {
      window.i18nModule.init();
    }
    if (window.GamificationModule && typeof window.GamificationModule.init === 'function') {
      window.GamificationModule.init();
    }
    if (window.VoiceCommandModule && typeof window.VoiceCommandModule.init === 'function') {
      window.VoiceCommandModule.init();
    }
    if (window.StudyTimerModule && typeof window.StudyTimerModule.init === 'function') {
      window.StudyTimerModule.init();
    }
    if (window.NoteModule && typeof window.NoteModule.init === 'function') {
      window.NoteModule.init();
    }

    // Re-initialize on navigation if observer exists
    if (window.MutationObserver && document.getElementById('viewContainer')) {
      const observer = new MutationObserver(() => {
        if (window.TiltEffect && typeof window.TiltEffect.init === 'function') {
          window.TiltEffect.init();
        }
        if (window.SmoothScroll && typeof window.SmoothScroll.init === 'function') {
          window.SmoothScroll.init();
        }
      });

      const viewContainer = document.getElementById('viewContainer');
      if (viewContainer) {
        observer.observe(viewContainer, {
          childList: true,
          subtree: true
        });
      }
    }

    console.log('✨ All effects loaded!');
  }, 1000);

  console.log('✅ Scholar.AI - Ready');
});

// Global cleanup function to prevent memory leaks
function globalCleanup() {
  // Disconnect socket if it exists

  // Clear intervals
  if (window.PDFModule && window.PDFModule.pollingInterval) {
    clearInterval(window.PDFModule.pollingInterval);
  }

  console.log('🧹 Global cleanup completed');
}

// Listen for page unload to clean up resources
window.addEventListener('beforeunload', globalCleanup);

// Also add a visibility change listener to handle tab switching
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    // Perform cleanup when tab becomes hidden
    console.log('📱 Tab hidden, performing cleanup...');
  }
});

// Export for external use
window.ScholarAI = {
  ApiClient,
  AppStateManager,
  ErrorBoundary,
  Utils,
};