import {Server, Socket} from "socket.io";
import MozelSync from "./MozelSync";

export default class MozelSyncServer {
	readonly io:Server;
	readonly sync:MozelSync;

	private connections:Record<string, Socket> = {};

	constructor(sync:MozelSync) {
		this.io = new Server();
		this.sync = sync;
	}

	start() {
		this.io.on('connection', (socket) => {
			this.createUser(socket.id, socket)
		});
	}

	createUser(id:string, socket:Socket) {
		this.connections[id] = socket;
		this.onUserConnected();
	}

	onUserConnected() {

	}
}
