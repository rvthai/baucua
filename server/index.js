const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const port = 9000;

io.on('connection', (socket) => {
    console.log(socket.id + ' has just connected');

    socket.on('join', (name, room) => {
        console.log(name + ' has join room ' + room);
    })

    socket.on('disconnect', () => {
        console.log('User had left');
    })

});

app.get('/', (req, res) => res.send('Hello World!'));

http.listen(9000, () => {
    console.log('listening on *:9000');
});

