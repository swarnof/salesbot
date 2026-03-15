const messagesEl = document.getElementById('messages');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const headerTitle = document.getElementById('header-title');
const headerStatus = document.getElementById('header-status');
const newChatBtn = document.getElementById('new-chat-btn');
const quickTopicsList = document.getElementById('quick-topics-list');
const historyList = document.getElementById('history-list');
const modeBtns = document.querySelectorAll('.mode-btn');
const sidebarTabs = document.querySelectorAll('.sidebar-tab');
const micBtn = document.getElementById('mic-btn');
const ttsToggle = document.getElementById('tts-toggle');

let currentMode = 'recruiting';
let chatHistory = [];
let isLoading = false;
let currentConversationId = null;
let ttsEnabled = false;
let isRecording = false;
let currentPersonaIndex = null;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        messageInput.value = transcript;
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
    };

    recognition.onend = () => {
        isRecording = false;
        micBtn.classList.remove('recording');
        micBtn.title = 'Voice input';
        if (messageInput.value.trim()) {
            chatForm.dispatchEvent(new Event('submit'));
        }
    };

    recognition.onerror = (event) => {
        isRecording = false;
        micBtn.classList.remove('recording');
        micBtn.title = 'Voice input';
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
            console.error('Speech recognition error:', event.error);
        }
    };
} else {
    micBtn.classList.add('unsupported');
}

const synth = window.speechSynthesis;
if (!synth) {
    ttsToggle.classList.add('unsupported');
}

function toggleTTS() {
    ttsEnabled = !ttsEnabled;
    ttsToggle.classList.toggle('active', ttsEnabled);
    ttsToggle.querySelector('.tts-icon-off').classList.toggle('hidden', ttsEnabled);
    ttsToggle.querySelector('.tts-icon-on').classList.toggle('hidden', !ttsEnabled);
    ttsToggle.title = ttsEnabled ? 'Voice replies ON' : 'Voice replies OFF';
    if (!ttsEnabled && synth) {
        synth.cancel();
    }
}

function speakText(text) {
    if (!ttsEnabled || !synth) return;
    synth.cancel();
    const cleaned = text.replace(/\*\*/g, '').replace(/[⚠️🎯📈⚡💬🛠️🎭]/g, '').replace(/---[A-Z_]+---/g, '');
    const sentences = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleaned];
    for (const sentence of sentences) {
        const utterance = new SpeechSynthesisUtterance(sentence.trim());
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        synth.speak(utterance);
    }
}

function toggleMic() {
    if (!recognition) return;
    if (isRecording) {
        recognition.stop();
    } else {
        if (synth) synth.cancel();
        messageInput.value = '';
        isRecording = true;
        micBtn.classList.add('recording');
        micBtn.title = 'Listening... click to stop';
        recognition.start();
    }
}

const MODE_TITLES = {
    recruiting: 'Recruiting Mode',
    training: 'Training Mode',
    customize: 'Customize Mode',
    practice: 'Practice Mode',
};

const TOPICS = {
    recruiting: [
        'Tell me about the opportunity',
        'What can I earn?',
        'Do I need experience?',
        'What does the training look like?',
        'How flexible is the schedule?',
        "What's the team culture like?",
    ],
    training: [
        'How do I handle objections?',
        'Teach me cold calling scripts',
        'How do I close more deals?',
        'Help me with follow-up strategies',
        'Practice a sales role-play with me',
        'How do I stay motivated after rejection?',
    ],
    customize: [
        "Let's set up my recruiting bot",
        'I want to change the tone',
        'Add my company info',
        'Update the objection handling',
        'Change the call to action',
        'Start over with a fresh prompt',
    ],
    practice: [],  // Will be populated with personas
};

function renderTopics() {
    if (currentMode === 'practice') {
        renderPersonaSelection();
        return;
    }
    const topics = TOPICS[currentMode];
    quickTopicsList.innerHTML = topics
        .map((topic) => `<button class="topic-btn" onclick="sendTopic('${topic.replace(/'/g, "\\'")}')">💬 ${topic}</button>`)
        .join('');
}

