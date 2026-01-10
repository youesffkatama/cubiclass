import { API } from "./api.js";
import { Utils } from "./ui.js";

export const NotificationSystem = {
  notifications: [],

  init: () => {
    const panel = document.createElement("div");
    panel.id = "notificationPanel";
    panel.className = "notification-panel";
    panel.style.display = "none";
    document.body.appendChild(panel);

    NotificationSystem.loadNotifications();

    document.addEventListener("click", (e) => {
      if (!panel.contains(e.target) && panel.style.display === "block") {
        NotificationSystem.closePanel();
      }
    });
  },

  togglePanel: () => {
    const panel = document.getElementById("notificationPanel");
    if (panel.style.display === "none") {
      NotificationSystem.openPanel();
    } else {
      NotificationSystem.closePanel();
    }
  },

  openPanel: () => {
    const panel = document.getElementById("notificationPanel");
    panel.innerHTML = `
            <div class="notification-header">
                <h3>Notifications</h3>
                <button class="btn-text-sm" onclick="NotificationSystem.clearAll()">Clear All</button>
            </div>
            <div class="notification-list">
                ${NotificationSystem.notifications
                  .map(
                    (notif) => `
                    <div class="notification-item animate__animated animate__fadeInRight">
                        <div class="notif-icon ${notif.type}">
                            <i class="fas ${notif.icon}"></i>
                        </div>
                        <div class="notif-content">
                            <h4>${notif.title}</h4>
                            <p>${notif.message}</p>
                            <span class="notif-time">${Utils.formatDate(notif.createdAt)}</span>
                        </div>
                        <button class="btn-notif-close" onclick="NotificationSystem.remove('${notif._id}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `,
                  )
                  .join("")}
            </div>
        `;
    panel.style.display = "block";
    panel.classList.add("animate__animated", "animate__fadeInDown");
  },

  closePanel: () => {
    const panel = document.getElementById("notificationPanel");
    panel.classList.remove("animate__fadeInDown");
    panel.classList.add("animate__fadeOutUp");
    setTimeout(() => {
      panel.style.display = "none";
      panel.classList.remove("animate__fadeOutUp");
    }, 300);
  },

  remove: async (id) => {
    try {
      await API.delete(`/notifications/${id}`);
      NotificationSystem.notifications =
        NotificationSystem.notifications.filter((n) => n._id !== id);
      NotificationSystem.openPanel();

      const badge = document.querySelector(".notification-dot");
      if (badge && NotificationSystem.notifications.length === 0) {
        badge.style.display = "none";
      } else if (badge) {
        badge.textContent = NotificationSystem.notifications.filter(
          (n) => !n.read,
        ).length;
      }
    } catch {
      Utils.showToast("Failed to delete notification", "error");
    }
  },

  clearAll: async () => {
    // In a real app, this would be an API call to clear all notifications for the user
    Utils.showToast("Clear all notifications feature coming soon!", "info");
    NotificationSystem.notifications = [];
    NotificationSystem.closePanel();
    const badge = document.querySelector(".notification-dot");
    if (badge) badge.style.display = "none";
  },

  loadNotifications: async () => {
    if (!Utils.loadFromStorage("scholar_token")) return;

    try {
      const response = await API.get("/notifications");
      NotificationSystem.notifications = response.data.notifications || [];

      const badge = document.querySelector(".notification-dot");
      if (badge) {
        if (response.data.unreadCount > 0) {
          badge.textContent = response.data.unreadCount;
          badge.style.display = "flex";
        } else {
          badge.style.display = "none";
        }
      }
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
  },

  add: (notification) => {
    NotificationSystem.notifications.unshift(notification);
    NotificationSystem.loadNotifications();

    Utils.showToast(notification.message, notification.type || "info");
  },
};
