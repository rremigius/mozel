import {Server, Socket} from "socket.io";
import MozelSync from "./MozelSync";
import Log from "../log";

const log = Log.instance("mozel-sync-server");

export default class MozelSyncServer {
	readonly io:Server;
	readonly isDefaultIO:boolean;
	readonly defaultIOPort:number;
	readonly sync:MozelSync;

	private connections:Record<string, Socket> = {};

	constructor(sync?:MozelSync, io?:Server|number) {
		this.sync = sync || new MozelSync();
		this.defaultIOPort = 3000;

		if(io instanceof Server) {
			this.io = io;
			this.isDefaultIO = false;
		} else {
			this.io = new Server();
			this.isDefaultIO = true;
			this.defaultIOPort = io || 3000;
		}
	}

	start() {
		log.info("MozelSyncServer started.");
		this.io.on('connection', (socket) => {
			this.createUser(socket.id, socket)
			socket.on('disconnect', () => {
				this.removeUser(socket.id);
			})
		});
		if(this.isDefaultIO) {
			this.io.listen(3000);
		}
	}

	createUser(id:string, socket:Socket) {
		this.connections[id] = socket;
		this.onUserConnected(id);
	}

	removeUser(id:string) {
		delete this.connections[id];
		this.onUserDisconnected(id);
	}

	onUserConnected(id:string) {
		// For overide
	}

	onUserDisconnected(id:string) {

	}
}
