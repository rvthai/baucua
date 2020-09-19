const app = require("express")();
const http = require("http").createServer(app);
const port = 9000;

const io = require("socket.io")(http, {
  pingInterval: 25000,
  pingTimeout: 60000,
});

// Room.js functions
const {
  createRoom,
  joinRoom,
  findRoom,
  checkRoom,
  changeRoomSettings,
  setInitialBalance,
  addBet,
  removeBet,
  clearBets,
  clearNets,
  calculateBets,
  calculateNets,
  checkBankrupt,
  rollDice,
  setReady,
  nextRound,
  resetRoom,
  addMessage,
  removeUser,
} = require("./room");

// Socket handler
io.on("connection", (socket) => {
  console.log(socket.id + " has just connected");

  /* SOCKET - HOST */
  socket.on("host", ({ name, room }, callback) => {
    socket.roomname = room;

    // Check to see if room already exists
    if (findRoom(room).length > 0) {
      callback("Unable to create the room.");
    }

    // Create a new room
    createRoom({ id: socket.id, room });
    callback();

    // Check that room was successfully created before joining
    const status = checkRoom(room);
    if (status) {
      callback(status);
    }
    callback();

    // Add socket to the room
    const user = joinRoom({ id: socket.id, name, room });
    socket.join(user.room);
    callback();
  });

  /* SOCKET - JOIN */
  socket.on("join", ({ name, room }, callback) => {
    socket.roomname = room;

    // Add socket to specified room
    const user = joinRoom({ id: socket.id, name, room });
    socket.join(user.room);
    callback();
  });

  /* SOCKET - CHECK ROOM CODE */
  socket.on("check", (room, callback) => {
    const status = checkRoom(room);
    if (status) {
      callback(status);
    }
    callback();
  });

  /* SOCKET -  ROOM SETUP*/
  socket.on("roomsetup", () => {
    const r = findRoom(socket.roomname);
    io.to(socket.roomname).emit("roomdata", {
      room: socket.roomname,
      settings: r[0].settings,
      host: r[0].host,
      id: socket.id,
    });
    io.to(socket.roomname).emit("players", { players: r[0].players });
  });

  /* SOCKET - SETTINGS */
  socket.on("timerchange", ({ timer }) => {
    changeRoomSettings(socket.roomname, "time", timer);
    io.to(socket.roomname).emit("timeropt", { timer });
  });
  socket.on("roundchange", ({ round }) => {
    changeRoomSettings(socket.roomname, "rounds", round);
    io.to(socket.roomname).emit("roundopt", { round });
  });
  socket.on("balancechange", ({ balance }) => {
    changeRoomSettings(socket.roomname, "balance", balance);
    io.to(socket.roomname).emit("balanceopt", { balance });
  });

  /* SOCKET - GAME START */
  socket.on("startgame", ({ balance }) => {
    const gamestate = setInitialBalance({ room: socket.roomname, balance });
    io.to(socket.roomname).emit("gamestart", { gamestate });
  });

  /* SOCKET - GAME TRANSITIONS */
  socket.on("showstartmodal", () => {
    const state = clearNets(socket.roomname);
    io.to(socket.roomname).emit("newgamestate", { gamestate: state });
    io.to(socket.roomname).emit("cleardice");
    io.to(socket.roomname).emit("showstartmodal", { round: state.round });
  });
  socket.on("hidestartmodal", () => {
    io.to(socket.roomname).emit("hidestart");
  });
  socket.on("hideendmodal", () => {
    calculateBets(socket.roomname);
    const gamestate = clearBets(socket.roomname);
    var gameover = false;
    if (
      gamestate.round > gamestate.settings.rounds ||
      checkBankrupt(socket.roomname)
    ) {
      gameover = true;
    }
    io.to(socket.roomname).emit("hideend", { gameover });
  });
  socket.on("showgameover", () => {
    const gamestate = clearNets(socket.roomname);
    io.to(socket.roomname).emit("newgamestate", { gamestate });
    io.to(socket.roomname).emit("showgameover");
  });

  /* SOCKET - PLAY AGAIN */
  socket.on("playagain", () => {
    const gamestate = resetRoom(socket.roomname);
    io.to(socket.roomname).emit("gamerestart", { gamestate });
  });

  /* SOCKET - TIMER */
  socket.on("timer", ({ timer }) => {
    if (timer === 0) {
      io.to(socket.roomname).emit("endtimer");
    } else {
      io.to(socket.roomname).emit("timer", { second: timer - 1 });
    }
  });

  /* SOCKET - PLAYER READY or TIMER ENDS */
  socket.on("readyplayer", (locked_in) => {
    const gamestate = setReady({
      room: socket.roomname,
      id: socket.id,
      locked_in,
    });
    io.to(socket.roomname).emit("newgamestate", { gamestate });

    let all_ready = true;
    for (let i = 0; i < gamestate.players.length; i++) {
      if (gamestate.players[i].ready === false) {
        all_ready = false;
      }
    }

    // if all players are ready, the dice roll begins
    if (all_ready) {
      var state = rollDice({ room: socket.roomname });

      io.to(socket.roomname).emit("diceroll", {
        die1: state.dice[0],
        die2: state.dice[1],
        die3: state.dice[2],
      });

      nextRound({ room: socket.roomname });
      state = calculateNets(socket.roomname);
      io.to(socket.roomname).emit("showendmodal", {
        gamestate: state,
      });
    }
  });

  /* SOCKET - BETTING */
  socket.on("bet", ({ id, amount, animal }) => {
    const gamestate = addBet({ room: socket.roomname, id, amount, animal });
    io.to(socket.roomname).emit("newgamestate", { gamestate });
  });
  socket.on("unbet", ({ id, amount, animal }) => {
    const gamestate = removeBet({ room: socket.roomname, id, amount, animal });
    io.to(socket.roomname).emit("newgamestate", { gamestate });
  });

  /* SOCKET - CHAT */
  socket.on("sendmessage", ({ id, name, message }) => {
    const chatbox = addMessage({ id, room: socket.roomname, name, message });
    io.to(socket.roomname).emit("chatbox", { chatbox });
  });

  /* SOCKET - Remove Player NOT disconnected */
  socket.on("removeplayer", () => {
    const user = removeUser({ id: socket.id, room: socket.roomname });

    if (user) {
      const r = findRoom(user.room);
      if (r.length !== 0) {
        io.to(user.room).emit("players", {
          players: r[0].players,
        });
        const newHost = r[0].players[0].id;
        r[0].host = newHost;
        io.to(user.room).emit("newhost", r[0].host);

        if (r[0].active) {
          const gamestate = r[0];
          io.to(user.room).emit("newgamestate", { gamestate });
        }
      }
    }
  });

  /* SOCKET - DISCONNECT */
  socket.on("disconnect", () => {
    console.log(socket.id + " had left");

    const user = removeUser({ id: socket.id, room: socket.roomname });

    if (user) {
      const r = findRoom(user.room);
      if (r.length !== 0) {
        io.to(user.room).emit("players", {
          players: r[0].players,
        });
        const newHost = r[0].players[0].id;
        r[0].host = newHost;
        io.to(user.room).emit("newhost", r[0].host);

        if (r[0].active) {
          const gamestate = r[0];
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
