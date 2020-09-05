const app = require("express")();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  pingInterval: 25000,
  pingTimeout: 60000,
});

// Room.js functions
const {
  createRoom,
  joinRoom,
  getUserInRoom,
  removeUser,
  findRoom,
  getRoom,
  addBet,
  removeBet,
  setReady,
  nextRound,
  rollDice,
  addMessage,
  getChatroom,
  clearBets,
  setInitialBalance,
  calculateProfit,
  clearNets,
} = require("./room");

const port = 9000;

// Socket handler
io.on("connection", (socket) => {
  console.log(socket.id + " has just connected");

  // SOCKET HOST
  socket.on("host", ({ name, room }, callback) => {
    socket.roomname = room;

    // Create a new room
    const { r, err } = createRoom({ id: socket.id, room });
    if (err) return callback(err);
    callback();

    // Add socket to the room
    const { user, error } = joinRoom({ id: socket.id, name, room });
    if (error) return callback(error);
    socket.join(user.room);
    callback();

    // Emit data back to client
    const rm = findRoom(room);
    io.to(user.room).emit("players", { players: getUserInRoom(user.room) });
    io.to(user.room).emit("roomdata", {
      room: rm[0],
      roomid: room,
      id: socket.id,
    });
  });

  // SOCKET JOIN
  socket.on("join", ({ name, room }, callback) => {
    socket.roomname = room;

    // Add socket to specified room
    const { user, error } = joinRoom({ id: socket.id, name, room });
    if (error) return callback(error);
    socket.join(user.room);
    callback();

    // Emit data back to client
    const r = findRoom(room);
    io.to(user.room).emit("players", { players: getUserInRoom(user.room) });
    io.to(user.room).emit("roomdata", {
      room: r[0],
      roomid: room,
      id: socket.id,
    });

    if (r[0].active) {
      const gamestate = getRoom({ room });
      const chat = getChatroom({ room });
      io.to(room).emit("gamestart", { gamestate });
      io.to(room).emit("gamestate", { gamestate });
      io.to(room).emit("chatbox", { chat });
    }
  });

  // SOCKET ROOM CODE CHECK
  socket.on("check", (room, callback) => {
    const r = findRoom(room);
    if (r.length === 0) {
      callback(true, "The room you tried to enter does not exist.");
    } else if (r.length > 0 && r[0].players.length >= 8) {
      callback(true, "The room you tried to enter is already full.");
    }
    callback();
  });

  // SOCKET LOBBY SETTINGS
  socket.on("timerchange", ({ timer }) => {
    io.to(socket.roomname).emit("timeropt", { timer });
  });
  socket.on("roundchange", ({ round }) => {
    io.to(socket.roomname).emit("roundopt", { round });
  });
  socket.on("balancechange", ({ balance }) => {
    io.to(socket.roomname).emit("balanceopt", { balance });
  });

  // SOCKET GAME
  socket.on("startgame", ({ room, balance }) => {
    const gamestate = setInitialBalance({ room, balance });
    io.to(room).emit("gamestart", { gamestate });
  });

  //SOCKET START AND END MODAL
  socket.on("showstartmodal", () => {
    const state = clearNets(socket.roomname);
    io.to(socket.roomname).emit("newgamestate", { gamestate: state });
    io.to(socket.roomname).emit("showstartmodal");
  });
  socket.on("hidestartmodal", () => {
    io.to(socket.roomname).emit("hidestart");
  });
  socket.on("showgameover", () => {
    io.to(socket.roomname).emit("showgameover");
  });

  socket.on("hideendmodal", ({ round, maxRound }) => {
    const gameover = round > maxRound;
    console.log(gameover);
    const state = clearBets(socket.roomname);
    io.to(socket.roomname).emit("newgamestate", { gamestate: state });
    io.to(socket.roomname).emit("hideend", { gameover });
  });

  // SOCKET TIMER
  socket.on("timer", ({ room, timer }) => {
    if (timer === 0) {
      io.to(room).emit("endtimer");
    } else {
      io.to(room).emit("timer", { second: timer - 1 });
    }
  });

  //SOCKET READY/TIMER OVER
  socket.on("readyplayer", ({ gamestate }) => {
    const readyPlayer = setReady({ room: gamestate.roomId, id: socket.id });
    let r = true;
    for (let i = 0; i < readyPlayer.players.length; i++) {
      if (readyPlayer.players[i].ready === false) {
        r = false;
      }
    }
    //if all players ready this if statement
    // if all players are ready, the dice roll begins
    if (r) {
      const state = rollDice({ room: readyPlayer.roomId });
      var gamestate = nextRound({ room: socket.roomname });
      io.to(socket.roomname).emit("newgamestate", { gamestate: state });
      io.to(socket.roomname).emit("diceroll", {
        dice1: gamestate.dice[0],
        dice2: gamestate.dice[1],
        dice3: gamestate.dice[2],
      });
      gamestate = calculateProfit(socket.roomname);
      io.to(socket.roomname).emit("showendmodal", {
        round: gamestate.round,
        gamestate,
      });
    } else {
      io.to(readyPlayer.roomId).emit("gamestate", { gamestate: readyPlayer });
    }
  });

  // SOCKET BET
  socket.on("bet", ({ room, id, amount, animal }) => {
    const gamestate = addBet({ room, id, amount, animal });
    io.to(room).emit("newgamestate", { gamestate });
  });

  socket.on("unbet", ({ id, amount, animal }) => {
    const gamestate = removeBet({ room: socket.roomname, id, amount, animal });
    io.to(socket.roomname).emit("newgamestate", { gamestate });
  });

  // SOCKET CHAT
  socket.on("sendMessage", ({ name, message }) => {
    const chat = addMessage({ room: socket.roomname, name, message });
    io.to(socket.roomname).emit("chatbox", { chat });
  });

  // SOCKET DISCONNECT
  socket.on("disconnect", () => {
    console.log(socket.id + " had left");

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

// Server listener
http.listen(port, () => {
  console.log("listening on *:9000");
});
