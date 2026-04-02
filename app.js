// ─── DOM Elements ───────────────────────────────────────────────────────
const phase1 = document.getElementById("phase-1");
const phase2 = document.getElementById("phase-2");
const btnPhase1 = document.getElementById("btn-phase-1");
const btnPhase2 = document.getElementById("btn-phase-2");
const loader = document.getElementById("loader");
const loaderText = document.getElementById("loader-text");
const dynamicContainer = document.getElementById("dynamic-questions-container");

// State
let phase1Answers = {};

// ─── PHASE 1 SUBMIT ───────────────────────────────────────────────────
if (btnPhase1) {
  btnPhase1.addEventListener("click", async () => {
    const q1 = document.getElementById("q1").value.trim();
    const q2 = document.getElementById("q2").value.trim();
    const q3 = document.getElementById("q3").value.trim();

    if (!q1 || !q2 || !q3) {
      alert("Please answer all 3 initial questions so we can guide you properly.");
      return;
    }

    phase1Answers = { q1, q2, q3 };

    // Show Loading
    loader.style.display = "flex";
    loaderText.textContent = "Reading your answers...";

    try {
      const response = await fetch("/api/adaptive-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: phase1Answers })
      });

      if (!response.ok) throw new Error("Failed to fetch questions");
      const data = await response.json();

      // Render Dynamic Questions
      dynamicContainer.innerHTML = "";
      data.questions.forEach((questionText, index) => {
        const qNum = index + 4; // Starts from Q4
        const group = document.createElement("div");
        group.className = "question-group";
        group.style.animationDelay = `${index * 0.1}s`;
        
        group.innerHTML = `
          <label class="question-label" for="q${qNum}">${qNum}. ${questionText}</label>
          <textarea id="q${qNum}" class="question-input" placeholder="Type your answer here..."></textarea>
        `;
        dynamicContainer.appendChild(group);
      });

      // Switch views
      loader.style.display = "none";
      phase1.style.display = "none";
      phase2.style.display = "block";
      window.scrollTo(0, 0);

    } catch (err) {
      console.error(err);
      loader.style.display = "none";
      alert("Something went wrong connecting to the AI. Please try again.");
    }
  });
}

// ─── PHASE 2 SUBMIT ───────────────────────────────────────────────────
if (btnPhase2) {
  btnPhase2.addEventListener("click", async () => {
    // Gather dynamic answers
    const phase2Answers = {};
    const textareas = dynamicContainer.querySelectorAll("textarea");
    
    let allAnswered = true;
    textareas.forEach(ta => {
      if (!ta.value.trim()) allAnswered = false;
      const questionLabel = ta.previousElementSibling.textContent;
      phase2Answers[questionLabel] = ta.value.trim();
    });

    if (!allAnswered) {
      alert("Please answer all follow-up questions to get a complete report.");
      return;
    }

    // Show Loading
    loader.style.display = "flex";
    loaderText.textContent = "Building your PathReport... (this takes a moment)";

    try {
      const response = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase1: phase1Answers, phase2: phase2Answers })
      });

      if (!response.ok) throw new Error("Failed to generate report");
      const data = await response.json();

      sessionStorage.setItem("pathreport", JSON.stringify(data));
      window.location.href = "result.html";

    } catch (err) {
      console.error(err);
      loader.style.display = "none";
      alert("Failed to build the report. Please check server logs.");
    }
  });
}

