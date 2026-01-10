export const Utils = {
  init: () => {
    // Placeholder for UI initialization
  },

  generateId: () =>
    `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,

  showToast: (message, type = "info") => {
    console.log(`🔔 Toast: [${type}] ${message}`);

    const container = document.getElementById("toastContainer");
    if (!container) {
      console.error("❌ Toast container not found");
      return;
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type} animate__animated animate__fadeInRight`;

    const icons = {
      success: "fa-check-circle",
      error: "fa-exclamation-circle",
      info: "fa-info-circle",
    };

    toast.innerHTML = `
            <i class="fas ${icons[type]}"></i>
            <span>${message}</span>
        `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove("animate__fadeInRight");
      toast.classList.add("animate__fadeOutRight");
      setTimeout(() => toast.remove(), 500);
    }, 4000);
  },

  showLoader: (message = "Processing...") => {
    const loader = document.getElementById("globalLoader");
    const text = loader.querySelector(".loader-text");
    if (text) text.textContent = message;
    loader.style.display = "flex";
  },

  hideLoader: () => {
    document.getElementById("globalLoader").style.display = "none";
  },

  typeWriter: async (element, text, speed = 20) => {
    element.textContent = "";
    for (let i = 0; i < text.length; i++) {
      element.textContent += text.charAt(i);
      await new Promise((resolve) => setTimeout(resolve, speed));
    }
  },

  animateNumber: (element, start, end, duration = 1000) => {
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
      current += increment;
      if (
        (increment > 0 && current >= end) ||
        (increment < 0 && current <= end)
      ) {
        element.textContent = Math.round(end);
        clearInterval(timer);
      } else {
        element.textContent = Math.round(current);
      }
    }, 16);
  },

  formatDate: (date) => {
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
  },

  saveToStorage: async (key, data) => {
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
      console.error("Storage error:", e);
      throw e;
    }
  },

  loadFromStorage: (key, defaultValue = null) => {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.error("Storage error:", e);
      return defaultValue;
    }
  },
};
