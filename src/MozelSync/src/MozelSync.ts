import {alphanumeric} from "validation-kit";
import EventInterface, {callback} from "event-interface-mixin";
import {v4 as uuid} from "uuid";
import Log from "../log";
import {MozelWatcher, Update} from "./MozelWatcher";
import {forEach, isNumber} from "../../utils";
import Mozel, {Data} from "../../Mozel";
import Registry from "../../Registry";

const log = Log.instance("mozel-sync");

export type Changes = Record<alphanumeric, Data>;
export class OutdatedUpdateError extends Error {
	constructor(public baseVersion:number, public requiredVersion:number) {
		super(`Received update has a base version (${baseVersion}) that is lower than any update kept in history (${requiredVersion}). Cannot apply update.`);
	}
}

export class MozelSyncNewUpdatesEvent {
	constructor(public updates:Record<alphanumeric, Update>) {}
}
export class MozelSyncEvents extends EventInterface {
	newUpdates = this.$event(MozelSyncNewUpdatesEvent);
}

export default class MozelSync {
	protected _id = uuid();
	get id() {
		return this._id;
	}

	private mozels:Record<alphanumeric, Mozel> = {};
	private watchers:Record<alphanumeric, MozelWatcher> = {};
	private listeners:Record<alphanumeric, callback<any>[]> = {};
	private registryListeners:callback<any>[] = [];
	private registry?:Registry<Mozel>;
	public readonly historyLength:number;

	private active = false;
	priority:number;

	public readonly events = new MozelSyncEvents();

	constructor(options?:{registry?:Registry<Mozel>, priority?:number, historyLength?:number}) {
		const $options = options || {};
		this.priority = $options.priority || 0;
		this.historyLength = isNumber($options.historyLength) ? $options.historyLength : 20;

		if($options.registry) this.syncRegistry($options.registry);
	}

	createUpdates() {
		const updates:Record<alphanumeric, Update> = {};
		forEach(this.watchers, watcher => {
			const update = watcher.createUpdate();
			if(!update) return;

			updates[watcher.mozel.gid] = update;
		});
		this.events.newUpdates.fire(new MozelSyncNewUpdatesEvent(updates));
		return updates;
	}

	applyUpdates(updates:Record<alphanumeric, Update>) {
		forEach(updates, (update, gid) => {
			const watcher = this.watchers[gid];
			if(!watcher) return;

			watcher.applyUpdate(update);
		});
	}

	getWatcher(gid:alphanumeric) {
		return this.watchers[gid];
	}

	register(mozel:Mozel) {
		this.mozels[mozel.gid] = mozel;
		const watcher = new MozelWatcher(mozel, {
			syncID: this.id,
			priority: this.priority,
			historyLength: this.historyLength
		});
		this.watchers[mozel.gid] = watcher;
		this.listeners[mozel.gid] = [
			mozel.$events.destroyed.on(()=>this.unregister(mozel))
		];
		if(this.active) watcher.start(true);
	}

	unregister(mozel:Mozel) {
		if(!(mozel.gid in this.watchers)) return;

		this.watchers[mozel.gid].destroy();
		delete this.watchers[mozel.gid];
		delete this.mozels[mozel.gid];
		mozel.$events.$offAll(this.listeners[mozel.gid]);
	}

	has(mozel:Mozel) {
		return !!this.mozels[mozel.gid];
	}

	syncRegistry(registry:Registry<Mozel>) {
		this.registryListeners = [
			registry.events.added.on(event => this.register(event.item as Mozel)),
			registry.events.removed.on(event => this.unregister(event.item as Mozel))
		]
		// Also register current Mozels
		registry.all().forEach(mozel => this.register(mozel));
	}

	start() {
		this.active = true;
		forEach(this.watchers, watcher => watcher.start());
	}

	stop() {
		this.active = false;
		forEach(this.watchers, watcher => watcher.stop());
	}

	destroy() {
		forEach(this.watchers, watcher => this.unregister(watcher.mozel));
		if(this.registry) {
			this.registry.events.$offAll(this.registryListeners);
		}
	}
}
