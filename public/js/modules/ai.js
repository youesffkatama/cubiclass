import { AppState } from "./state.js";
import { API } from "./api.js";
import { Utils } from "./ui.js";

export const AIModule = {
    activeTool: null,
    isProcessing: false,
    
    init: () => {
        AppState.chatSessions = Utils.loadFromStorage('scholar_chats', [
            { id: 'demo-1', title: 'Quantum Physics Help', messages: [], timestamp: Date.now() }
        ]);
        
        AIModule.renderChatHistory();
        
        document.getElementById('aiModelSelector').addEventListener('change', (e) => {
            AIModule.changeModel(e.target.value);
        });
    },
    
    renderChatHistory: () => {
        const container = document.getElementById('chatHistoryList');
        if (!container) return;
        
        container.innerHTML = '';
        
        AppState.chatSessions.forEach(session => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <i class="fas fa-comment-alt"></i>
                <span>${session.title}</span>
            `;
            item.addEventListener('click', () => AIModule.loadChat(session.id));
            container.appendChild(item);
        });
    },
    
    changeModel: async (model) => {
        AppState.settings.aiModel = model;
        try {
            await Utils.saveToStorage('scholar_settings', AppState.settings);
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
        Utils.showToast(`Switched to ${model}`, 'info');
    },
    
    activateTool: (toolName) => {
        AIModule.activeTool = toolName;
        
        document.querySelectorAll('.chip').forEach(chip => {
            chip.classList.remove('active');
            if (chip.getAttribute('data-tool') === toolName) {
                chip.classList.add('active');
            }
        });
        
        const toolNames = {
            deepsearch: 'Deep Search',
            quiz: 'Quiz Generator',
            exam: 'Exam Prep',
            lecture: 'Lecture Explainer'
        };
        
        Utils.showToast(`${toolNames[toolName]} activated`, 'info');
        document.getElementById('chatInput').placeholder = `Using ${toolNames[toolName]}...`;
    },
    
    handleKeyPress: (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            AIModule.sendMessage();
        }
    },
    
    sendMessage: async () => {
        const chatInput = document.getElementById('chatInput');
        const query = chatInput.value.trim();
        if (!query) return;

        chatInput.value = '';
        AIModule.addMessage('user', query);
        AIModule.isProcessing = true;
        Utils.showLoader('Thinking...');

        try {
            const response = await fetch('/api/v1/intelligence/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Utils.loadFromStorage('scholar_token')}`
                },
                body: JSON.stringify({
                    query,
                    nodeId: AIModule.activeTool === 'pdfchat' && PDFModule.currentPdf ? PDFModule.currentPdf._id : undefined,
                    conversationId: AppState.currentChatId,
                    model: AppState.settings.aiModel
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Failed to get AI response');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiResponseContent = '';
            let assistantMessageElement = AIModule.addMessage('assistant', '', { pending: true });

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                // Process each line as a separate event
                chunk.split('\n\n').forEach(line => {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.substring(6));
                        if (data.content) {
                            aiResponseContent += data.content;
                            assistantMessageElement.querySelector('.message-bubble').textContent = aiResponseContent;
                            // Scroll to bottom
                            assistantMessageElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
                        }
                        if (data.done) {
                            AppState.currentChatId = data.conversationId;
                            assistantMessageElement.classList.remove('pending');
                        }
                    }
                });
            }

        } catch (error) {
            AIModule.addMessage('assistant', `Error: ${error.message}`, { error: true });
            Utils.showToast(error.message || 'Error communicating with AI', 'error');
        } finally {
            AIModule.isProcessing = false;
            Utils.hideLoader();
        }
    },
    
    addMessage: (role, content, options = {}) => {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const messageElement = document.createElement('div');
        messageElement.className = `message ${role} animate__animated animate__fadeIn ${options.pending ? 'pending' : ''}`;
        messageElement.innerHTML = `
            <div class="message-avatar">
                <i class="fas ${role === 'user' ? 'fa-user' : 'fa-robot'}"></i>
            </div>
            <div class="message-content">
                <div class="message-bubble">${content}</div>
                ${options.pending ? '<div class="message-typing"></div>' : ''}
            </div>
        `;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight; // Auto-scroll to bottom
        return messageElement;
    },

    loadChat: async (chatId) => {
        // Load existing chat
    },

    newChat: () => {
        // Create new chat session
    }
};
