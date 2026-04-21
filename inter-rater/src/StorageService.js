// StorageService.js

const SESSIONS_KEY = 'slr_magic_inter_rater_sessions';

export const StorageService = {
  getSessions: () => {
    const data = localStorage.getItem(SESSIONS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveSessions: (sessions) => {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  },

  createSession: (filename, reviewerName, data) => {
    const sessions = StorageService.getSessions();
    const newSession = {
      sessionId: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      filename,
      reviewerName,
      status: 'in-progress',
      lastModified: Date.now(),
      data,
      currentIndex: 0,
    };
    sessions.push(newSession);
    StorageService.saveSessions(sessions);
    return newSession;
  },

  getSession: (sessionId) => {
    const sessions = StorageService.getSessions();
    return sessions.find(s => s.sessionId === sessionId);
  },

  updateSession: (sessionId, updates) => {
    const sessions = StorageService.getSessions();
    const index = sessions.findIndex(s => s.sessionId === sessionId);
    if (index !== -1) {
      sessions[index] = { ...sessions[index], ...updates, lastModified: Date.now() };
      StorageService.saveSessions(sessions);
      return sessions[index];
    }
    return null;
  },

  deleteSession: (sessionId) => {
    const sessions = StorageService.getSessions();
    const updatedSessions = sessions.filter(s => s.sessionId !== sessionId);
    StorageService.saveSessions(updatedSessions);
  },

  clearAll: () => {
    localStorage.removeItem(SESSIONS_KEY);
  }
};
