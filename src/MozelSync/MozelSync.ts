import Mozel, {Data} from "../Mozel";
import PropertyWatcher from "../PropertyWatcher";
import {alphanumeric} from "validation-kit";
import {forEach, isNumber, throttle} from "../utils";
import {callback} from "event-interface-mixin";
import {v4 as uuid} from "uuid";
import Collection from "../Collection";
import Registry from "../Registry";
import Log from "../log";

const log = Log.instance("mozel-sync");

export type Changes = Record<alphanumeric, Data>;

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
	public readonly cleanUpThrottle:number;

	private active = false;
	priority:number;

	constructor(options?:{registry?:Registry<Mozel>, priority?:number, cleanUpThrottle?:number}) {
		const $options = options || {};
		this.priority = $options.priority || 0;
		this.cleanUpThrottle = isNumber($options.cleanUpThrottle) ? $options.cleanUpThrottle : 5000;

		if($options.registry) this.syncRegistry($options.registry);
	}

	createUpdates() {
		const updates:Record<alphanumeric, Update> = {};
		forEach(this.watchers, watcher => {
			const update = watcher.createUpdate();
			if(!update) return;

			updates[watcher.mozel.gid] = update;
		});
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
		const watcher = new MozelWatcher(this, mozel);
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

export type Update = {
	syncID:string;
	version:number;
	priority:number;
	baseVersion:number;
	changes:Record<string, any>;
}
export class MozelWatcher {
	readonly mozel:Mozel;

	private watchers:PropertyWatcher[] = [];
	private _changes:Record<string, any> = {};
	get changes() {
		return this._changes;
	}
	private version:number = 0;
	private history:Update[] = [];
	private readonly sync:MozelSync;
	private lowestBaseVersion = 0;

	/**
	 * A map of other MozelSyncs and the highest version received from them.
	 * @private
	 */
	private syncBaseVersions:Record<string, number> = {};

	onDestroyed = ()=>this.destroy();
	throttledAutoCleanHistory:()=>void;

	constructor(sync:MozelSync, mozel:Mozel) {
		this.mozel = mozel;
		this.mozel.$events.destroyed.on(this.onDestroyed);
		this.sync = sync;
		this.throttledAutoCleanHistory = throttle(
			()=>this.autoCleanHistory(),
			this.sync.cleanUpThrottle
		);
	}

	/*
			Priority: 1										Priority: 2
			{b: 0, foo: 'a'}								{b: 0, foo: 'a'}
			{b: 1, foo: 'b'}		{b: 0, foo: 'b', v: 1}>	{b: 0, foo: 'x'}
			{b: 1, foo: 'b'} x<{b: 0, foo: 'x', v: 1}		{b: 1, foo: 'b'}
			{b: 1, foo: 'b'}								{b: 1, foo: 'b'}
	 */

	applyUpdate(update:Update) {
		if(update.baseVersion < this.lowestBaseVersion) {
			log.error(`Received update has a base version (${update.baseVersion}) that is lower than any update kept in history (${this.lowestBaseVersion}). Cannot apply.`);
			return;
		}
		const changes = this.overrideChangesFromHistory(update);

		this.mozel.$setData(changes, true);
		this.history.push(update);
		this.version = Math.max(update.version, this.version);
		this.syncBaseVersions[update.syncID] = update.baseVersion;
		this.autoCleanHistory();
	}

	overrideChangesFromHistory(update:Update) {
		let changes = {...update.changes};
		this.history.forEach(history => {
			// Any update with a higher base version than the received update should override the received update
			if(history.baseVersion > update.baseVersion
				|| (this.sync.priority > update.priority && history.baseVersion >= update.baseVersion)) {
				changes = this.removeChanges(changes, history.changes);
			}
		});
		// Also resolve current conflicting changes
		if(this.version > update.baseVersion
			|| (this.sync.priority > update.priority && this.version >= update.baseVersion)) {
			changes = this.removeChanges(changes, this.changes);
		}
		return changes;
	}

	removeChanges(changes:Changes, override:Changes) {
		changes = {...changes};
		forEach(override, (_, key) => {
			delete changes[key];
		});
		return changes;
	}

	clearChanges() {
		this._changes = {};
	}

	getLowestVersionInHistory() {
		let lowest:number|null = null;
		forEach(this.syncBaseVersions, version => {
			if(lowest === null || version < lowest) lowest = version;
		});
		return lowest || 0;
	}

	getHistory() {
		return [...this.history];
	}

	autoCleanHistory() {
		this.clearHistory(this.getLowestVersionInHistory());
	}

	clearHistory(fromBaseVersion?:number) {
		if(!isNumber(fromBaseVersion)) {
			this.history = [];
			return;
		}
		let lowest:number|null = null;
		this.history = this.history.filter(update => {
			if(update.baseVersion <= fromBaseVersion) return false;

			if(lowest === null || update.baseVersion < lowest) lowest = update.baseVersion;
			return true;
		});
		this.lowestBaseVersion = lowest || 0;
	}

	createUpdate() {
		const update:Update = {
			syncID: this.sync.id,
			version: this.version+1,
			baseVersion: this.version,
			priority: this.sync.priority,
			changes: {}
		};
		forEach(this.changes, (change, key) => {
			if(change instanceof Mozel) {
				update.changes[key] = change.$export({keys: ['gid']});
				return;
			}
			if(change instanceof Collection) {
				update.changes[key] = change.export({keys: ['gid']});
				return;
			}
			update.changes[key] = change;
		});
		if(!Object.keys(update.changes).length) {
			return;
		}
		this.version = update.version;
		this.history.push(update);
		this.clearChanges();
		return update;
	}

	getSyncVersions() {
		return {...this.syncBaseVersions};
	}

	start(includeCurrentState = false) {
		this.watchers.push(this.mozel.$watch('*', change => {
			this._changes[change.changePath] = this.mozel.$path(change.changePath);
		}));
		// Watch collection changes
		this.mozel.$eachProperty(property => {
			if(!property.isCollectionType()) return;
			this.watchers.push(this.mozel.$watch(`${property.name}.*`, change => {
				this._changes[property.name] = this.mozel.$get(property.name);
			}));
		});
		if(includeCurrentState) {
			this._changes = this.mozel.$export({shallow: true, nonDefault: true});
		}
	}

	stop() {
		for(let watcher of this.watchers) {
			this.mozel.$removeWatcher(watcher);
		}
	}

	destroy() {
		this.stop();
		this.mozel.$events.destroyed.off(this.onDestroyed);
	}
}
