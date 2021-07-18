import {alphanumeric} from "validation-kit";
import EventInterface, {callback} from "event-interface-mixin";
import {v4 as uuid} from "uuid";
import Log from "../log";
import {MozelWatcher, Update} from "./MozelWatcher";
import {call, find, findAllDeep, findDeep, forEach, isNumber, isPlainObject, mapValues, throttle} from "../../utils";
import Mozel from "../../Mozel";
import Registry from "../../Registry";

const log = Log.instance("mozel-sync");

export class MozelSyncNewUpdatesEvent {
	constructor(public updates:Record<string, Update>) {}
}
export class MozelSyncEvents extends EventInterface {
	newUpdates = this.$event(MozelSyncNewUpdatesEvent);
}

export default class MozelSync {
	private _id = uuid();
	get id() { return this._id; }
	set id(value) {
		this._id = value;
		forEach(this.watchers, watcher => watcher.syncID = this._id)
	}

	private _autoUpdate?:number;
	public get autoUpdate() { return this._autoUpdate }
	public set autoUpdate(value) {
		this._autoUpdate = value;
		this._createNewUpdatesThrottled = throttle(()=>this.createUpdates(true), this._autoUpdate, {leading: false});
	}
	private _createNewUpdatesThrottled = ()=>{};
	public get createNewUpdatesThrottled() {
		return this._createNewUpdatesThrottled;
	};

	private mozels:Record<alphanumeric, Mozel> = {};
	private newPropertyMozels:Set<alphanumeric> = new Set<alphanumeric>();
	private watchers:Record<alphanumeric, MozelWatcher> = {};
	private unRegisterCallbacks:Record<alphanumeric, Function[]> = {};
	private destroyCallbacks:Function[] = [];
	private registry?:Registry<Mozel>;
	public readonly historyLength:number;
	private lastUpdates:Record<string, Update> = {};

	private active:boolean = false;
	priority:number;

	public readonly events = new MozelSyncEvents();

	constructor(options?:{registry?:Registry<Mozel>, priority?:number, historyLength?:number, autoUpdate?:number}) {
		const $options = options || {};
		this.priority = $options.priority || 0;
		this.historyLength = isNumber($options.historyLength) ? $options.historyLength : 20;

		this.autoUpdate = $options.autoUpdate;

		if($options.registry) this.syncRegistry($options.registry);
	}

	createFullUpdates() {
		return mapValues(this.watchers, watcher => watcher.createFullUpdate());
	}

	hasUpdates() {
		return !!find(this.watchers, watcher => watcher.hasUpdate());
	}

	createUpdates(newVersion:boolean = false) {
		const updates:Record<alphanumeric, Update> = {};
		forEach(this.watchers, watcher => {
			const update = watcher.createUpdate(newVersion);
			if(!update) return;

			updates[watcher.mozel.gid] = update;
		});
		if(newVersion) {
			this.newPropertyMozels.clear();
			this.events.newUpdates.fire(new MozelSyncNewUpdatesEvent(updates));
		}
		return updates;
	}

	applyUpdates(updates:Record<alphanumeric, Update>) {
		/*
		We are not sure in which order updates should be applied: the Mozel may not have been created yet before
		we want to set its data. So we delay setting data and try again next loop, until we finish the queue or it will
		not get smaller.
		 */
		let queue:(Update & {gid:alphanumeric})[] = [];
		forEach(updates, (update, gid) => {
			queue.push({gid, ...update});
		});

		while(Object.keys(queue).length) {
			let newQueue:(Update & {gid:alphanumeric})[] = [];
			for(let update of queue) {
				const watcher = this.watchers[update.gid];
				if(!watcher) {
					newQueue.push(update);
					continue;
				}
				watcher.applyUpdate(update);
			}
			if(newQueue.length === queue.length) break; // no more progress
			queue = newQueue;
		}
	}

	getWatcher(gid:alphanumeric) {
		return this.watchers[gid];
	}

	register(mozel:Mozel) {
		const watcher = new MozelWatcher(mozel, {
			syncID: this.id,
			priority: this.priority,
			historyLength: this.historyLength
		});
		this.mozels[mozel.gid] = mozel;
		if(!mozel.$root) this.newPropertyMozels.add(mozel.gid);

		this.watchers[mozel.gid] = watcher;
		this.unRegisterCallbacks[mozel.gid] = [
			mozel.$events.destroyed.on(()=>this.unregister(mozel)),
			watcher.events.changed.on(()=>{
				if(isNumber(this.autoUpdate)) this.createNewUpdatesThrottled();
			})
		];
		if(this.active) watcher.start();
	}

	unregister(mozel:Mozel) {
		if(!(mozel.gid in this.watchers)) return;

		this.watchers[mozel.gid].destroy();
		delete this.watchers[mozel.gid];
		delete this.mozels[mozel.gid];
		this.newPropertyMozels.delete(mozel.gid);
		this.unRegisterCallbacks[mozel.gid].forEach(call);
	}

	has(mozel:Mozel) {
		return !!this.mozels[mozel.gid];
	}

	syncRegistry(registry:Registry<Mozel>) {
		if(this.registry) throw new Error("Cannot switch Registry for MozelSync.");

		this.registry = registry;
		this.destroyCallbacks = [
			...this.destroyCallbacks,
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
		this.destroyCallbacks.forEach(call);
	}
}
