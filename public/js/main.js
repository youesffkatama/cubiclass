import { AuthModule } from "./modules/auth.js";
import { NavigationModule } from "./modules/navigation.js";
import { ClassModule } from "./modules/class.js";
import { PDFModule } from "./modules/pdf.js";
import { AIModule } from "./modules/ai.js";
import { NotificationSystem } from "./modules/notifications.js";
import { ActivityModule } from "./modules/activity.js";
import { StatsModule } from "./modules/stats.js";
import { ProgressModule } from "./modules/progress.js";
import { Utils } from "./modules/ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🎓 Scholar.AI - Initializing Application...");

  // Initialize UI utilities
  Utils.init();

  // Initialize auth first
  await AuthModule.init();

  const token = Utils.loadFromStorage("scholar_token");
  const user = Utils.loadFromStorage("currentUser");

  if (token && user) {
    // Load modules
    NavigationModule.init();
    ClassModule.init();
    PDFModule.init();
    AIModule.init();
    NotificationSystem.init();
    ActivityModule.init();
    StatsModule.init();
    ProgressModule.init();

    // Load initial data
    setTimeout(() => PDFModule.loadFiles(), 500);
    setTimeout(() => NotificationSystem.loadNotifications(), 800);
  }

  console.log("✅ Scholar.AI - Ready");
});
