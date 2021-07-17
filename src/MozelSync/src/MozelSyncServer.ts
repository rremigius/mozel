import {Server, Socket} from "socket.io";
import MozelSync from "./MozelSync";
import Log from "../log";
import {mapValues} from "../../utils";

const log = Log.instance("mozel-sync-server");

export default class MozelSyncServer {
	readonly io:Server;
	readonly isDefaultIO:boolean;
	readonly defaultIOPort:number;
	readonly sync:MozelSync;

	readonly destroyCallbacks:Function[] = [];

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
		this.sync.start();

		this.io.on('connection', (socket) => {
			this.initUser(socket.id, socket)
			socket.on('disconnect', () => {
				this.removeUser(socket.id);
			});
			// Listen to incoming updates
			socket.on('updates', updates => {
				log.debug("-----------------\nSERVER UPDATES IN:", mapValues(updates, update => update.changes));
				this.sync.applyUpdates(updates);
			});
		});

		if(this.isDefaultIO) {
			this.io.listen(3000);
		}

		this.destroyCallbacks.push(
			this.sync.events.newUpdates.on(event => {
				log.debug("-----------------\nSERVER UPDATES OUT:", mapValues(event.updates, update => update.changes));
				this.io.emit('updates', event.updates);
			})
		);

		log.info("MozelSyncServer started.");
	}

	stop() {
		this.io.close();
		this.sync.stop();
	}

	initUser(id:string, socket:Socket) {
		socket.emit('connection', {id: socket.id});
		socket.emit('updates', this.sync.createFullUpdates());
		this.onUserConnected(id);
	}

	removeUser(id:string) {
		this.onUserDisconnected(id);
	}

	onUserConnected(id:string) {
		// For overide
	}

	onUserDisconnected(id:string) {
		// For override
	}

	destroy() {
		this.destroyCallbacks.forEach(callback => callback());
	}
}
