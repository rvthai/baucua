const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
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
    rollDice} = require('./room');

const port = 9000;

io.on('connection', (socket) => {
    console.log(socket.id + ' has just connected');
    
    //SOCKET JOIN
    socket.on('join', ({name, room, host}, callback) => {
        if (host){
            socket.roomname = room;
            const {user,error} = createRoom({id:socket.id, name, room});
            if (error) return callback(error);
            socket.join(user.room);
            io.to(user.room).emit("roomdata", {users:getUserInRoom(user.room)} );
            
            callback();
        }else{
            socket.roomname = room;
            const {user,error} = joinRoom({id:socket.id, name, room});
            if (error) return callback(error);
            socket.join(user.room);

            io.to(user.room).emit("roomdata", {users:getUserInRoom(user.room)} );
            
            callback();
        }
        if (findRoom(room)[0].active){
            const gamestate = getRoom({room})
            io.to(room).emit("gamestart", ({gamestate}));
            io.to(room).emit("gamestate", ({gamestate}));
        }
    })

    //SOCKET GAME LOGIC
    socket.on("startgame", ({room}) => {
        const gamestate = getRoom({room})
        io.to(room).emit("gamestart", ({gamestate}));
    })

    socket.on('roll', ({room}) => {
        const gamestate = rollDice({room});
        io.to(room).emit("gamestate", ({gamestate}));
        io.to(room).emit("roll");
    })

    socket.on("bet", ({room, id, amount, animal}) => {
        const gamestate = addBet({room, id, amount, animal});
        io.to(room).emit("gamestate", ({gamestate}));
    })

    socket.on('disconnect', () => {
        console.log(socket.id + ' had left');
        //anytime for any reason if a socket disconnects the code below will remove that player
        //from the gameroom
        const user = removeUser({id:socket.id, room:socket.roomname});
        if (user){
            io.to(user.room).emit("roomdata",{users: getUserInRoom(user.room)});
            const r = findRoom(user.room);
            const gamestate = getRoom({room:user.room})
            if (r.length !== 0){
                const newHost = r[0].players[0];
                io.to(newHost.room).emit("gamestate", ({gamestate}));
                io.to(newHost.room).emit("newhost");
            }
        }
    })
});


http.listen(9000, () => {
    console.log('listening on *:9000');
});

