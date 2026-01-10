import { StatsModule } from "./stats.js";

export const NavigationModule = {
  currentView: "dashboard",

  init: () => {
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const view = link.getAttribute("data-view");
        if (view) {
          NavigationModule.navigateTo(view);
        }
      });
    });

    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener("click", () => {
        document.getElementById("sidebar").classList.toggle("active");
      });
    }

    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("globalSearch").focus();
      }
    });

    const btnCreateClass = document.getElementById("btnCreateClass");
    if (btnCreateClass) {
      btnCreateClass.addEventListener("click", () => {
        if (typeof ClassModule !== "undefined" && ClassModule.openModal) {
          ClassModule.openModal();
        }
      });
    }

    NavigationModule.navigateTo("dashboard");
  },

  navigateTo: (viewName) => {
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.classList.remove("active");
      if (link.getAttribute("data-view") === viewName) {
        link.classList.add("active");
      }
    });

    document.querySelectorAll(".view").forEach((view) => {
      view.style.display = "none";
      view.classList.remove("active");
    });

    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
      targetView.style.display = "block";
      targetView.classList.add(
        "active",
        "animate__animated",
        "animate__fadeIn",
      );

      const titles = {
        dashboard: "Dashboard",
        tutor: "AI Tutor",
        pdfhub: "PDF Hub",
        flashcards: "Flashcards",
        stats: "Analytics",
        progress: "Progress",
        profile: "Profile",
        settings: "Settings",
      };

      document.getElementById("pageTitle").textContent =
        titles[viewName] || "Workspace";

      if (viewName === "stats" && !window.chartsInitialized) {
        StatsModule.initCharts();
      }

      NavigationModule.currentView = viewName;
    }
  },

  updateHeader: (title) => {
    document.getElementById("pageTitle").textContent = title;
  },
};
