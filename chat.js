document.addEventListener("DOMContentLoaded", () => {
    const statusBadge = document.getElementById("socket-status-badge");
    const messagesContainer = document.getElementById("chat-messages-container");
    const chatForm = document.getElementById("chat-form");
    const chatInput = document.getElementById("chat-input");

    function scrollToBottom() {
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    scrollToBottom();

    // Helper: append a message to DOM if not already present
    function appendMessage(msg) {
        if (!messagesContainer || !msg) return;

        const emptyState = document.getElementById("empty-chat-state");
        if (emptyState) {
            emptyState.remove();
        }

        const msgId = msg._id ? msg._id.toString() : null;
        if (msgId && document.querySelector(`[data-msg-id="${msgId}"]`)) {
            return; // Already rendered in DOM
        }

        const senderId = (msg.sender && (msg.sender._id || msg.sender.id || msg.sender)).toString();
        const senderUsername = (msg.sender && msg.sender.username) ? msg.sender.username : "User";
        const isMine = typeof CURRENT_USER_ID !== "undefined" && senderId === CURRENT_USER_ID.toString();

        const timeStr = msg.createdAt 
            ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const messageWrapper = document.createElement("div");
        messageWrapper.className = `chat-msg-wrapper d-flex flex-column ${isMine ? 'align-items-end' : 'align-items-start'}`;
        if (msgId) {
            messageWrapper.setAttribute("data-msg-id", msgId);
        }

        const senderMeta = document.createElement("div");
        senderMeta.className = "small text-muted mb-1 px-1";
        senderMeta.style.fontSize = "0.72rem";
        senderMeta.textContent = `@${senderUsername} · ${timeStr}`;

        const bubble = document.createElement("div");
        bubble.className = isMine ? 'rw-chat-bubble-mine' : 'rw-chat-bubble-other';
        bubble.textContent = msg.text;

        messageWrapper.appendChild(senderMeta);
        messageWrapper.appendChild(bubble);
        messagesContainer.appendChild(messageWrapper);

        scrollToBottom();
    }

    // Socket.IO Setup
    let socket = null;
    if (typeof io !== "undefined") {
        socket = io();

        socket.on("connect", () => {
            if (statusBadge) {
                statusBadge.className = "badge bg-success ms-2";
                statusBadge.textContent = "Live Socket";
            }
            socket.emit("join_exchange_room", {
                exchangeId: EXCHANGE_ID,
                userId: CURRENT_USER_ID
            });
        });

        socket.on("disconnect", () => {
            if (statusBadge) {
                statusBadge.className = "badge bg-danger ms-2";
                statusBadge.textContent = "Reconnecting...";
            }
        });

        socket.on("receive_message", (msg) => {
            appendMessage(msg);
        });

        socket.on("exchange_status_updated", (payload) => {
            window.location.reload();
        });
    }

    // Form Submission: Send via HTTP API + Socket
    if (chatForm) {
        chatForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const text = chatInput.value ? chatInput.value.trim() : "";
            if (!text) return;

            chatInput.value = "";
            chatInput.focus();

            try {
                // HTTP POST API Call
                const response = await fetch(`/exchanges/api/${EXCHANGE_ID}/messages`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ text })
                });

                const data = await response.json();
                if (data.success && data.message) {
                    appendMessage(data.message);
                } else if (socket && socket.connected) {
                    socket.emit("send_message", {
                        exchangeId: EXCHANGE_ID,
                        userId: CURRENT_USER_ID,
                        text: text
                    });
                }
            } catch (err) {
                console.error("HTTP send message error:", err);
                if (socket && socket.connected) {
                    socket.emit("send_message", {
                        exchangeId: EXCHANGE_ID,
                        userId: CURRENT_USER_ID,
                        text: text
                    });
                }
            }
        });
    }

    // Live Polling Fallback (Every 3 seconds)
    async function fetchLatestMessages() {
        try {
            const res = await fetch(`/exchanges/api/${EXCHANGE_ID}/messages`);
            if (res.ok) {
                const msgs = await res.json();
                if (Array.isArray(msgs)) {
                    msgs.forEach(m => appendMessage(m));
                }
            }
        } catch (err) {
            // Silently fail polling
        }
    }

    setInterval(fetchLatestMessages, 3000);
});
