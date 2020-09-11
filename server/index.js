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
  calculateProfit2,
  clearNets,
  checkBankrupt,
  resetRoom,
  checkRoom,
} = require("./room");

const port = 9000;

// Socket handler
io.on("connection", (socket) => {
  console.log(socket.id + " has just connected");

  // SOCKET HOST
  socket.on("host", ({ name, room }, callback) => {
    socket.roomname = room;

    // Check to see if room already exists
    if (findRoom(room).length > 0) {
      callback("Unable to create the room.");
    }

    // Create a new room
    createRoom({ id: socket.id, room });
    callback();

    // Add socket to the room
    const status = checkRoom(room);
    if (status) {
      callback(status);
    }
    callback();

    const { user, error } = joinRoom({ id: socket.id, name, room });
    socket.join(user.room);
    callback();

    // Emit data back to client
    const rm = findRoom(room);
    io.to(user.room).emit("roomdata", {
      room: room,
      host: rm[0].host,
      id: socket.id,
    });
    io.to(user.room).emit("players", { players: getUserInRoom(user.room) });
  });

  // SOCKET JOIN
  socket.on("join", ({ name, room }, callback) => {
    socket.roomname = room;

    // Add socket to specified room
    const { user, error } = joinRoom({ id: socket.id, name, room });
    socket.join(user.room);
    callback();

    // Emit data back to client
    const r = findRoom(room);
    io.to(user.room).emit("players", { players: getUserInRoom(user.room) });
    io.to(user.room).emit("roomdata", {
      room: room,
      host: r[0].host,
      id: socket.id,
    });
  });

  // SOCKET ROOM CODE CHECK
  socket.on("check", (room, callback) => {
    const status = checkRoom(room);
    if (status) {
      callback(status);
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
  socket.on("startgame", ({ balance }) => {
    const gamestate = setInitialBalance({ room: socket.roomname, balance });
    io.to(socket.roomname).emit("gamestart", { gamestate });
  });

  //SOCKET START AND END MODAL
  socket.on("showstartmodal", () => {
    const state = clearNets(socket.roomname);
    io.to(socket.roomname).emit("newgamestate", { gamestate: state });
    io.to(socket.roomname).emit("cleardice");
    io.to(socket.roomname).emit("showstartmodal", { round: state.round });
  });
  socket.on("hidestartmodal", () => {
    io.to(socket.roomname).emit("hidestart");
  });
  socket.on("showgameover", () => {
    const state = clearNets(socket.roomname);
    io.to(socket.roomname).emit("newgamestate", { gamestate: state });
    io.to(socket.roomname).emit("showgameover");
  });

  socket.on("hideendmodal", ({ maxRound }) => {
    calculateProfit(socket.roomname);
    const state = clearBets(socket.roomname);
    // const a = nextRound({ room: socket.roomname });
    var gameover = false;
    if (state.round > maxRound || checkBankrupt(socket.roomname)) {
      gameover = true;
    }
    // io.to(socket.roomname).emit("newgamestate", { gamestate: state });
    io.to(socket.roomname).emit("hideend", { gameover });
  });

  // SOCKET TIMER
  socket.on("timer", ({ timer }) => {
    if (timer === 0) {
      io.to(socket.roomname).emit("endtimer");
    } else {
      io.to(socket.roomname).emit("timer", { second: timer - 1 });
    }
  });

  //SOCKET READY/TIMER OVER
  socket.on("readyplayer", ({ gamestate }) => {
    const readyPlayer = setReady({ room: gamestate.roomId, id: socket.id });
    io.to(socket.roomname).emit("newgamestate", { gamestate: readyPlayer });

    let r = true;
    for (let i = 0; i < readyPlayer.players.length; i++) {
      if (readyPlayer.players[i].ready === false) {
        r = false;
      }
    }

    // if all players are ready, the dice roll begins
    if (r) {
      const state = rollDice({ room: readyPlayer.roomId });
      //io.to(socket.roomname).emit("newgamestate", { gamestate: state });

      io.to(socket.roomname).emit("diceroll", {
        die1: state.dice[0],
        die2: state.dice[1],
        die3: state.dice[2],
      });
      nextRound({ room: socket.roomname });
      const gameroom = calculateProfit2(socket.roomname);

      io.to(socket.roomname).emit("showendmodal", {
        gamestate: gameroom,
      });
    }
    /*else {
      io.to(readyPlayer.roomId).emit("gamestate", { gamestate: readyPlayer }); // this may have to change
    }*/
  });

  // SOCKET BET
  socket.on("bet", ({ id, amount, animal }) => {
    const gamestate = addBet({ room: socket.roomname, id, amount, animal });
    io.to(socket.roomname).emit("newgamestate", { gamestate });
  });

  socket.on("unbet", ({ id, amount, animal }) => {
    const gamestate = removeBet({ room: socket.roomname, id, amount, animal });
    io.to(socket.roomname).emit("newgamestate", { gamestate });
  });

  // SOCKET CHAT
  socket.on("sendMessage", ({ id, name, message }) => {
    const chatbox = addMessage({ id, room: socket.roomname, name, message });
    io.to(socket.roomname).emit("chatbox", { chatbox });
  });

  // Socket return
  socket.on("playagain", () => {
    const gamestate = resetRoom(socket.roomname);
    io.to(socket.roomname).emit("gamerestart", { gamestate });
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

        if (r[0].active) {
          const gamestate = getRoom({ room: user.room });
          io.to(user.room).emit("newgamestate", { gamestate });
        }
      }
    }
  });
});

// Server listener
http.listen(port, () => {
  console.log("listening on *:9000");
});
