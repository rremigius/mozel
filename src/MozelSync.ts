import Mozel, {Data} from "./Mozel";
import PropertyWatcher from "./PropertyWatcher";
import {alphanumeric} from "validation-kit";
import {forEach} from "./utils";
import {callback} from "event-interface-mixin";
import {Collection, Registry} from "./index";

export default class MozelSync {
	mozels:Record<alphanumeric, Mozel> = {};
	watchers:Record<alphanumeric, MozelWatcher> = {};
	listeners:Record<alphanumeric, callback<any>[]> = {};
	registryListeners:callback<any>[] = [];
	registry?:Registry<Mozel>;

	active = false;

	getChanges() {
		const changes:Record<alphanumeric, Data> = {};
		forEach(this.watchers, watcher => {
			const watcherChanges = watcher.exportChanges();
			if(!Object.keys(watcherChanges).length) return; // no empty changes

			changes[watcher.mozel.gid] = watcher.exportChanges();
		});
		return changes;
	}

	applyChanges(changes:Record<string, Data>) {
		forEach(changes, (data, gid) => {
			const mozel = this.mozels[gid];
			if(!mozel) return; // Mozel not known here

			mozel.$setData(data, true);
		});
	}

	clearChanges() {
		forEach(this.watchers, watcher => watcher.clearChanges());
	}

	register(mozel:Mozel) {
		this.mozels[mozel.gid] = mozel;
		const watcher = new MozelWatcher(mozel);
		this.watchers[mozel.gid] = watcher;
		this.listeners[mozel.gid] = [
			mozel.$events.destroyed.on(()=>this.unregister(mozel))
		];
		if(this.active) watcher.start();
	}

	unregister(mozel:Mozel) {
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

export class MozelWatcher {
	readonly mozel:Mozel;

	private watchers:PropertyWatcher[] = [];
	private _changes:Record<string, any> = {};
	get changes() {
		return this._changes;
	}
	onDestroyed = ()=>this.destroy();

	constructor(mozel:Mozel) {
		this.mozel = mozel;
		this.mozel.$events.destroyed.on(this.onDestroyed);
	}

	clearChanges() {
		this._changes = {};
	}

	exportChanges() {
		const exported:Record<string, any> = {};
		forEach(this.changes, (change, key) => {
			if(change instanceof Mozel) {
				exported[key] = change.$export();
				return;
			}
			if(change instanceof Collection) {
				exported[key] = change.export();
				return;
			}
			exported[key] = change;
		});
		return exported;
	}

	start() {
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
