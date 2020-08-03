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
  rollDice,
  addMessage,
  getChatroom,
} = require("./room");

const port = 9000;

io.on("connection", (socket) => {
  console.log(socket.id + " has just connected");

  //SOCKET JOIN
  socket.on("join", ({ name, room, newRoom }, callback) => {
    socket.roomname = room;

    // Create room if newRoom is true
    if (newRoom) {
      const error = createRoom({ id: socket.id, name, room });
      if (error) return callback(error);
      callback();
    }

    // Add socket to specified room
    const { user, error } = joinRoom({ id: socket.id, name, room });
    if (error) return callback(error);
    socket.join(user.room);

    // Emit data back to client
    const r = findRoom(room);
    io.to(user.room).emit("players", { players: getUserInRoom(user.room) });
    io.to(user.room).emit("roomdata", { room: r[0], id: socket.id });
    callback();

    if (r[0].active) {
      const gamestate = getRoom({ room });
      const chat = getChatroom({ room })
      io.to(room).emit("gamestart", { gamestate });
      io.to(room).emit("gamestate", { gamestate });
      io.to(room).emit("chatbox", { chat });
    }
  });

  //SOCKET GAME LOGIC
  socket.on("startgame", ({ room }) => {
    const gamestate = getRoom({ room });
    io.to(room).emit("gamestart", { gamestate });
  });

  socket.on("readyplayer", ({gamestate}) => {
    let r = true;
    gamestate.players.forEach(function(user){
      if (!user.ready){
        r = false;
      }
    })
    if (r){
      const state = rollDice({room: gamestate.roomId});
      io.to(gamestate.roomId).emit("newgamestate", ({gamestate:state}));
    }else{
      io.to(gamestate.roomId).emit("gamestate", ({gamestate}));
    }
  })

  socket.on("bet", ({ room, id, amount, animal }) => {
    const gamestate = addBet({ room, id, amount, animal });
    io.to(room).emit("gamestate", { gamestate });
  });

  //SOCKET CHAT
  socket.on("sendMessage", ({name, message}) => {
    const chat = addMessage({room:socket.roomname, name, message});
    io.to(socket.roomname).emit("chatbox", ({chat}));
  })

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