function renderPersonaSelection() {
    quickTopicsList.innerHTML = `
        <p class="persona-label">Choose a prospect to practice with:</p>
        <button class="topic-btn persona-btn" onclick="startPractice(0)">🧑‍💼 Busy Professional<br><small>Marketing manager, $75K/year</small></button>
        <button class="topic-btn persona-btn" onclick="startPractice(1)">🎓 College Student<br><small>Business major, wants flexibility</small></button>
        <button class="topic-btn persona-btn" onclick="startPractice(2)">👨‍👩‍👧 Skeptical Parent<br><small>Stay-at-home, very cautious</small></button>
        <button class="topic-btn persona-btn" onclick="startPractice(3)">🔄 Career Changer<br><small>Left restaurant job, no sales exp</small></button>
    `;
}

function startPractice(index) {
    currentPersonaIndex = index;
    const names = ['Busy Professional', 'College Student', 'Skeptical Parent', 'Career Changer'];
    clearChat();
    addSystemMessage(`Practice started with: **${names[index]}**. Start your pitch! Say "end practice" or "give me feedback" when done.`);
    messageInput.focus();
}

function addSystemMessage(text) {
    const welcomeMsg = messagesEl.querySelector('.welcome-message');
    if (welcomeMsg) welcomeMsg.remove();

    const msgDiv = document.createElement('div');
    msgDiv.className = 'message system-msg';
    msgDiv.innerHTML = `
        <div class="system-message-content">${formatMessage(text)}</div>
    `;
    messagesEl.appendChild(msgDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function sendTopic(topic) {
    messageInput.value = topic;
    chatForm.dispatchEvent(new Event('submit'));
}

function setMode(mode) {
    currentMode = mode;
    currentPersonaIndex = null;
    modeBtns.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    headerTitle.textContent = MODE_TITLES[mode] || mode;
    renderTopics();
}

function showWelcome() {
    const modeMessages = {
        recruiting: 'I can help you <strong>recruit top talent</strong> with your customized pitch.',
        training: 'I can <strong>train your sales team</strong> with scripts, techniques, and coaching.',
        customize: 'Tell me about your business and I\'ll <strong>learn how to recruit for you</strong>. Just talk naturally!',
        practice: 'Pick a prospect persona and <strong>practice your sales pitch</strong>. I\'ll give you feedback and learn your best techniques!',
    };
    messagesEl.innerHTML = `
        <div class="welcome-message">
            <div class="welcome-icon">⚡</div>
            <h2>${MODE_TITLES[currentMode]}</h2>
            <p>${modeMessages[currentMode]}</p>
            <p>${currentMode === 'practice' ? 'Choose a persona from the sidebar to start!' : 'Start chatting below!'}</p>
        </div>
    `;
}

function clearChat() {
    chatHistory = [];
    currentConversationId = null;
    showWelcome();
    highlightActiveConversation();
}

function formatMessage(text) {
    // Clean up the special markers for display
    let cleaned = text
        .replace(/---PROMPT_READY---/g, '')
        .replace(/---END_PROMPT---/g, '')
        .replace(/---FEEDBACK---/g, '\n**📋 Coaching Feedback:**\n')
        .replace(/---END_FEEDBACK---/g, '')
        .replace(/---LEARNED---/g, '\n**🧠 Techniques Saved to Your Bot:**\n')
        .replace(/---END_LEARNED---/g, '');

    return cleaned.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

function addMessage(role, content) {
    const welcomeMsg = messagesEl.querySelector('.welcome-message');
    if (welcomeMsg) welcomeMsg.remove();

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;

    const avatar = role === 'bot' ? '⚡' : '👤';

    msgDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">${role === 'bot' ? formatMessage(content) : escapeHtml(content)}</div>
    `;

    messagesEl.appendChild(msgDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return msgDiv;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showTyping() {
    const welcomeMsg = messagesEl.querySelector('.welcome-message');
    if (welcomeMsg) welcomeMsg.remove();

    const msgDiv = document.createElement('div');
    msgDiv.className = 'message bot';
    msgDiv.id = 'typing-msg';
    msgDiv.innerHTML = `
        <div class="message-avatar">⚡</div>
        <div class="message-content">
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    messagesEl.appendChild(msgDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeTyping() {
    const typing = document.getElementById('typing-msg');
    if (typing) typing.remove();
}

function showNotification(text, type) {
    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.textContent = text;
    document.body.appendChild(notif);
    setTimeout(() => notif.classList.add('show'), 10);
    setTimeout(() => {
        notif.classList.remove('show');
        setTimeout(() => notif.remove(), 300);
    }, 4000);
}

async function sendMessage(text) {
    if (isLoading || !text.trim()) return;

    isLoading = true;
    sendBtn.disabled = true;
    headerStatus.textContent = 'Thinking...';

    addMessage('user', text);
    chatHistory.push({ role: 'user', content: text });

    showTyping();

    try {
        const body = {
            message: text,
            mode: currentMode,
            history: chatHistory.slice(-20),
            conversation_id: currentConversationId,
        };
        if (currentMode === 'practice' && currentPersonaIndex !== null) {
            body.persona_index = currentPersonaIndex;
        }

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        removeTyping();

        if (data.error) {
            addMessage('bot', `⚠️ Error: ${data.error}`);
        } else {
            addMessage('bot', data.reply);
            chatHistory.push({ role: 'assistant', content: data.reply });
            speakText(data.reply);
            if (data.conversation_id) {
                currentConversationId = data.conversation_id;
            }
            // Show notifications for special events
            if (data.prompt_saved) {
                showNotification('✅ Your custom recruiting prompt has been saved! Switch to Recruiting mode to see it in action.', 'success');
            }
            if (data.techniques_learned) {
                showNotification('🧠 New techniques learned and added to your recruiting bot!', 'success');
            }
            loadHistory();
        }
    } catch (err) {
        removeTyping();
        addMessage('bot', '⚠️ Connection error. Make sure the server is running.');
    }

    isLoading = false;
    sendBtn.disabled = false;
    headerStatus.textContent = 'Ready to chat';
    messageInput.focus();
}

function formatDate(isoString) {
    const date = new Date(isoString + 'Z');
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

function highlightActiveConversation() {
    document.querySelectorAll('.history-item').forEach((item) => {
        item.classList.toggle('active', item.dataset.id === String(currentConversationId));
    });
}

const MODE_ICONS = {
    recruiting: '🎯',
    training: '📈',
    customize: '🛠️',
    practice: '🎭',
};

async function loadHistory() {
    try {
        const response = await fetch('/api/conversations');
        const data = await response.json();
        const conversations = data.conversations;

        if (conversations.length === 0) {
            historyList.innerHTML = '<div class="history-empty">No conversations yet.<br>Start chatting to save history!</div>';
            return;
        }

        historyList.innerHTML = conversations
            .map((conv) => `
                <div class="history-item ${conv.id === currentConversationId ? 'active' : ''}" data-id="${conv.id}" onclick="loadConversation(${conv.id})">
                    <div class="history-item-info">
                        <span class="history-item-title">${escapeHtml(conv.title)}</span>
                        <div class="history-item-meta">
                            <span class="history-item-mode">${MODE_ICONS[conv.mode] || '💬'} ${conv.mode}</span>
                            <span class="history-item-date">${formatDate(conv.updated_at)}</span>
                        </div>
                    </div>
                    <button class="history-item-delete" onclick="event.stopPropagation(); deleteConversation(${conv.id})" title="Delete conversation">✕</button>
                </div>
            `)
            .join('');
    } catch (err) {
        historyList.innerHTML = '<div class="history-empty">Failed to load history.</div>';
    }
}

async function loadConversation(convId) {
    try {
        const response = await fetch(`/api/conversations/${convId}`);
        const data = await response.json();
        const conv = data.conversation;

        currentConversationId = conv.id;
        chatHistory = [];
        messagesEl.innerHTML = '';

        setMode(conv.mode);

        for (const msg of conv.messages) {
            const displayRole = msg.role === 'assistant' ? 'bot' : msg.role;
            addMessage(displayRole, msg.content);
            chatHistory.push({ role: msg.role, content: msg.content });
        }

        highlightActiveConversation();
        messageInput.focus();
    } catch (err) {
        console.error('Failed to load conversation:', err);
    }
}

async function deleteConversation(convId) {
    try {
        await fetch(`/api/conversations/${convId}`, { method: 'DELETE' });
        if (currentConversationId === convId) {
            clearChat();
        }
        loadHistory();
    } catch (err) {
        console.error('Failed to delete conversation:', err);
    }
}

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;
    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendMessage(text);
});

messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
});

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
    }
});

modeBtns.forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
});

sidebarTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
        sidebarTabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-topics').classList.toggle('hidden', tab.dataset.tab !== 'topics');
        document.getElementById('tab-history').classList.toggle('hidden', tab.dataset.tab !== 'history');
    });
});

micBtn.addEventListener('click', toggleMic);
ttsToggle.addEventListener('click', toggleTTS);
newChatBtn.addEventListener('click', clearChat);

renderTopics();
loadHistory();
