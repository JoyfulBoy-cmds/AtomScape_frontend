const BACKEND = "https://atomscape-backend.onrender.com";

let atoms = Number(localStorage.getItem("atoms") || 0);
let lastDailyReward = localStorage.getItem("lastDailyReward") || "";

let currentGroup = null;
let messageTimer = null;

// ==============================
// TIMER STATE
// ==============================

let timerSeconds = 25 * 60;
let timerInterval = null;
let timerRunning = false;

// ==============================
// GENERAL UI
// ==============================

function showToast(message) {
    const toast = document.getElementById("toast");

    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

function showSection(sectionId, button) {
    document.querySelectorAll(".app-section").forEach(section => {
        section.classList.add("hidden");
    });

    const section = document.getElementById(sectionId);

    if (section) {
        section.classList.remove("hidden");
    }

    document.querySelectorAll(".nav-button").forEach(navButton => {
        navButton.classList.remove("active");
    });

    if (button) {
        button.classList.add("active");
    }

    if (sectionId === "groupsSection") {
        loadStudyGroups();
    }

    if (sectionId === "dashboardSection") {
        checkConnection();
    }
}

// ==============================
// ATOMS
// ==============================

function updateAtoms() {
    // Save the Atoms
    localStorage.setItem("atoms", String(atoms));

    // Header Atom counter
    const atomCounter = document.getElementById("atoms");

    if (atomCounter) {
        atomCounter.textContent = atoms;
    }

    // Big Atom card
    const bigAtoms = document.getElementById("bigAtoms");

    if (bigAtoms) {
        bigAtoms.textContent = atoms;
    }

    // Progress bar
    const progressBar = document.getElementById("progressBar");

    if (progressBar) {
        const progress = Math.min((atoms / 100) * 100, 100);
        progressBar.style.width = `${progress}%`;
    }

    // Premium text
    const premiumProgress =
        document.getElementById("premiumProgress");

    if (premiumProgress) {
        if (atoms >= 100) {
            premiumProgress.textContent =
                "⭐ Premium unlocked!";
        } else {
            premiumProgress.textContent =
                `${100 - atoms} Atoms until Premium`;
        }
    }

    // Premium button
    const premiumButton =
        document.getElementById("premiumButton");

    if (premiumButton) {
        if (atoms >= 100) {
            premiumButton.textContent =
                "⭐ Unlock Premium";
        } else {
            premiumButton.textContent =
                `Need ${100 - atoms} More Atoms`;
        }
    }
}

function dailyReward() {
    const today = new Date().toISOString().slice(0, 10);

    if (lastDailyReward === today) {
        showToast("🎁 You already claimed today's reward!");
        return;
    }

    atoms += 10;

    lastDailyReward = today;

    localStorage.setItem(
        "lastDailyReward",
        lastDailyReward
    );

    updateAtoms();

    showToast("🎉 Daily reward claimed! +10 Atoms");
}

function unlockPremium() {
    if (atoms < 100) {
        showToast("❌ You need 100 Atoms!");
        return;
    }

    localStorage.setItem("premium", "true");

    showToast("⭐ Premium unlocked!");
}

// ==============================
// GOOGLE LOGIN
// ==============================

function login() {
    window.location.href =
        `${BACKEND}/auth/google`;
}

async function disconnect() {
    try {
        await fetch(
            `${BACKEND}/auth/disconnect`,
            {
                credentials: "include"
            }
        );
    } catch (error) {
        console.error(error);
    }

    updateConnectionUI(false);

    showToast(
        "Disconnected from Google Classroom"
    );
}

function updateConnectionUI(connected, user = null) {
    const loginButton =
        document.getElementById("loginButton");

    const disconnectButton =
        document.getElementById("disconnectButton");

    const connectionStatus =
        document.getElementById("connectionStatus");

    const profileName =
        document.getElementById("profileName");

    const heroLogin =
        document.getElementById("heroLogin");

    if (loginButton) {
        loginButton.style.display =
            connected ? "none" : "";
    }

    if (disconnectButton) {
        disconnectButton.style.display =
            connected ? "" : "none";
    }

    if (connectionStatus) {
        connectionStatus.textContent =
            connected
                ? "Connected to Google Classroom"
                : "Not connected";
    }

    if (heroLogin) {
        heroLogin.style.display =
            connected ? "none" : "";
    }

    if (profileName && user) {
        profileName.textContent =
            user.name ||
            user.email ||
            "Student";
    }
}

async function checkConnection() {
    try {
        const response = await fetch(
            `${BACKEND}/api/status`,
            {
                credentials: "include"
            }
        );

        if (!response.ok) {
            updateConnectionUI(false);
            return;
        }

        const data = await response.json();

        if (data.connected) {
            updateConnectionUI(
                true,
                data.user
            );

            await loadClassroom();
        } else {
            updateConnectionUI(false);
        }

    } catch (error) {
        console.error(
            "Connection check failed:",
            error
        );

        updateConnectionUI(false);
    }
}

// ==============================
// SECURITY
// ==============================

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==============================
// GOOGLE CLASSROOM
// ==============================

async function loadClassroom() {
    const classesElement =
        document.getElementById("classes");

    const assignmentsElement =
        document.getElementById("assignments");

    const assignmentCount =
        document.getElementById("assignmentCount");

    if (!classesElement) {
        console.error(
            "Could not find #classes"
        );

        return;
    }

    classesElement.innerHTML = `
        <div class="empty">
            Loading your Google Classroom classes...
        </div>
    `;

    try {
        const response = await fetch(
            `${BACKEND}/api/courses`,
            {
                credentials: "include"
            }
        );

        if (!response.ok) {
            throw new Error(
                `Courses request failed: ${response.status}`
            );
        }

        const data =
            await response.json();

        const studentCourses =
            Array.isArray(data.studentCourses)
                ? data.studentCourses
                : [];

        const teacherCourses =
            Array.isArray(data.teacherCourses)
                ? data.teacherCourses
                : [];

        const allCourses = [
            ...studentCourses,
            ...teacherCourses
        ];

        if (allCourses.length === 0) {
            classesElement.innerHTML = `
                <div class="empty">
                    No Google Classroom classes were found.
                </div>
            `;

            if (assignmentsElement) {
                assignmentsElement.innerHTML = `
                    <div class="empty">
                        No assignments found.
                    </div>
                `;
            }

            if (assignmentCount) {
                assignmentCount.textContent = "0";
            }

            return;
        }

        classesElement.className =
            "class-list";

        classesElement.innerHTML =
            allCourses.map(course => {

                const isArchived =
                    course.courseState === "ARCHIVED";

                return `
                    <div class="class-card">

                        <div class="class-card-top">

                            <div class="class-icon">
                                📚
                            </div>

                            <div class="class-info">

                                <h3>
                                    ${escapeHTML(
                                        course.name ||
                                        "Unnamed Class"
                                    )}
                                </h3>

                                <p>
                                    ${escapeHTML(
                                        course.section ||
                                        course.subject ||
                                        "Google Classroom"
                                    )}
                                </p>

                            </div>

                        </div>

                        <div class="class-details">

                            ${
                                course.room
                                    ? `
                                        <span>
                                            📍 ${escapeHTML(
                                                course.room
                                            )}
                                        </span>
                                    `
                                    : ""
                            }

                            ${
                                course.subject
                                    ? `
                                        <span>
                                            📘 ${escapeHTML(
                                                course.subject
                                            )}
                                        </span>
                                    `
                                    : ""
                            }

                            <span>
                                ${
                                    isArchived
                                        ? "📦 Archived"
                                        : "🟢 Active"
                                }
                            </span>

                        </div>

                        ${
                            course.alternateLink
                                ? `
                                    <a
                                        class="class-link"
                                        href="${course.alternateLink}"
                                        target="_blank"
                                        rel="noopener noreferrer">
                                        Open in Google Classroom →
                                    </a>
                                `
                                : ""
                        }

                    </div>
                `;
            }).join("");

        // ==============================
        // ASSIGNMENTS
        // ==============================

        try {
            const assignmentResponse =
                await fetch(
                    `${BACKEND}/api/teacher-coursework`,
                    {
                        credentials: "include"
                    }
                );

            if (!assignmentResponse.ok) {
                throw new Error(
                    `Assignments request failed: ${assignmentResponse.status}`
                );
            }

            const assignmentData =
                await assignmentResponse.json();

            const assignments =
                Array.isArray(assignmentData)
                    ? assignmentData
                    : assignmentData.assignments || [];

            if (assignmentCount) {
                assignmentCount.textContent =
                    String(assignments.length);
            }

            if (!assignments.length) {
                assignmentsElement.innerHTML = `
                    <div class="empty">
                        No assignments found.
                    </div>
                `;
            } else {
                assignmentsElement.className =
                    "assignment-list";

                assignmentsElement.innerHTML =
                    assignments.map(
                        assignment => `
                            <div class="assignment-card">

                                <h3>
                                    ${escapeHTML(
                                        assignment.title ||
                                        assignment.name ||
                                        "Assignment"
                                    )}
                                </h3>

                                ${
                                    assignment.courseName
                                        ? `
                                            <p>
                                                📚 ${escapeHTML(
                                                    assignment.courseName
                                                )}
                                            </p>
                                        `
                                        : ""
                                }

                            </div>
                        `
                    ).join("");
            }

        } catch (assignmentError) {
            console.error(
                "Could not load assignments:",
                assignmentError
            );

            if (assignmentCount) {
                assignmentCount.textContent = "0";
            }

            if (assignmentsElement) {
                assignmentsElement.innerHTML = `
                    <div class="empty">
                        Classes loaded, but assignments
                        could not be loaded.
                    </div>
                `;
            }
        }

    } catch (error) {
        console.error(
            "Could not load Google Classroom:",
            error
        );

        classesElement.innerHTML = `
            <div class="empty">
                Could not load Google Classroom.
                <br><br>
                <small>
                    ${escapeHTML(error.message)}
                </small>
            </div>
        `;
    }
}

// ==============================
// STUDY GROUPS
// ==============================

function openCreateGroup() {
    const modal =
        document.getElementById(
            "createGroupModal"
        );

    if (modal) {
        modal.classList.remove("hidden");

        const input =
            document.getElementById(
                "groupNameInput"
            );

        if (input) {
            setTimeout(() => {
                input.focus();
            }, 100);
        }
    }
}

function closeCreateGroup() {
    const modal =
        document.getElementById(
            "createGroupModal"
        );

    if (modal) {
        modal.classList.add("hidden");
    }
}

async function loadStudyGroups() {
    try {
        const response =
            await fetch(
                `${BACKEND}/api/study-groups`,
                {
                    credentials: "include"
                }
            );

        if (!response.ok) {
            throw new Error(
                "Could not load study groups"
            );
        }

        const data =
            await response.json();

        const groups =
            Array.isArray(data)
                ? data
                : data.groups || [];

        const container =
            document.getElementById(
                "studyGroupsList"
            );

        if (!container) return;

        if (groups.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    No study groups yet.
                    Create the first one!
                </div>
            `;

            return;
        }

        container.innerHTML =
            groups.map(group => {

                const isMember =
                    group.isMember === true;

                return `
                    <div class="group-card">

                        <div class="group-card-icon">
                            📚
                        </div>

                        <div class="group-card-content">

                            <h3>
                                ${escapeHTML(
                                    group.name ||
                                    "Study Group"
                                )}
                            </h3>

                            <p>
                                ${escapeHTML(
                                    group.description ||
                                    "A place to study together."
                                )}
                            </p>

                            <span>
                                👥 ${
                                    group.memberCount || 0
                                } members
                            </span>

                        </div>

                        <button
                            onclick="${
                                isMember
                                    ? `selectStudyGroup('${group.id}')`
                                    : `joinGroup('${group.id}')`
                            }"
                        >
                            ${
                                isMember
                                    ? "Open Group"
                                    : "Join Group"
                            }
                        </button>

                    </div>
                `;
            }).join("");

    } catch (error) {
        console.error(
            "Study groups error:",
            error
        );

        showToast(
            "❌ Could not load study groups"
        );
    }
}

// ==============================
// CREATE STUDY GROUP
// ==============================

async function createStudyGroup() {

    // IMPORTANT:
    // These IDs now match index.html

    const nameInput =
        document.getElementById(
            "groupNameInput"
        );

    const descriptionInput =
        document.getElementById(
            "groupDescriptionInput"
        );

    if (!nameInput) {
        showToast(
            "❌ Group name field was not found."
        );

        console.error(
            "Missing #groupNameInput"
        );

        return;
    }

    const name =
        nameInput.value.trim();

    const description =
        descriptionInput
            ? descriptionInput.value.trim()
            : "";

    if (!name) {
        showToast(
            "Please enter a group name"
        );

        nameInput.focus();

        return;
    }

    if (name.length > 60) {
        showToast(
            "Group name is too long."
        );

        return;
    }

    try {
        const response =
            await fetch(
                `${BACKEND}/api/study-groups`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials: "include",

                    body: JSON.stringify({
                        name: name,
                        description: description
                    })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.error ||
                "Could not create group"
            );
        }

        nameInput.value = "";

        if (descriptionInput) {
            descriptionInput.value = "";
        }

        closeCreateGroup();

        await loadStudyGroups();

        if (data.group) {
            await selectStudyGroup(
                data.group.id
            );
        }

        showToast(
            "🎉 Study group created!"
        );

    } catch (error) {
        console.error(
            "Create group error:",
            error
        );

        showToast(
            "❌ " + error.message
        );
    }
}

// ==============================
// SELECT STUDY GROUP
// ==============================

async function selectStudyGroup(groupId) {
    try {
        const response =
            await fetch(
                `${BACKEND}/api/study-groups/${encodeURIComponent(groupId)}`,
                {
                    credentials: "include"
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.error ||
                "Could not open group"
            );
        }

        currentGroup =
            data.group || data;

        renderCurrentGroup();

        await loadGroupMessages();

        startMessagePolling();

    } catch (error) {
        console.error(error);

        showToast(
            "❌ " + error.message
        );
    }
}

// ==============================
// RENDER CURRENT GROUP
// ==============================

function renderCurrentGroup() {

    const nameElement =
        document.getElementById(
            "chatGroupName"
        );

    const membersElement =
        document.getElementById(
            "chatGroupMembers"
        );

    const chatInputArea =
        document.getElementById(
            "chatInputArea"
        );

    const leaveButton =
        document.getElementById(
            "leaveGroupButton"
        );

    if (!currentGroup) {
        if (chatInputArea) {
            chatInputArea.classList.add(
                "hidden"
            );
        }

        if (leaveButton) {
            leaveButton.classList.add(
                "hidden"
            );
        }

        return;
    }

    if (nameElement) {
        nameElement.textContent =
            "💬 " +
            (
                currentGroup.name ||
                "Study Group"
            );
    }

    if (membersElement) {
        membersElement.textContent =
            `👥 ${
                currentGroup.memberCount || 0
            } members`;
    }

    if (chatInputArea) {
        chatInputArea.classList.remove(
            "hidden"
        );
    }

    if (leaveButton) {
        leaveButton.classList.remove(
            "hidden"
        );
    }
}

// ==============================
// JOIN GROUP
// ==============================

async function joinGroup(groupId) {
    try {
        const response =
            await fetch(
                `${BACKEND}/api/study-groups/${encodeURIComponent(groupId)}/join`,
                {
                    method: "POST",
                    credentials: "include"
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.error ||
                "Could not join group"
            );
        }

        showToast(
            "✅ Joined study group!"
        );

        await loadStudyGroups();

        await selectStudyGroup(
            groupId
        );

    } catch (error) {
        console.error(error);

        showToast(
            "❌ " + error.message
        );
    }
}

// ==============================
// LEAVE GROUP
// ==============================

async function leaveCurrentGroup() {

    if (!currentGroup) {
        return;
    }

    const groupId =
        currentGroup.id;

    if (!confirm(
        "Leave this study group?"
    )) {
        return;
    }

    try {
        const response =
            await fetch(
                `${BACKEND}/api/study-groups/${encodeURIComponent(groupId)}/leave`,
                {
                    method: "POST",
                    credentials: "include"
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.error ||
                "Could not leave group"
            );
        }

        currentGroup = null;

        stopMessagePolling();

        renderCurrentGroup();

        await loadStudyGroups();

        showToast(
            "You left the study group."
        );

    } catch (error) {
        console.error(error);

        showToast(
            "❌ " + error.message
        );
    }
}

// ==============================
// GROUP MESSAGES
// ==============================

async function loadGroupMessages() {

    if (!currentGroup) {
        return;
    }

    try {
        const response =
            await fetch(
                `${BACKEND}/api/study-groups/${encodeURIComponent(currentGroup.id)}/messages`,
                {
                    credentials: "include"
                }
            );

        if (!response.ok) {
            return;
        }

        const data =
            await response.json();

        const messages =
            Array.isArray(data)
                ? data
                : data.messages || [];

        const container =
            document.getElementById(
                "chatMessages"
            );

        if (!container) {
            return;
        }

        if (messages.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    No messages yet.
                    Start the conversation!
                </div>
            `;

            return;
        }

        container.innerHTML =
            messages.map(message => `
                <div class="message">

                    <div class="message-header">

                        <strong>
                            ${escapeHTML(
                                message.userName ||
                                message.authorName ||
                                "Student"
                            )}
                        </strong>

                        <span>
                            ${formatMessageTime(
                                message.createdAt
                            )}
                        </span>

                    </div>

                    <div class="message-text">
                        ${escapeHTML(
                            message.text || ""
                        )}
                    </div>

                    <div class="message-actions">

                        <button
                            onclick="reportMessage('${message.id}')">
                            Report
                        </button>

                        ${
                            message.isOwner
                                ? `
                                    <button
                                        onclick="deleteMessage('${message.id}')">
                                        Delete
                                    </button>
                                `
                                : ""
                        }

                    </div>

                </div>
            `).join("");

        container.scrollTop =
            container.scrollHeight;

    } catch (error) {
        console.error(
            "Message loading error:",
            error
        );
    }
}

