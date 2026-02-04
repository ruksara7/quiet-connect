import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

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
  process.exit(1);
}

/* ======================
   MATCHING STATE
   ====================== */
let waitingUser = null;

/* ======================
   SYSTEM ASSISTANT (STATE BASED) - FIXED
   ====================== */
app.post("/assistant-message", async (req, res) => {
  try {
    // CRITICAL: Map state → intent_key for n8n Switch
    const state = req.body?.state || "unknown";
    
    console.log("📨 Assistant state received:", state);

    const response = await fetch(N8N_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "User-Agent": "Quiet-Connect/1.0"
      },
      body: JSON.stringify({ 
        intent_key: state  // ← FIXED: n8n expects intent_key
      })
    });

    const raw = await response.text();
    console.log("📥 N8N RAW RESPONSE:", raw || "EMPTY");

    // Handle empty n8n response (no Switch match)
    if (!raw || raw.trim() === "") {
      return res.json({
        system: true,
        state: state,
        message: ""
      });
    }

    // Parse and validate n8n JSON response
    let n8nData;
    try {
      n8nData = JSON.parse(raw);
    } catch (e) {
      console.error("❌ Invalid JSON from n8n:", raw);
      return res.status(500).json({
        system: true,
        state: "error",
        message: "Assistant processing failed"
      });
    }

    // Forward clean n8n response
    res.json({
      system: true,
      state: n8nData.state || state,
      message: n8nData.message || ""
    });

  } catch (error) {
    console.error("💥 Assistant error:", error.message);
    res.status(500).json({
      system: true,
      state: "error",
      message: "Assistant temporarily unavailable"
    });
  }
});

/* ======================
   USER ↔ USER CHAT (SOCKET.IO) - ENHANCED
   ====================== */
io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.id);

  socket.on("prefs", (prefs) => {
    socket.prefs = prefs;
    console.log("✅ Prefs set for", socket.id, prefs);
    
    if (socket.partnerId) {
      io.to(socket.partnerId).emit("partnerPrefs", prefs);
    }
  });

  // MATCHING LOGIC
  socket.on("join_waiting", () => {
    if (waitingUser && waitingUser.id !== socket.id) {
      // MATCH FOUND
      const partner = waitingUser;
      waitingUser = null;

      socket.partnerId = partner.id;
      partner.partnerId = socket.id;

      // Notify both users
      socket.emit("status", { 
        state: "matched", 
        message: "✅ You're connected! Chat now." 
      });
      partner.emit("status", { 
        state: "matched", 
        message: "✅ You're connected! Chat now." 
      });

      // Exchange prefs
      if (partner.prefs) socket.emit("partnerPrefs", partner.prefs);
      if (socket.prefs) partner.emit("partnerPrefs", socket.prefs);

      console.log("💕 Match made:", socket.id, "↔", partner.id);
      
    } else {
      // WAITING
      waitingUser = socket;
      socket.emit("status", { 
        state: "waiting", 
        message: "⏳ Waiting quietly for someone to join…" 
      });
      console.log("⏳", socket.id, "now waiting");
    }
  });

  // CHAT MESSAGES
  socket.on("message", (msg) => {
    if (socket.partnerId) {
      io.to(socket.partnerId).emit("message", {
        ...msg,
        fromMe: false,  // Partner sees as from other
        timestamp: Date.now()
      });
      console.log("💬", socket.id, "→", msg.text?.substring(0, 30));
    }
  });

  // DISCONNECT HANDLING
  socket.on("disconnect", () => {
    console.log("🔌", socket.id, "disconnected");
    
    if (waitingUser?.id === socket.id) {
      waitingUser = null;
      console.log("🕐 Waiting cleared");
    }
    
    if (socket.partnerId) {
      io.to(socket.partnerId).emit("status", { 
        state: "disconnected", 
        message: "Partner left the chat" 
      });
      console.log("💔", socket.id, "left partner:", socket.partnerId);
    }
  });
});

/* ======================
   HEALTH CHECK
   ====================== */
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    n8n: !!N8N_URL,
    timestamp: new Date().toISOString()
  });
});

/* ======================
   START SERVER
   ====================== */
const PORT = process.env.PORT || 10000;  // Render default

server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Quiet Connect running on port ${PORT}`);
  console.log(`🌐 N8N integration: ${N8N_URL ? 'READY' : 'MISSING'}`);
});
