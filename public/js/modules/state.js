export const AppState = {
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
    documents: 0,
  },
  settings: {
    theme: "dark",
    aiModel: "mistralai/mistral-7b-instruct:free",
    notifications: true,
    aiPersonality: "friendly",
  },
};
