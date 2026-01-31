import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// serve frontend
app.use(express.static("public"));

let waitingUser = null;

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
    if (waitingUser?.id === socket.id) waitingUser = null;
    if (socket.partnerId) {
      io.to(socket.partnerId).emit("status", "Partner left");
    }
  });
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