// ─── RESULT RENDERING (result.html) ───────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const isResultPage = document.getElementById("el-profile-summary");
  if (!isResultPage) return;

  const rawData = sessionStorage.getItem("pathreport");
  if (!rawData) {
    window.location.href = "form.html";
    return;
  }

  const data = JSON.parse(rawData);

  // Simple binds
  document.getElementById("el-key-insight").textContent = data.key_insight || "";
  document.getElementById("el-profile-summary").textContent = data.profile_summary || "";

  // Lists
  const strengthsEl = document.getElementById("el-strengths");
  (data.strengths || []).forEach(s => {
    const li = document.createElement("li");
    li.textContent = s;
    strengthsEl.appendChild(li);
  });

  const gapsEl = document.getElementById("el-gaps");
  (data.gaps || []).forEach(g => {
    const li = document.createElement("li");
    li.textContent = g;
    gapsEl.appendChild(li);
  });

  // Careers
  const careersEl = document.getElementById("el-careers");
  (data.careers || []).forEach(c => {
    const exams = (c.entrance_exams || []).map(e => `<span class="tag">${e}</span>`).join("");
    careersEl.innerHTML += `
      <div class="card career-card">
        <h3>${c.title}</h3>
        <div class="career-meta">
          <span class="tag earning">${c.earning_range}</span>
          ${exams}
        </div>
        <p class="career-desc">${c.why_it_fits}</p>
        <div class="reality-check"><strong>Reality Check:</strong> ${c.reality_check}</div>
      </div>
    `;
  });

  // Colleges
  const collegesEl = document.getElementById("el-colleges");
  (data.colleges || []).forEach(c => {
    collegesEl.innerHTML += `
      <div class="card college-card">
        <div class="col-main">
          <div class="col-name">${c.name}</div>
          <div class="col-details">
            <span class="text-accent">${c.type}</span>
            <span>·</span>
            <span>${c.city}</span>
            <span>·</span>
            <span style="color:#e0e0e0; font-weight:500;">${c.course_to_target}</span>
          </div>
          <div class="col-why"><strong>Why it fits:</strong> ${c.why_this_fits_student}</div>
        </div>
        <div class="difficulty-badge diff-${c.difficulty}">${c.difficulty}</div>
      </div>
    `;
  });

  // Emerging Roles
  const emergingEl = document.getElementById("el-emerging");
  (data.emerging_roles || []).forEach(e => {
    emergingEl.innerHTML += `
      <div class="card">
        <h3 class="text-accent" style="margin-bottom:0.5rem; font-size:1.15rem;">${e.title}</h3>
        <p style="color:#d0d0d0; margin-bottom:0.8rem;">${e.description}</p>
        <p style="font-size:0.9rem; color:var(--muted);"><strong>Why relevant:</strong> ${e.why_relevant}</p>
      </div>
    `;
  });

  // Next Actions
  const actionsEl = document.getElementById("el-actions");
  (data.next_30_days || []).forEach(a => {
    const li = document.createElement("li");
    li.innerHTML = `<div>${a}</div>`;
    actionsEl.appendChild(li);
  });

  // ─── CHATBOT LOGIC ──────────────────────────────────────────────────────
  const chatMessages = document.getElementById("chat-messages");
  const chatInput = document.getElementById("chat-input");
  const chatSend = document.getElementById("chat-send");
  const chatChipsContainer = document.getElementById("chat-chips");
  
  if (!chatMessages) return;

  let chatHistory = []; // We won't include the first dummy message in the actual history payload

  function appendBubble(role, text) {
    const isUser = role === "user";
    const div = document.createElement("div");
    div.className = `chat-bubble ${isUser ? "student-bubble" : "ai-bubble"}`;
    if (!isUser && text === "...") div.classList.add("loading-bubble");
    div.textContent = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
  }

  // Chips clicking
  if (chatChipsContainer) {
    chatChipsContainer.querySelectorAll(".chip").forEach(chip => {
      chip.addEventListener("click", () => {
        chatInput.value = chip.textContent;
        chatInput.focus();
        // optionally remove chips after first click
        // chatChipsContainer.style.display = "none";
      });
    });
  }

  async function handleSend() {
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = "";
    chatInput.disabled = true;
    chatSend.disabled = true;

    // Append user message
    appendBubble("user", text);
    chatHistory.push({ role: "user", content: text });

    // Hide chips if they exist
    if (chatChipsContainer) chatChipsContainer.style.display = "none";

    // Show loading
    const loadingBubble = appendBubble("assistant", "...");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          pathreport: data, // full report from sessionStorage
          history: chatHistory.slice(0, -1) // pass history excluding the current message as we pass it as 'message'
        })
      });

      if (!response.ok) throw new Error("API error");
      const resData = await response.json();
      
      loadingBubble.remove();
      appendBubble("assistant", resData.reply);
      chatHistory.push({ role: "assistant", content: resData.reply });

    } catch (err) {
      console.error(err);
      loadingBubble.remove();
      appendBubble("assistant", "Sorry, something went wrong. Let's try again.");
      chatHistory.pop(); // remove user message from history so they can retry
    } finally {
      chatInput.disabled = false;
      chatSend.disabled = false;
      chatInput.focus();
    }
  }

  chatSend.addEventListener("click", handleSend);
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Auto grow textarea
  chatInput.addEventListener("input", function() {
    this.style.height = "auto";
    this.style.height = (this.scrollHeight < 150 ? this.scrollHeight : 150) + "px";
  });
});
