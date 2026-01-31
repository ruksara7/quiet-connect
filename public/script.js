const socket = io();

const status = document.getElementById("status");
const chat = document.getElementById("chat");
const messages = document.getElementById("messages");
const input = document.getElementById("input");
const prefsDiv = document.getElementById("prefs");

function findMatch() {
  const prefs = {
    talk: document.getElementById("talk").value,
    alone: document.getElementById("alone").value,
    style: document.getElementById("style").value
  };

  socket.emit("find_match", prefs);
  prefsDiv.style.display = "none";
  status.innerText = "Waiting for compatible person...";
}

/* 🔑 THIS WAS MISSING / BROKEN */
socket.on("matched", () => {
  status.innerText = "Matched! Start chatting.";
  chat.style.display = "block";
});

/* status updates */
socket.on("status", msg => {
  status.innerText = msg;
});

/* receive messages */
socket.on("message", msg => {
  const p = document.createElement("p");
  p.innerText = "Partner: " + msg;
  messages.appendChild(p);
});

/* send message */
function send() {
  if (!input.value) return;

  socket.emit("message", input.value);

  const p = document.createElement("p");
  p.innerText = "You: " + input.value;
  messages.appendChild(p);

  input.value = "";
}
