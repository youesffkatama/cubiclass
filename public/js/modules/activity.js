import { AppState } from "./state.js";
import { API } from "./api.js";
import { Utils } from "./ui.js";

export const ActivityModule = {
    init: async () => {
        try {
          const response = await API.get('/analytics/dashboard'); // Assuming dashboard provides recent activities
          AppState.activities = response.data.recentActivity || [];
          ActivityModule.renderFeed();
        } catch (error) {
          console.error('Failed to load activities:', error);
          AppState.activities = []; // Clear activities on error
        }
      },
          
    renderFeed: () => {
        const feed = document.getElementById('activityFeed');
        if (!feed) return;
        
        feed.innerHTML = '';
        
        AppState.activities.forEach((activity, index) => {
            const item = document.createElement('div');
            item.className = 'activity-item animate__animated animate__fadeInUp';
            item.style.animationDelay = `${index * 0.1}s`;

            let icon = '';
            let color = '';

            switch (activity.type) {
                case 'login': icon = 'fa-sign-in-alt'; color = '#00ed64'; break;
                case 'upload': icon = 'fa-cloud-upload-alt'; color = '#00bfff'; break;
                case 'chat': icon = 'fa-comments'; color = '#bd00ff'; break;
                case 'quiz': icon = 'fa-question-circle'; color = '#ff0077'; break;
                case 'study': icon = 'fa-book-reader'; color = '#ff8800'; break;
                case 'achievement': icon = 'fa-trophy'; color = '#ffd700'; break;
                default: icon = 'fa-info-circle'; color = '#ffffff';
            }

            item.innerHTML = `
                <div class="act-icon" style="color: ${color}">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="act-details">
                    <h4>${activity.description}</h4>
                    <span>${Utils.formatDate(activity.timestamp)}</span>
                </div>
                <div class="act-score">${activity.xpGained > 0 ? `+${activity.xpGained} XP` : ''}</div>
            `;
            feed.appendChild(item);
        });
    }
};
