import {v4 as uuid} from "uuid";
import {Changes, OutdatedUpdateError} from "./MozelSync";
import PropertyWatcher from "../../PropertyWatcher";
import {forEach} from "../../utils";
import Mozel from "../../Mozel";
import Collection from "../../Collection";

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
	private priority:number;
	private version:number = 0;
	private historyMaxLength:number;
	private history:Update[] = [];
	get historyMinBaseVersion() {
		return !this.history.length ? 0 : this.history[0].baseVersion;
	}

	private readonly syncID:string;

	onDestroyed = ()=>this.destroy();

	constructor(mozel:Mozel, options?:{syncID?:string, priority?:number, historyLength?:number}) {
		const $options = options || {};
		this.mozel = mozel;
		this.mozel.$events.destroyed.on(this.onDestroyed);
		this.syncID = $options.syncID || uuid();
		this.historyMaxLength = $options.historyLength || 20;
		this.priority = $options.priority || 0;
	}

	/*
			Priority: 1										Priority: 2
			{b: 0, foo: 'a'}								{b: 0, foo: 'a'}
			{b: 1, foo: 'b'}		{b: 0, foo: 'b', v: 1}>	{b: 0, foo: 'x'}
			{b: 1, foo: 'b'} x<{b: 0, foo: 'x', v: 1}		{b: 1, foo: 'b'}
			{b: 1, foo: 'b'}								{b: 1, foo: 'b'}
	 */

	applyUpdate(update:Update) {
		if(update.baseVersion < this.historyMinBaseVersion) {
			throw new OutdatedUpdateError(update.baseVersion, this.historyMinBaseVersion);
		}
		const changes = this.overrideChangesFromHistory(update);

		this.mozel.$setData(changes, true);
		this.history.push(update);
		this.version = Math.max(update.version, this.version);
		this.autoCleanHistory();
	}

	overrideChangesFromHistory(update:Update) {
		let changes = {...update.changes};
		this.history.forEach(history => {
			// Any update with a higher base version than the received update should override the received update
			if(history.baseVersion + this.priority > update.baseVersion + update.priority) {
				changes = this.removeChanges(changes, history.changes);
			}
		});
		// Also resolve current conflicting changes
		if(this.version + this.priority > update.baseVersion + update.priority) {
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

	getHistory() {
		return [...this.history];
	}

	autoCleanHistory() {
		if(this.history.length > this.historyMaxLength) {
			this.history.splice(0, this.history.length - this.historyMaxLength);
		}
	}

	createUpdate() {
		const update:Update = {
			syncID: this.syncID,
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
		if(!Object.keys(update.changes).length) {
			return;
		}
		this.version = update.version;
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
