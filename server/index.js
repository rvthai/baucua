const app = require("express")();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  pingInterval: 25000,
  pingTimeout: 60000,
});

const {
  createRoom,
  joinRoom,
  getUserInRoom,
  removeUser,
  findRoom,
  getRoom,
  addBet,
  setReady,
  rollDice,
  addMessage,
  getChatroom,
} = require("./room");

const port = 9000;

io.on("connection", (socket) => {
  console.log(socket.id + " has just connected");

  socket.on("check", (room, callback) => {
    const r = findRoom(room);
    if (r.length === 0) {
      callback(true, "The room you tried to enter does not exist.");
    } else if (r.length > 0 && r[0].players.length >= 8) {
      callback(true, "The room you tried to enter is already full.");
    }
    callback();
  });

  //SOCKET JOIN
  socket.on("join", ({ name, room, newRoom }, callback) => {
    socket.roomname = room;

    // Create room if newRoom is true
    if (newRoom) {
      const error = createRoom({ id: socket.id, room });
      if (error) return callback();
      callback();
    }

    // Add socket to specified room
    const r = findRoom(room);
    const { user, error } = joinRoom({ id: socket.id, name, room });
    if (error) return callback(error);
    socket.join(user.room);

    // Emit data back to client
    io.to(user.room).emit("players", { players: getUserInRoom(user.room) });
    io.to(user.room).emit("roomdata", { room: r[0], id: socket.id });
    callback();

    if (r[0].active) {
      const gamestate = getRoom({ room });
      const chat = getChatroom({ room });
      io.to(room).emit("gamestart", { gamestate });
      io.to(room).emit("gamestate", { gamestate });
      io.to(room).emit("chatbox", { chat });
    }
  });
  //SOCKET LOBBY SETTINGS
  socket.on("timerchange", ({timer}) => {
    io.to(socket.roomname).emit("timeropt", ({timer}));
  })
  socket.on("roundchange", ({round}) => {
    io.to(socket.roomname).emit("roundopt", ({round}));
  })

  //SOCKET GAME LOGIC
  socket.on("startgame", ({ room }) => {
    const gamestate = getRoom({ room });
    io.to(room).emit("gamestart", { gamestate });
  });

  socket.on("readyplayer", ({ gamestate }) => {
    const readyPlayer = setReady({ room: gamestate.roomId, id: socket.id });
    let r = true;
    for (let i = 0; i < readyPlayer.players.length; i++) {
      if (readyPlayer.players[i].ready === false) {
        r = false;
      }
    }
    if (r) {
      const state = rollDice({ room: readyPlayer.roomId });
      io.to(readyPlayer.roomId).emit("newgamestate", { gamestate: state });
    } else {
      io.to(readyPlayer.roomId).emit("gamestate", { gamestate: readyPlayer });
    }
  });

  socket.on("bet", ({ room, id, amount, animal }) => {
    const gamestate = addBet({ room, id, amount, animal });
    io.to(room).emit("gamestate", { gamestate });
  });

  //SOCKET CHAT
  socket.on("sendMessage", ({ name, message }) => {
    const chat = addMessage({ room: socket.roomname, name, message });
    io.to(socket.roomname).emit("chatbox", { chat });
  });

  //SOCKET TIMER
  socket.on("timer", ({ room, timer }) => {
    if (timer === 0) {
      io.to(room).emit("endtimer");
    } else {
      io.to(room).emit("timer", { second: timer - 1 });
    }
  });

  // Socket disconnects
  socket.on("disconnect", () => {
    console.log(socket.id + " had left");
    //anytime for any reason if a socket disconnects the code below will remove that player
    //from the gameroom
    const user = removeUser({ id: socket.id, room: socket.roomname });
    if (user) {
      io.to(user.room).emit("players", { players: getUserInRoom(user.room) });

      const r = findRoom(user.room);
      if (r.length !== 0) {
        const newHost = r[0].players[0].id;
        r[0].host = newHost;
        io.to(user.room).emit("newhost", r[0].host);
      }

      if (r.length !== 0 && r[0].active) {
        const gamestate = getRoom({ room: user.room });
        io.to(user.room).emit("gamestate", { gamestate });
      }
    }
  });
});

http.listen(9000, () => {
  console.log("listening on *:9000");
});
