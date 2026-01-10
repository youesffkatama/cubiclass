import { AppState } from "./state.js";
import { API } from "./api.js";
import { Utils } from "./ui.js";

export const ProgressModule = {
    init: async () => {
        // Load study plans and tasks from API
        try {
            // Fetch study plans
            // const studyPlans = await API.get('/studyplans'); 
            // AppState.studyPlans = studyPlans.data;

            // Fetch tasks (already done in ActivityModule or similar, but for progress specific)
            // const tasks = await API.get('/tasks?completed=false');
            // AppState.tasks = tasks.data.tasks;

            ProgressModule.renderTimeline();
            ProgressModule.updatePendingTasks();

        } catch (error) {
            console.error('Failed to load progress data:', error);
            Utils.showToast('Failed to load progress data', 'error');
        }
    },

    renderTimeline: () => {
        const timeline = document.getElementById('progressTimeline');
        if (!timeline) return;
        timeline.innerHTML = `
            <div class="timeline-item animate__animated animate__fadeInUp">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <h3>Week 1: Foundations of AI</h3>
                    <p>Completed 3/5 modules. Upcoming: Neural Networks basics.</p>
                    <span class="timeline-date">Oct 23, 2023</span>
                </div>
            </div>
            <div class="timeline-item animate__animated animate__fadeInUp">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <h3>Project Alpha Submission</h3>
                    <p>Final project for Machine Learning course submitted.</p>
                    <span class="timeline-date">Oct 18, 2023</span>
                </div>
            </div>
            <div class="timeline-item animate__animated animate__fadeInUp">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <h3>Started Deep Learning Specialization</h3>
                    <p>Enrolled in Coursera specialization. Goal: Complete in 3 months.</p>
                    <span class="timeline-date">Sep 01, 2023</span>
                </div>
            </div>
        `;
    },

    updatePendingTasks: () => {
        const pendingTasksText = document.getElementById('pendingTasksText');
        if (pendingTasksText) {
            // This would ideally come from AppState.tasks.filter(task => !task.completed).length
            pendingTasksText.textContent = `You have 3 pending assignments.`; 
        }
    }
};
