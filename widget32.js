(function () {
  console.log("🤖 Widget16 Enhanced UX Loaded");

  const API = "https://codrant.com/api.php";

  // =========================
  // CUSTOMER ID (SAFE)
  // =========================
  function getCustomerId() {
    const script =
      document.currentScript ||
      document.querySelector("script[src*='widget']");

    return (
      script?.getAttribute("data-id") ||
      script?.getAttribute("data-key") ||
      script?.getAttribute("data-customer-id")
    );
  }

  const customer_id = getCustomerId();

  if (!customer_id) {
    console.error("❌ Missing customer_id");
    return;
  }

  // =========================
  // USER ID
  // =========================
  let user_id = localStorage.getItem("cw_user_id");

  if (!user_id) {
    user_id = crypto.randomUUID();
    localStorage.setItem("cw_user_id", user_id);
  }

  // =========================
  // API CALL (FALLBACK SAFE)
  // =========================
  async function api(action, method = "GET", body = null, query = "") {

    try {

      const res = await fetch(`${API}?action=${action}${query}`, {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: body ? JSON.stringify(body) : null
      });

      return await res.json();

    } catch (err) {

      console.error("API error:", err);
      return {};
    }
  }

  // =========================
  // UI
  // =========================
  const icon = document.createElement("div");

  icon.innerHTML = "💬";

  icon.style = `
    position:fixed;
    bottom:20px;
    right:20px;
    width:55px;
    height:55px;
    background:#007bff;
    color:#fff;
    border-radius:50%;
    display:flex;
    align-items:center;
    justify-content:center;
    cursor:pointer;
    font-size:22px;
    z-index:999999;
  `;

  const box = document.createElement("div");

  box.style = `
    position:fixed;
    bottom:90px;
    right:20px;
    width:340px;
    height:460px;
    background:#fff;
    border-radius:12px;
    display:none;
    flex-direction:column;
    overflow:hidden;
    z-index:999999;
    box-shadow:0 8px 25px rgba(0,0,0,0.2);
  `;

  box.innerHTML = `
    <div id="header" style="padding:12px;color:#fff;background:#007bff;font-weight:bold;">
      Chat Support
    </div>

    <div id="suggestions" style="height:140px;overflow:auto;background:#fafafa;border-bottom:1px solid #eee;"></div>

    <div id="messages" style="flex:1;overflow:auto;padding:10px;background:#f9f9f9;"></div>

    <div style="display:flex;border-top:1px solid #ddd;">
      <input id="input" placeholder="Type message..."
        style="flex:1;padding:10px;border:none;outline:none;">
      <button id="send" style="padding:10px 15px;background:#007bff;color:#fff;border:none;">
        ➤
      </button>
    </div>
  `;

  document.body.appendChild(icon);
  document.body.appendChild(box);

  const messages = box.querySelector("#messages");
  const input = box.querySelector("#input");
  const sendBtn = box.querySelector("#send");
  const suggestionsBox = box.querySelector("#suggestions");

  let debounce;

  // =========================
  // MESSAGE UI
  // =========================
  function addMessage(text, type) {

    const div = document.createElement("div");

    div.style = `
      margin:6px 0;
      padding:10px;
      border-radius:10px;
      max-width:80%;
      font-size:14px;
      ${type === "user"
        ? "background:#007bff;color:#fff;margin-left:auto;"
        : "background:#eee;color:#000;"}
    `;

    div.innerText = text;

    messages.appendChild(div);

    messages.scrollTop = messages.scrollHeight;
  }

  // =========================
  // TRACK USAGE
  // UNIQUE CLICK PROTECTION
  // =========================
  const tracked = new Set();

  async function trackUsage(question_id) {

    if (!question_id) return;

    // prevent duplicate calls in same session
    if (tracked.has(question_id)) return;

    tracked.add(question_id);

    try {

      await api("track_faq_usage", "POST", {
        customer_id,
        question_id,
        user_id
      });

    } catch (e) {

      console.log("Tracking failed");
    }
  }

  // =========================
  // SUGGESTIONS (ACTIVE PANEL UX)
  // =========================
  function renderSuggestions(data) {

    suggestionsBox.innerHTML = "";

    data.forEach((item) => {

      const div = document.createElement("div");

      div.innerText = "💬 " + item.question;

      div.style = `
        padding:8px;
        cursor:pointer;
        border-bottom:1px solid #eee;
      `;

      // hover effect
      div.onmouseenter = () => {
        div.style.background = "#f0f0f0";
      };

      div.onmouseleave = () => {
        div.style.background = "transparent";
      };

      // =========================
      // CLICK
      // =========================
      div.onclick = async () => {

        // set question
        input.value = item.question;

        // track instantly
        await trackUsage(item.id);

        // send chat
        sendMessage();
      };

      suggestionsBox.appendChild(div);
    });
  }

  // =========================
  // LOAD TOP FAQS
  // =========================
  async function loadTop() {

    const res = await api(
      "get_top_faqs",
      "GET",
      null,
      `&customer_id=${customer_id}`
    );

    if (res.data?.length) {
      renderSuggestions(res.data);
    }
  }

  // =========================
  // SEARCH FAQS
  // =========================
  async function searchFaqs(q) {

    if (!q) {
      return loadTop();
    }

    const res = await api(
      "search_faqs",
      "GET",
      null,
      `&customer_id=${customer_id}&q=${encodeURIComponent(q)}`
    );

    if (res.data?.length) {
      renderSuggestions(res.data);
    } else {
      suggestionsBox.innerHTML = "";
    }
  }

  // =========================
  // SEND MESSAGE
  // =========================
  async function sendMessage() {

    const msg = input.value.trim();

    if (!msg) return;

    addMessage(msg, "user");

    input.value = "";

    const res = await api("chat", "POST", {
      customer_id,
      message: msg,
      user_id
    });

    addMessage(res.reply || "No response", "bot");
  }

  // =========================
  // EVENTS
  // =========================
  icon.onclick = () => {

    const open = box.style.display === "flex";

    box.style.display = open ? "none" : "flex";

    if (!open) {
      loadTop();
    }
  };

  // open suggestions on focus
  input.addEventListener("focus", loadTop);

  // search debounce
  input.addEventListener("input", () => {

    clearTimeout(debounce);

    debounce = setTimeout(() => {
      searchFaqs(input.value.trim());
    }, 150);
  });

  sendBtn.onclick = sendMessage;

  input.addEventListener("keypress", (e) => {

    if (e.key === "Enter") {
      sendMessage();
    }
  });

  // =========================
  // THEME
  // =========================
  api(
    "get_theme",
    "GET",
    null,
    `&customer_id=${customer_id}`
  ).then(data => {

    const color = data.theme_color || "#007bff";

    icon.style.background = color;

    sendBtn.style.background = color;

    box.querySelector("#header").style.background = color;
  });

})();
