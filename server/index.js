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
  countdown,
  resetTime,
} = require("./room");

// Socket handler
io.on("connection", (socket) => {
  console.log(socket.id + " has just connected");

  // SOCKET HANDLER - HOSTING A ROOM
  socket.on("host", ({ name, room }, callback) => {
    socket.roomname = room;

    // Error checking to see if room already exists
    if (findRoom(room).length > 0) {
      callback("Unable to create the room.");
    }

    // Create a new room
    createRoom(socket.id, room);
    callback();

    // Check that room was successfully created before joining
    const status = checkRoom(room);
    if (status) {
      callback(status);
    }

    // Add socket to the room
    const user = joinRoom(socket.id, name, room);
    if (user === null) return null;
    socket.join(user.room);
    callback();
  });

  // SOCKET HANDLER - JOINING A ROOM
  socket.on("join", ({ name, room }, callback) => {
    socket.roomname = room;

    // Add socket to specified room
    const user = joinRoom({ id: socket.id, name, room });
    socket.join(user.room);
    if (user === null) return null;
    callback();
  });

  // SOCKET HANDLER - ERROR CHECKING ROOM CODE
  socket.on("check", ({ room }, callback) => {
    const status = checkRoom(room);
    if (status) {
      callback(status);
    } else {
      callback();
    }
  });

  // SOCKET HANDLER - SETUP ROOM ON HOST OR JOIN LOBBY
  socket.on("roomsetup", () => {
    const r = findRoom(socket.roomname)[0];
    if (r === undefined) return null;

    io.to(socket.roomname).emit("roomdata", {
      room: socket.roomname,
      host: r.host,
      id: socket.id,
      settings: r.settings,
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

  /* ADDED --------------------------------------------------------------------------- */
  socket.on("roundstart", () => {
    var current_time = resetTime(socket.roomname);
    io.to(socket.roomname).emit("timer", current_time);
    io.to(socket.roomname).emit("cleardice");
    console.log(Object.keys(io.sockets.sockets));
    for (let i = 0; i < Object.keys(io.sockets.sockets).length; i++) {
      console.log(Object.keys(io.sockets.sockets)[i]);
      io.to(Object.keys(io.sockets.sockets)[i]).emit("showround");
    }
    // io.to(socket.roomname).emit("showround");
    setTimeout(() => {
      io.to(socket.roomname).emit("hideround");

      var interval = setInterval(() => {
        current_time = countdown(socket.roomname);
        if (current_time === null) {
          clearInterval(interval);
        } else if (current_time >= 0) {
          io.to(socket.roomname).emit("timer", current_time);
        } else {
          clearInterval(interval);
          io.to(socket.roomname).emit("showtimesup");
          setTimeout(() => {
            io.to(socket.roomname).emit("hidetimesup");
            var state = rollDice({ room: socket.roomname });
            if (state === null) return; // weird but need to come back and fix error here
            io.to(socket.roomname).emit("diceroll", {
              die1: state.dice[0],
              die2: state.dice[1],
              die3: state.dice[2],
            });
            setTimeout(() => {
              var results = calculateNets(socket.roomname);
              io.to(socket.roomname).emit("showresults", results);
              setTimeout(() => {
                io.to(socket.roomname).emit("hideresults");
                results = calculateBets(socket.roomname);
                clearBets(socket.roomname);
                state = clearNets(socket.roomname);
                io.to(socket.roomname).emit("newgamestate", {
                  gamestate: state,
                });

                var round = nextRound(socket.roomname);
                if (round === -1 || checkBankrupt(socket.roomname)) {
                  io.to(socket.roomname).emit("gameover", results);
                } else {
                  io.to(socket.roomname).emit("nextround", round);
                }
              }, 5000);
            }, 5500);
          }, 3000);
        }
      }, 1000);
    }, 3000);
  });

  socket.on("readyplayer", () => {
    const gamestate = setReady({
      room: socket.roomname,
      id: socket.id,
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
      io.to(socket.roomname).emit("rolltime");
      setTimeout(() => {
        io.to(socket.roomname).emit("hiderolling");
        var state = rollDice({ room: socket.roomname });
        if (state === null) return; // weird but need to come back and fix error here
        io.to(socket.roomname).emit("diceroll", {
          die1: state.dice[0],
          die2: state.dice[1],
          die3: state.dice[2],
        });
        setTimeout(() => {
          var results = calculateNets(socket.roomname);
          io.to(socket.roomname).emit("showresults", results);
          setTimeout(() => {
            io.to(socket.roomname).emit("hideresults");
            results = calculateBets(socket.roomname);
            clearBets(socket.roomname);
            state = clearNets(socket.roomname);
            io.to(socket.roomname).emit("newgamestate", { gamestate: state });

            var round = nextRound(socket.roomname);
            if (round === -1 || checkBankrupt(socket.roomname)) {
              io.to(socket.roomname).emit("gameover", results);
            } else {
              io.to(socket.roomname).emit("nextround", round);
            }
          }, 5000);
        }, 5500);
      }, 3000);
    }
  });

  socket.on("playagain", () => {
    const gamestate = resetRoom(socket.roomname);
    io.to(socket.roomname).emit("gamerestart", { gamestate });
  });
  /* ADDED --------------------------------------------------------------------------- */

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
