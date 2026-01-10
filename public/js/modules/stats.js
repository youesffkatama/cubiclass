import { AppState } from "./state.js";
import { API } from "./api.js";
import { Utils } from "./ui.js";

export const StatsModule = {
  performanceChart: null,
  subjectChart: null,

  init: async () => {
    // Load stats from API
    try {
      const response = await API.get("/analytics/dashboard");
      AppState.stats.sessions = response.data.stats.studySessions;
      AppState.stats.documents = response.data.stats.totalFiles;
      // Assuming quizScore is calculated or fetched separately

      document.getElementById("metricSessions").textContent =
        AppState.stats.sessions;
      document.getElementById("metricDocs").textContent =
        AppState.stats.documents;
    } catch (error) {
      console.error("Failed to load dashboard stats:", error);
      Utils.showToast("Failed to load dashboard statistics", "error");
    }
  },

  initCharts: () => {
    // Placeholder for chart initialization (actual data fetching needed)
    const perfCtx = document
      .getElementById("performanceChart")
      ?.getContext("2d");
    if (perfCtx && !StatsModule.performanceChart) {
      StatsModule.performanceChart = new Chart(perfCtx, {
        type: "line",
        data: {
          labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
          datasets: [
            {
              label: "Progress",
              data: [12, 19, 3, 5, 2, 3],
              borderColor: "#00ed64",
              tension: 0.3,
            },
          ],
        },
      });
    }

    const subjCtx = document.getElementById("subjectChart")?.getContext("2d");
    if (subjCtx && !StatsModule.subjectChart) {
      StatsModule.subjectChart = new Chart(subjCtx, {
        type: "pie",
        data: {
          labels: ["Science", "Math", "History", "Literature"],
          datasets: [
            {
              data: [300, 50, 100, 150],
              backgroundColor: ["#00ed64", "#00bfff", "#bd00ff", "#ff8800"],
            },
          ],
        },
      });
    }
    window.chartsInitialized = true;
  },

  updatePeriod: (period) => {
    Utils.showToast(`Fetching data for last ${period} days`, "info");
    // Logic to fetch new data for charts based on period
  },
};
