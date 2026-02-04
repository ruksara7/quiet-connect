import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

/* ======================
   MIDDLEWARE
   ====================== */
app.use(express.json());
app.use(express.static("public"));

/* ======================
   ENV
   ====================== */
const N8N_URL = process.env.N8N_URL;

if (!N8N_URL) {
  console.error("❌ N8N_URL environment variable is NOT set");
}

/* ======================
   MATCHING STATE
   ====================== */
let waitingUser = null;

/* ======================
   SYSTEM ASSISTANT
   ====================== */
app.post("/assistant-message", async (req, res) => {
  try {
    const userText = req.body?.text || "";

    const response = await fetch(N8N_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: userText })
    });

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error("Assistant error:", error);
    res.status(500).json({
      system: true,
      state: "error",
      message: "Assistant unavailable"
    });
  }
});

/* ======================
   USER ↔ USER CHAT
   ====================== */
io.on("connection", (socket) => {

  socket.on("prefs", (prefs) => {
    socket.prefs = prefs;
    if (socket.partnerId) {
      io.to(socket.partnerId).emit("partnerPrefs", prefs);
    }
  });

  if (!waitingUser) {
    waitingUser = socket;
    socket.emit("status", "Waiting quietly for someone to join…");
  } else {
    const partner = waitingUser;
    waitingUser = null;

    socket.partnerId = partner.id;
    partner.partnerId = socket.id;

    socket.emit("status", "You’re connected.");
    partner.emit("status", "You’re connected.");

    if (partner.prefs) socket.emit("partnerPrefs", partner.prefs);
    if (socket.prefs) partner.emit("partnerPrefs", socket.prefs);
  }

  socket.on("message", (msg) => {
    if (socket.partnerId) {
      io.to(socket.partnerId).emit("message", msg);
    }
  });

  socket.on("disconnect", () => {
    if (waitingUser?.id === socket.id) {
      waitingUser = null;
    }
    if (socket.partnerId) {
      io.to(socket.partnerId).emit("status", "Partner left");
    }
  });
});

/* ======================
   START SERVER
   ====================== */
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
