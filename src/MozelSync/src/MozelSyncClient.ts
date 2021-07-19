import {io, Socket} from "socket.io-client"
import Log from "../log";
import {isNumber, mapValues} from "../../utils";
import MozelSync from "./MozelSync";

const log = Log.instance("mozel-sync-client");

export default class MozelSyncClient {
	readonly io:Socket;
	readonly isDefaultIO:boolean;
	readonly sync:MozelSync;

	private connecting = {resolve:(id:string)=>{}, reject:(err:Error)=>{}};
	private destroyCallbacks:Function[];

	constructor(sync?:MozelSync, socket?:Socket|number) {
		this.sync = sync || new MozelSync();
		this.isDefaultIO = !socket;
		if(socket instanceof Socket) {
			this.io = socket;
		} else {
			const port = isNumber(socket) ? socket : 3000;
			this.io = io(`http://localhost:${port}`);
		}

		this.destroyCallbacks = [];

		this.initIO();
	}

	initIO() {
		this.io.on('connection', event => {
			this.sync.id = event.id;
			this.connecting.resolve(event.id);
			this.onConnected(event.id);
		});
		this.io.on('error', error => {
			this.connecting.reject(error);
		})
		this.io.on('push', commits => {
			log.debug(`-----------------\nCLIENT UPDATES IN (${this.sync.id}):`, mapValues(commits, update => update.changes));
			this.sync.merge(commits);
		});
		this.io.on('full-state', state => {
			this.sync.merge(state);
		});
		this.destroyCallbacks.push(
			this.sync.events.newCommits.on(event => {
				log.debug(`-----------------\nCLIENT UPDATES OUT (${this.sync.id}):`, mapValues(event.updates, update => update.changes));
				this.io.emit('push', event.updates);
			})
		);
	}

	async start() {
		this.sync.start();
		await this.connect();
		log.info("MozelSyncClient started.");
	}

	connect() {
		this.io.connect();
		return new Promise((resolve, reject) => {
			log.info("MozelSyncClient connected.");
			this.connecting.resolve = resolve;
			this.connecting.reject = reject;
		});
	}

	disconnect() {
		this.io.disconnect();
		this.onDisconnected(this.sync.id);
	}

	onConnected(id:string) {
		// For override
	}

	onDisconnected(id:string) {

	}

	destroy() {
		this.onDestroy();
	}

	onDestroy() {

	}
}