function formatMessageTime(timestamp) {
    if (!timestamp) {
        return "";
    }

    const date =
        new Date(timestamp);

    if (Number.isNaN(
        date.getTime()
    )) {
        return "";
    }

    return date.toLocaleTimeString(
        [],
        {
            hour: "numeric",
            minute: "2-digit"
        }
    );
}

function startMessagePolling() {
    stopMessagePolling();

    messageTimer =
        setInterval(
            () => {
                loadGroupMessages();
            },
            3000
        );
}

function stopMessagePolling() {
    if (messageTimer) {
        clearInterval(
            messageTimer
        );

        messageTimer = null;
    }
}

// ==============================
// CHAT
// ==============================

function handleChatKey(event) {
    if (
        event.key === "Enter" &&
        !event.shiftKey
    ) {
        event.preventDefault();

        sendGroupMessage();
    }
}

async function sendGroupMessage() {

    if (!currentGroup) {
        showToast(
            "Join a group first."
        );

        return;
    }

    // FIXED: matches index.html
    const input =
        document.getElementById(
            "chatInput"
        );

    if (!input) {
        console.error(
            "Missing #chatInput"
        );

        return;
    }

    const text =
        input.value.trim();

    if (!text) {
        return;
    }

    if (text.length > 500) {
        showToast(
            "Message is too long."
        );

        return;
    }

    try {
        const response =
            await fetch(
                `${BACKEND}/api/study-groups/${encodeURIComponent(currentGroup.id)}/messages`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials: "include",

                    body: JSON.stringify({
                        text
                    })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.error ||
                "Could not send message"
            );
        }

        input.value = "";

        await loadGroupMessages();

    } catch (error) {
        console.error(error);

        showToast(
            "❌ " + error.message
        );
    }
}

