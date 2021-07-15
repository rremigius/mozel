import Mozel, {Data} from "./Mozel";
import PropertyWatcher from "./PropertyWatcher";
import {alphanumeric} from "validation-kit";
import {forEach, isNumber} from "./utils";
import {callback} from "event-interface-mixin";
import {Collection, Registry} from "./index";

export type Changes = Record<alphanumeric, Data>;

export default class MozelSync {
	mozels:Record<alphanumeric, Mozel> = {};
	watchers:Record<alphanumeric, MozelWatcher> = {};
	listeners:Record<alphanumeric, callback<any>[]> = {};
	registryListeners:callback<any>[] = [];
	registry?:Registry<Mozel>;

	active = false;
	priority;

	constructor(options?:{registry?:Registry<Mozel>, priority?:number}) {
		if(!options) return;
		this.priority = isNumber(options.priority) ? options.priority : 0;

		if(options.registry) this.syncRegistry(options.registry);
	}

	createUpdates() {
		const updates:Record<alphanumeric, Update> = {};
		forEach(this.watchers, watcher => {
			const update = watcher.createUpdate();
			if(!Object.keys(update.changes).length) return; // no empty changes

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

	clearChanges() {
		forEach(this.watchers, watcher => watcher.clearChanges());
	}

	register(mozel:Mozel) {
		this.mozels[mozel.gid] = mozel;
		const watcher = new MozelWatcher(mozel, this.priority);
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

	priority:number;

	onDestroyed = ()=>this.destroy();

	constructor(mozel:Mozel, priority = 0) {
		this.mozel = mozel;
		this.mozel.$events.destroyed.on(this.onDestroyed);
		this.priority = priority;
	}

	/*
			Priority: 1										Priority: 2
			{b: 0, foo: 'a'}								{b: 0, foo: 'a'}
			{b: 1, foo: 'b'}		{b: 0, foo: 'b', v: 1}>	{b: 0, foo: 'x'}
			{b: 1, foo: 'b'} x<{b: 0, foo: 'x', v: 1}		{b: 1, foo: 'b'}
			{b: 1, foo: 'b'}								{b: 1, foo: 'b'}
	 */

	applyUpdate(update:Update) {
		const changes = this.overrideChangesFromHistory(update);

		this.mozel.$setData(changes, true);
		this.version = update.version;
		this.history.push(update);
	}

	overrideChangesFromHistory(update:Update) {
		let changes = {...update.changes};
		this.history.forEach(history => {
			// Any update with a higher base version than the received update should override the received update
			if(history.baseVersion > update.baseVersion
				|| (this.priority > update.priority && history.baseVersion >= update.baseVersion)) {
				changes = this.removeChanges(changes, history.changes);
			}
		});
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

	createUpdate() {
		const update:Update = {
			version: this.version+1,
			baseVersion: this.version,
			priority: this.priority,
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
		this.history.push(update);
		this.clearChanges();
		return update;
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
