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
  checkRoom,
  changeRoomSettings,
  findRoom,
  setInitialGamestate,
  resetGamestate,
  nextRound,
  addBet,
  removeBet,
  clearBets,
  clearNets,
  calculateBets,
  calculateNets,
  checkBankrupt,
  rollDice,
  setReady,
  allPlayersReady,
  removePlayer,
  addMessage,
  resetTime,
  countdown,
} = require("./room");

// SOCKET HANDLER
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
    const user = joinRoom(socket.id, name, room);
    if (user === null) return null;
    socket.join(user.room);
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
      settings: r.settings,
    });

    io.to(socket.roomname).emit("players", { players: r.players });
  });

  // SOCKET HANDLER - SETTINGS
  socket.on("timerchange", ({ timer }) => {
    const option = changeRoomSettings(socket.roomname, "time", timer);
    if (option === null) return null;
    io.to(socket.roomname).emit("timeropt", { timer: option });
  });
  socket.on("roundschange", ({ rounds }) => {
    const option = changeRoomSettings(socket.roomname, "rounds", rounds);
    if (option === null) return null;
    io.to(socket.roomname).emit("roundsopt", { rounds: option });
  });
  socket.on("balancechange", ({ balance }) => {
    const option = changeRoomSettings(socket.roomname, "balance", balance);
    if (option === null) return null;
    io.to(socket.roomname).emit("balanceopt", { balance: option });
  });

  // SOCKET HANDLER - STARTING OR RESTARTING A GAME
  socket.on("startgame", ({ balance }) => {
    const gamestate = setInitialGamestate(socket.roomname, balance);
    if (gamestate === null) return null;
    io.to(socket.roomname).emit("gamestart", { gamestate });
  });
  socket.on("playagain", () => {
    const gamestate = resetGamestate(socket.roomname);
    if (gamestate === null) return null;
    io.to(socket.roomname).emit("gamerestart", { gamestate });
  });

  // SOCKET HANDLER - ROUND FLOW
  socket.on("roundstart", () => {
    // Clear the dice and restart the time at the start of each round
    let current_time = resetTime(socket.roomname);
    if (current_time === null) return null;

    io.to(socket.roomname).emit("timer", { current_time });
    io.to(socket.roomname).emit("cleardice");
    io.to(socket.roomname).emit("showround");

    // Start the round
    setTimeout(() => {
      io.to(socket.roomname).emit("hideround");

      // Set interval for the timer to go off every second
      let interval = setInterval(() => {
        current_time = countdown(socket.roomname);
        if (current_time === null) {
          clearInterval(interval);
        } else if (current_time >= 0) {
          io.to(socket.roomname).emit("timer", { current_time });
        } else {
          // continue post-betting game flow
          clearInterval(interval);
          io.to(socket.roomname).emit("showtimesup");

          // Roll the dice
          setTimeout(() => {
            io.to(socket.roomname).emit("hidetimesup");

            let gamestate = rollDice(socket.roomname);
            if (gamestate === null) return null;

            io.to(socket.roomname).emit("diceroll", {
              die1: gamestate.dice[0],
              die2: gamestate.dice[1],
              die3: gamestate.dice[2],
            });

            // Calculate the wins and losses
            setTimeout(() => {
              let results = calculateNets(socket.roomname);
              io.to(socket.roomname).emit("showresults", { results });

              // Calculate the total scores and update the gamestate
              setTimeout(() => {
                io.to(socket.roomname).emit("hideresults");

                results = calculateBets(socket.roomname);

                gamestate = clearBets(socket.roomname);
                if (gamestate === null) return null;
                gamestate = clearNets(socket.roomname);
                if (gamestate === null) return null;

                // Send new gamestate to clients after calculations
                io.to(socket.roomname).emit("newgamestate", {
                  gamestate,
                });

                // Start the next round or end the game
                let round = nextRound(socket.roomname);
                let bankrupt = checkBankrupt(socket.roomname);
                if (bankrupt === null) return null;

                if (round === -1 || bankrupt) {
                  io.to(socket.roomname).emit("gameover", { results });
                } else {
                  io.to(socket.roomname).emit("nextround", { round });
                }
              }, 5000);
            }, 5500);
          }, 3000);
        }
      }, 1000);
    }, 3000);
  });

  // SOCKET HANDLER - ROUND FLOW AFTER LOCKING IN BETS
  socket.on("readyplayer", () => {
    let gamestate = setReady(socket.romoname, socket.id);
    if (gamestate === null) return null;

    io.to(socket.roomname).emit("newgamestate", { gamestate });

    // If all players are ready, the dice roll begins
    const all_ready = allPlayersReady(socket.roomname);
    if (gamestate === null) return null;

    if (all_ready) {
      io.to(socket.roomname).emit("showallbetsin");

      // Roll the dice
      setTimeout(() => {
        io.to(socket.roomname).emit("hiderolling");

        let gamestate = rollDice(socket.roomname);
        if (gamestate === null) return null;

        io.to(socket.roomname).emit("diceroll", {
          die1: gamestate.dice[0],
          die2: gamestate.dice[1],
          die3: gamestate.dice[2],
        });

        // Calculate the wins and losses
        setTimeout(() => {
          let results = calculateNets(socket.roomname);
          io.to(socket.roomname).emit("showresults", { results });

          // Calculate the total scores and update the gamestate
          setTimeout(() => {
            io.to(socket.roomname).emit("hideallbetsin");

            results = calculateBets(socket.roomname);

            gamestate = clearBets(socket.roomname);
            if (gamestate === null) return null;
            gamestate = clearNets(socket.roomname);
            if (gamestate === null) return null;

            // Send new gamestate to clients after calculations
            io.to(socket.roomname).emit("newgamestate", {
              gamestate,
            });

            // Start the next round or end the game
            let round = nextRound(socket.roomname);
            let bankrupt = checkBankrupt(socket.roomname);
            if (bankrupt === null) return null;

            if (round === -1 || bankrupt) {
              io.to(socket.roomname).emit("gameover", { results });
            } else {
              io.to(socket.roomname).emit("nextround", { round });
            }
          }, 5000);
        }, 5500);
      }, 3000);
    }
  });

  // SOCKET HANDLER - BETTING
  socket.on("bet", ({ id, amount, animal }) => {
    const gamestate = addBet(socket.roomname, id, amount, animal);
    if (gamestate === null) return null;
    io.to(socket.roomname).emit("newgamestate", { gamestate });
  });
  socket.on("unbet", ({ id, amount, animal }) => {
    const gamestate = removeBet(socket.roomname, id, amount, animal);
    if (gamestate === null) return null;
    io.to(socket.roomname).emit("newgamestate", { gamestate });
  });

  // SOCKET HANDLER - CHAT
  socket.on("sendmessage", ({ id, name, message }) => {
    const chatbox = addMessage(id, socket.roomname, name, message);
    if (chatbox === null) return null;
    io.to(socket.roomname).emit("chatbox", { chatbox });
  });

  // SOCKET HANDLER - REMOVE PLAYER FROM ROOM
  socket.on("removeplayer", () => {
    // Remove the player from the room
    const player = removePlayer(socket.id, socket.roomname);
    if (player === null) return null;

    // Update the room
    const r = findRoom(player.room)[0];
    if (r === undefined) return null;

    // New player list
    io.to(player.room).emit("players", {
      players: r.players,
    });

    // New host if last host has left
    const new_host = r.players[0].id;
    r.host = new_host;
    io.to(user.room).emit("newhost", { host: r.host });

    // New gamestate
    if (r[0].active) {
      const gamestate = r;
      io.to(user.room).emit("newgamestate", { gamestate });
    }
  });

  // SOCKET HANDLER - DISCONNECT
  socket.on("disconnect", () => {
    console.log(socket.id + " had left");

    // Remove the player from the room
    const player = removePlayer(socket.id, socket.roomname);
    if (player === null) return null;

    // Update the room
    const r = findRoom(player.room)[0];
    if (r === undefined) return null;

    // New player list
    io.to(player.room).emit("players", {
      players: r.players,
    });

    // New host if last host has left
    const new_host = r.players[0].id;
    r.host = new_host;
    io.to(user.room).emit("newhost", { host: r.host });

    // New gamestate
    if (r[0].active) {
      const gamestate = r;
      io.to(user.room).emit("newgamestate", { gamestate });
    }
  });
});

// Server listener
http.listen(port, () => {
  console.log("listening on *:9000");
});