// ==============================
// DELETE MESSAGE
// ==============================

async function deleteMessage(messageId) {

    if (!currentGroup) {
        return;
    }

    try {
        const response =
            await fetch(
                `${BACKEND}/api/study-groups/${encodeURIComponent(currentGroup.id)}/messages/${encodeURIComponent(messageId)}`,
                {
                    method: "DELETE",
                    credentials: "include"
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.error ||
                "Could not delete message"
            );
        }

        await loadGroupMessages();

        showToast(
            "Message deleted."
        );

    } catch (error) {
        console.error(error);

        showToast(
            "❌ " + error.message
        );
    }
}

// ==============================
// REPORT MESSAGE
// ==============================

async function reportMessage(messageId) {

    if (!currentGroup) {
        return;
    }

    try {
        const response =
            await fetch(
                `${BACKEND}/api/study-groups/${encodeURIComponent(currentGroup.id)}/messages/${encodeURIComponent(messageId)}/report`,
                {
                    method: "POST",
                    credentials: "include"
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.error ||
                "Could not report message"
            );
        }

        showToast(
            "🚩 Message reported."
        );

    } catch (error) {
        console.error(error);

        showToast(
            "❌ " + error.message
        );
    }
}

// ==============================
// BAD WORD DETECTOR
// ==============================
const banned = [
    "fuck",
    "bitch",
    "ass",
    "motherfucker",
    "Get deported",
    
];

