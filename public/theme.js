/**
 * Theme Management System for Scholar.AI
 * Handles dark/light mode and theme preferences
 */

class ThemeManager {
  constructor() {
    this.currentTheme = this.getStoredTheme() || 'dark';
    this.init();
  }

  init() {
    this.applyTheme();
    this.bindEvents();
  }

  getStoredTheme() {
    return localStorage.getItem('scholar_theme');
  }

  setStoredTheme(theme) {
    localStorage.setItem('scholar_theme', theme);
  }

  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.currentTheme);
    
    // Update theme-related UI elements
    this.updateThemeToggle();
    this.updateThemeColors();
  }

  updateThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const themeSelector = document.getElementById('themeSelector');

    if (themeToggle) {
      themeToggle.innerHTML = this.currentTheme === 'dark'
        ? '<i class="fas fa-sun"></i>'
        : '<i class="fas fa-moon"></i>';
    }

    if (themeSelector) {
      themeSelector.value = this.currentTheme;
    }
  }

  updateThemeColors() {
    // Update CSS variables based on theme
    const root = document.documentElement;
    
    if (this.currentTheme === 'dark') {
      root.style.setProperty('--bg-primary', '#001e2b');
      root.style.setProperty('--bg-secondary', '#002a3a');
      root.style.setProperty('--text-primary', '#ffffff');
      root.style.setProperty('--text-secondary', '#9eb3c2');
      root.style.setProperty('--border', '#2a4a5c');
      root.style.setProperty('--primary', '#00ed64');
      root.style.setProperty('--primary-hover', '#00cc55');
    } else {
      root.style.setProperty('--bg-primary', '#ffffff');
      root.style.setProperty('--bg-secondary', '#f8fafc');
      root.style.setProperty('--text-primary', '#001e2b');
      root.style.setProperty('--text-secondary', '#475569');
      root.style.setProperty('--border', '#cbd5e1');
      root.style.setProperty('--primary', '#00ed64');
      root.style.setProperty('--primary-hover', '#00cc55');
    }
  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.setStoredTheme(this.currentTheme);
    this.applyTheme();

    // Update the theme selector dropdown if it exists
    const themeSelector = document.getElementById('themeSelector');
    if (themeSelector) {
      themeSelector.value = this.currentTheme;
    }

    // Show feedback
    window.Utils.showToast(
      `Switched to ${this.currentTheme} mode`,
      'info'
    );
  }

  setTheme(theme) {
    this.currentTheme = theme;
    this.setStoredTheme(this.currentTheme);
    this.applyTheme();

    // Update the theme selector dropdown if it exists
    const themeSelector = document.getElementById('themeSelector');
    if (themeSelector) {
      themeSelector.value = this.currentTheme;
    }

    // Update the theme toggle button if it exists
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.innerHTML = this.currentTheme === 'dark'
        ? '<i class="fas fa-sun"></i>'
        : '<i class="fas fa-moon"></i>';
    }

    // Show feedback
    window.Utils.showToast(
      `Switched to ${this.currentTheme} mode`,
      'info'
    );
  }

  bindEvents() {
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!this.getStoredTheme()) {
        this.currentTheme = e.matches ? 'dark' : 'light';
        this.applyTheme();
      }
    });
  }
}

// Initialize theme manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.ThemeManager = new ThemeManager();
});

// Export for external use
window.ThemeManager = window.ThemeManager || null;