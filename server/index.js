const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const port = 9000;

io.on('connection', (socket) => {
    console.log('a user connected');
});

app.get('/', (req, res) => res.send('Hello World!'));

http.listen(9000, () => {
    console.log('listening on *:9000');
});

