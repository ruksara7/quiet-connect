import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.json());
app.use(express.static("public"));

const N8N_URL = process.env.N8N_URL;

if (!N8N_URL) {
  console.error("❌ N8N_URL environment variable is NOT set");
  process.exit(1);
}

let waitingUser = null;

app.post("/assistant-message", async (req, res) => {
  try {
    const payload = req.body;
    console.log("📨 Assistant state received:", JSON.stringify(payload));

    const n8nResponse = await fetch(N8N_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Quiet-Connect/1.0"
      },
      body: JSON.stringify(payload)  // Sends { state: "waiting" } or { text: "hello" }
    });

    const raw = await n8nResponse.text();
    console.log("📥 N8N RAW RESPONSE:", raw.substring(0, 200) || "EMPTY");

    // n8n success
    if (raw && raw.trim() !== "") {
      const data = JSON.parse(raw);
      console.log("✅ N8N SUCCESS:", JSON.stringify(data));
      return res.json(data);
    }

    // n8n fallback
    const fallback = payload.state === "waiting" ? 
      { system: true, message: "⏳ Please wait quietly…" } :
      { system: false, message: `Echo: ${payload.text}` };
    
    console.log("🔄 FALLBACK RESPONSE:", JSON.stringify(fallback));
    res.json(fallback);

  } catch (err) {
    console.error("💥 N8N ERROR:", err.message);
    const payload = req.body;
    const fallback = payload.state === "waiting" ? 
      { system: true, message: "⏳ Please wait quietly…" } :
      { system: false, message: "N8N learning mode active" };
    res.json(fallback);
  }
});

// ... rest of your socket.io code stays SAME ...
io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.id);

  socket.on("prefs", (prefs) => {
    socket.prefs = prefs;
    console.log("✅ Prefs set:", socket.id, prefs);
    if (socket.partnerId) {
      io.to(socket.partnerId).emit("partnerPrefs", prefs);
    }
  });

  socket.on("message", (msg) => {
    if (!socket.partnerId) return;
    const payload = typeof msg === "string" ? { text: msg } : msg;
    io.to(socket.partnerId).emit("message", payload);
    console.log("💬", socket.id, "→", payload.text?.slice(0, 30));
  });

  socket.on("disconnect", () => {
    console.log("🔌 Disconnected:", socket.id);
    if (waitingUser?.id === socket.id) waitingUser = null;
    if (socket.partnerId) {
      io.to(socket.partnerId).emit("status", {
        state: "disconnected",
        message: "Partner left the chat"
      });
    }
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", n8n: Boolean(N8N_URL), time: new Date().toISOString() });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Quiet Connect running on port ${PORT}`);
  console.log(`🌐 N8N automation learning: READY`);
});