function containsBannedWord(message) {
    const lowerMessage = message.toLowerCase();

    return banned.some(word =>
        lowerMessage.includes(word.toLowerCase())
    );
}
// ==============================
// STUDY TIMER
// ==============================

function updateTimerDisplay() {

    const display =
        document.getElementById(
            "timerDisplay"
        );

    if (!display) {
        return;
    }

    const minutes =
        Math.floor(
            timerSeconds / 60
        );

    const seconds =
        timerSeconds % 60;

    display.textContent =
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function startTimer() {

    if (timerRunning) {
        return;
    }

    timerRunning = true;

    timerInterval =
        setInterval(
            () => {

                if (
                    timerSeconds <= 0
                ) {
                    finishTimer();
                    return;
                }

                timerSeconds--;

                updateTimerDisplay();

            },
            1000
        );

    showToast(
        "▶️ Timer started!"
    );
}

function pauseTimer() {

    if (!timerRunning) {
        return;
    }

    clearInterval(
        timerInterval
    );

    timerInterval = null;

    timerRunning = false;

    showToast(
        "⏸️ Timer paused"
    );
}

function resetTimer() {

    clearInterval(
        timerInterval
    );

    timerInterval = null;

    timerRunning = false;

    timerSeconds =
        25 * 60;

    updateTimerDisplay();

    showToast(
        "🔄 Timer reset"
    );
}

function finishTimer() {

    clearInterval(
        timerInterval
    );

    timerInterval = null;

    timerRunning = false;

    timerSeconds = 0;

    updateTimerDisplay();

    atoms += 5;

    updateAtoms();

    showToast(
        "🎉 Focus session complete! +5 Atoms"
    );
}

function setTimer(minutes) {

    clearInterval(
        timerInterval
    );

    timerInterval = null;

    timerRunning = false;

    timerSeconds =
        minutes * 60;

    updateTimerDisplay();

    showToast(
        `⏱️ ${minutes}-minute timer set`
    );
}

// ==============================
// CALCULATOR
// ==============================

function calculateTool() {

    const input =
        document.getElementById(
            "calculatorInput"
        );

    const result =
        document.getElementById(
            "calculatorResult"
        );

    if (!input || !result) {
        return;
    }

    const expression =
        input.value.trim();

    if (!expression) {
        result.textContent =
            "Enter a calculation first.";

        return;
    }

    try {

        if (
            !/^[0-9+\-*/().%\s]+$/
                .test(expression)
        ) {
            throw new Error(
                "Invalid characters"
            );
        }

        const answer =
            Function(
                `"use strict"; return (${expression})`
            )();

        if (
            !Number.isFinite(answer)
        ) {
            throw new Error(
                "Invalid result"
            );
        }

        result.textContent =
            `Result: ${answer}`;

    } catch {
        result.textContent =
            "Could not calculate that.";
    }
}

// ==============================
// SHOP
// ==============================

function buyItem(
    itemName,
    price
) {

    if (atoms < price) {
        showToast(
            `❌ You need ${price} Atoms`
        );

        return;
    }

    atoms -= price;

    updateAtoms();

    const purchased =
        JSON.parse(
            localStorage.getItem(
                "atomscapePurchases"
            ) || "[]"
        );

    if (
        !purchased.includes(
            itemName
        )
    ) {
        purchased.push(
            itemName
        );
    }

    localStorage.setItem(
        "atomscapePurchases",
        JSON.stringify(purchased)
    );

    showToast(
        `🛍️ Purchased ${itemName}!`
    );
}

// ==============================
// CALENDAR
// ==============================

let calendarEvents =
    JSON.parse(
        localStorage.getItem(
            "atomscapeCalendar"
        ) || "[]"
    );

function saveCalendarEvents() {
    localStorage.setItem(
        "atomscapeCalendar",
        JSON.stringify(
            calendarEvents
        )
    );
}

function addCalendarEvent() {

    const dateInput =
        document.getElementById(
            "calendarDate"
        );

    const eventInput =
        document.getElementById(
            "calendarEvent"
        );

    if (
        !dateInput ||
        !eventInput
    ) {
        return;
    }

    const date =
        dateInput.value;

    const name =
        eventInput.value.trim();

    if (!date || !name) {
        showToast(
            "Enter a date and event name."
        );

        return;
    }

    calendarEvents.push({
        id: Date.now().toString(),
        date,
        name
    });

    calendarEvents.sort(
        (a, b) =>
            new Date(a.date) -
            new Date(b.date)
    );

    saveCalendarEvents();

    eventInput.value = "";

    renderCalendarEvents();

    showToast(
        "📅 Event added!"
    );
}

function deleteCalendarEvent(id) {

    calendarEvents =
        calendarEvents.filter(
            event =>
                event.id !== id
        );

    saveCalendarEvents();

    renderCalendarEvents();
}

function renderCalendarEvents() {

    const container =
        document.getElementById(
            "calendarEvents"
        );

    if (!container) {
        return;
    }

    if (
        calendarEvents.length === 0
    ) {
        container.innerHTML =
            "No events yet.";

        return;
    }

    container.innerHTML =
        calendarEvents.map(
            event => `
                <div class="calendar-event">

                    <div>

                        <strong>
                            ${escapeHTML(
                                event.name
                            )}
                        </strong>

                        <small>
                            ${escapeHTML(
                                event.date
                            )}
                        </small>

                    </div>

                    <button
                        onclick="deleteCalendarEvent('${event.id}')">
                        ✕
                    </button>

                </div>
            `
        ).join("");
}

// ==============================
// DATA PLOTTER
// ==============================

let dataChart = null;

function plotData() {

    const labelsInput =
        document.getElementById(
            "plotLabels"
        );

    const valuesInput =
        document.getElementById(
            "plotValues"
        );

    const canvas =
        document.getElementById(
            "dataChart"
        );

    if (
        !labelsInput ||
        !valuesInput ||
        !canvas
    ) {
        return;
    }

    const labels =
        labelsInput.value
            .split(",")
            .map(
                value =>
                    value.trim()
            )
            .filter(Boolean);

    const values =
        valuesInput.value
            .split(",")
            .map(
                value =>
                    Number(
                        value.trim()
                    )
            );

    if (
        labels.length === 0 ||
        values.length === 0 ||
        labels.length !== values.length ||
        values.some(
            value =>
                !Number.isFinite(value)
        )
    ) {
        showToast(
            "Make sure your labels and numbers match."
        );

        return;
    }

    if (
        typeof Chart === "undefined"
    ) {
        showToast(
            "Chart.js has not loaded yet."
        );

        return;
    }

    if (dataChart) {
        dataChart.destroy();
    }

    dataChart =
        new Chart(
            canvas.getContext("2d"),
            {
                type: "line",

                data: {
                    labels,

                    datasets: [
                        {
                            label:
                                "Study Data",

                            data:
                                values,

                            tension:
                                0.3
                        }
                    ]
                },

                options: {
                    responsive: true,

                    plugins: {
                        legend: {
                            display: true
                        }
                    }
                }
            }
        );
}

// ==============================
// NOTES
// ==============================

let notes =
    JSON.parse(
        localStorage.getItem(
            "atomscapeNotes"
        ) || "[]"
    );

function saveNotes() {
    localStorage.setItem(
        "atomscapeNotes",
        JSON.stringify(notes)
    );
}

function saveNote() {

    const titleInput =
        document.getElementById(
            "noteTitle"
        );

    const textInput =
        document.getElementById(
            "noteText"
        );

    if (
        !titleInput ||
        !textInput
    ) {
        return;
    }

    const title =
        titleInput.value.trim();

    const text =
        textInput.value.trim();

    if (!title && !text) {
        showToast(
            "Write something before saving."
        );

        return;
    }

    notes.unshift({
        id: Date.now().toString(),
        title:
            title ||
            "Untitled Note",
        text,
        createdAt:
            new Date().toISOString()
    });

    saveNotes();

    titleInput.value = "";
    textInput.value = "";

    renderNotes();

    showToast(
        "📝 Note saved!"
    );
}

function deleteNote(id) {

    notes =
        notes.filter(
            note =>
                note.id !== id
        );

    saveNotes();

    renderNotes();
}

function renderNotes() {

    const container =
        document.getElementById(
            "notesList"
        );

    if (!container) {
        return;
    }

    if (notes.length === 0) {
        container.innerHTML =
            "No saved notes yet.";

        return;
    }

    container.innerHTML =
        notes.map(
            note => `
                <div class="note-card">

                    <div class="note-content">

                        <h3>
                            ${escapeHTML(
                                note.title
                            )}
                        </h3>

                        <p>
                            ${escapeHTML(
                                note.text
                            )}
                        </p>

                    </div>

                    <button
                        onclick="deleteNote('${note.id}')">
                        ✕
                    </button>

                </div>
            `
        ).join("");
}

// ==============================
// WEB SEARCH
// ==============================

function handleWebSearchKey(event) {

    if (
        event.key === "Enter"
    ) {
        searchWeb();
    }
}

function searchWeb() {

    const input =
        document.getElementById(
            "webSearchInput"
        );

    if (!input) {
        return;
    }

    const query =
        input.value.trim();

    if (!query) {
        showToast(
            "Enter something to search."
        );

        return;
    }

    const url =
        "https://www.google.com/search?q=" +
        encodeURIComponent(query);

    window.open(
        url,
        "_blank",
        "noopener,noreferrer"
    );
}

// ==============================
// LOAD SAVED TOOLS
// ==============================

function loadSavedTools() {

    renderCalendarEvents();

    renderNotes();

    updateTimerDisplay();

    updateAtoms();
}

// ==============================
// STARTUP
// ==============================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        // Load saved Atoms immediately
        updateAtoms();

        loadSavedTools();

        checkConnection();

        const connected =
            new URLSearchParams(
                window.location.search
            ).get("connected");

        if (connected === "1") {

            showToast(
                "✅ Google Classroom connected!"
            );

            window.history.replaceState(
                {},
                document.title,
                window.location.pathname
            );
        }

        // Navigation
        document.querySelectorAll(
            "nav button[data-section]"
        ).forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    showSection(
                        button.dataset.section,
                        button
                    );

                }
            );

        });

    }
);
