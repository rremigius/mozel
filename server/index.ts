import {Server} from "socket.io";

const io = new Server();

io.on('connection', () => {
	console.log("CONNECTED");
});

io.listen(3000);
