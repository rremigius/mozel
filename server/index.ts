import {Server} from "socket.io";

const io = new Server();

io.on('connection', (socket) => {
	io.emit('connection');
	socket.on('test', console.warn);
	console.log("CONNECTED");
});
io.on('test', console.log);

io.listen(3000);
