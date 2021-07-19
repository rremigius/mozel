import {io, Socket} from "socket.io-client"
import Log from "../log";
import {call, isNumber, mapValues} from "../../utils";
import MozelSync from "./MozelSync";
import Mozel from "../../Mozel";

const log = Log.instance("mozel-sync-client");

export default class MozelSyncClient {
	readonly io:Socket;
	readonly isDefaultIO:boolean;
	readonly sync:MozelSync;

	private connecting = {resolve:(id:string)=>{}, reject:(err:Error)=>{}};
	private destroyCallbacks:Function[];

	constructor(options?:{model?:Mozel, sync?:MozelSync, socket?:Socket|number}) {
		const $options = options || {};

		let sync = $options.sync;
		if(!sync) {
			sync = new MozelSync({autoCommit: 100});
			if($options.model) {
				sync.syncRegistry($options.model.$registry);
			}
		} else if ($options.model) {
			sync.register($options.model);
		}
		this.sync = sync;

		let socket = $options.socket;
		if(socket instanceof Socket) {
			this.io = socket;
			this.isDefaultIO = false;
		} else {
			const port = isNumber(socket) ? socket : 3000;
			this.io = io(`http://localhost:${port}`);
			this.isDefaultIO = true;
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
			this.sync.merge(commits);
		});
		this.io.on('full-state', state => {
			this.sync.merge(state);
		});
		this.destroyCallbacks.push(
			this.sync.events.newCommits.on(event => {
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
		this.destroyCallbacks.forEach(call);
		this.onDestroy();
	}

	onDestroy() {

	}
}
