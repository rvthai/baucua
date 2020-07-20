const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const {createRoom, joinRoom, getUserInRoom, removeUser, findRoom} = require('./room');

const port = 9000;

io.on('connection', (socket) => {
    console.log(socket.id + ' has just connected');

    socket.on('join', ({name, room, host}, callback) => {
        if (host){
            const {user,error} = createRoom({id:socket.id, name, room});
            if (error) return callback(error);
            socket.join(user.room);

            io.to(user.room).emit("roomdata", {users:getUserInRoom(user.room)} );
            
            callback();
        }else{
            const {user,error} = joinRoom({id:socket.id, name, room});
            if (error) return callback(error);
            socket.join(user.room);

            io.to(user.room).emit("roomdata", {users:getUserInRoom(user.room)} );
            
            callback();
        }
    })

    socket.on("startgame", ({room}) => {
        io.to(room).emit("gamestart");
    })


    socket.on("leaveroom", ({id, room})=>{
        const user = removeUser({id, room});
        if (user){
            io.to(user.room).emit("roomdata",{users: getUserInRoom(user.room)});
            const r = findRoom(room);
            if (r.length !== 0){
                const newHost = r[0].players[0];
                io.to(newHost.room).emit("newhost");
            }
        }
    })

    socket.on('disconnect', () => {
        console.log('User had left');
    })

});

app.get('/', (req, res) => res.send('Hello World!'));

http.listen(9000, () => {
    console.log('listening on *:9000');
});

