import {v4 as uuid} from "uuid";
import PropertyWatcher from "../../PropertyWatcher";
import {forEach, mapValues, values} from "../../utils";
import Mozel, {shallow} from "../../Mozel";
import Collection from "../../Collection";
import EventInterface from "event-interface-mixin";
import Log from "log-control";
import {alphanumeric} from "validation-kit";

const log = Log.instance("mozel-watcher");

export type Changes = Record<string, any>
export class OutdatedUpdateError extends Error {
	constructor(public baseVersion:number, public requiredVersion:number) {
		super(`Received update has a base version (${baseVersion}) that is lower than any update kept in history (${requiredVersion}). Cannot apply update.`);
	}
}
export type Update = {
	syncID:string;
	version:number;
	priority:number;
	baseVersion:number;
	changes:Changes;
}

export class MozelWatcherChangedEvent {
	constructor(public changePath:string) {}
}
export class MozelWatcherEvents extends EventInterface {
	changed = this.$event(MozelWatcherChangedEvent);
}
export class MozelWatcher {
	readonly mozel:Mozel;

	private watchers:PropertyWatcher[] = [];
	private _changes:Changes = {};
	get changes() {
		return this._changes;
	}
	private _newMozels:Set<alphanumeric> = new Set<alphanumeric>();

	private priority:number;
	private version:number = 0;
	private historyMaxLength:number;
	private history:Update[] = [];
	get historyMinBaseVersion() {
		return !this.history.length ? 0 : this.history[0].baseVersion;
	}

	public syncID:string;
	public readonly events = new MozelWatcherEvents();

	private isNewMozel:(mozel:Mozel)=>boolean;
	private onDestroyed = ()=>this.destroy();

	/**
	 *
	 * @param mozel
	 * @param options
	 * 			options.asNewMozel	Function to check whether a Mozel property is new and should be included in full
	 */
	constructor(mozel:Mozel, options?:{syncID?:string, priority?:number, historyLength?:number, asNewMozel?:(mozel:Mozel)=>boolean}) {
		const $options = options || {};
		this.mozel = mozel;
		this.mozel.$events.destroyed.on(this.onDestroyed);
		this.syncID = $options.syncID || uuid();
		this.historyMaxLength = $options.historyLength || 20;
		this.priority = $options.priority || 0;
		this.isNewMozel = $options.asNewMozel || (()=>false);
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

	createUpdateInfo():Update {
		return {
			syncID: this.syncID,
			version: this.version,
			baseVersion: this.version,
			priority: this.priority,
			changes: {}
		};
	}

	createFullUpdate() {
		const update = this.createUpdateInfo();
		update.changes = this.mozel.$export({shallow});
		return update;
	}

	createUpdate(newVersion:boolean = false) {
		const update = this.createUpdateInfo();
		if(newVersion) update.version++;
		forEach(this.changes, (change, key) => {
			if(change instanceof Mozel) {
				// New mozels we include in full; existing mozels only gid
				const options = this.isNewMozel(change) ? undefined : {keys: ['gid']};
				update.changes[key] = change.$export(options);
				return;
			}
			if(change instanceof Collection) {
				if(change.isMozelType()) {
					update.changes[key] = change.map(mozel => {
						// New mozels we include in full; existing mozels only gid
						const options = this.isNewMozel(mozel) ? undefined : {keys: ['gid']};
						return mozel.$export(options);
					});
					return;
				}
				update.changes[key] = change.export();
				return;
			}
			update.changes[key] = change;
		});
		if(!Object.keys(update.changes).length) {
			return;
		}
		this.version = update.version;

		if(newVersion) {
			this.history.push(update);
			this.clearChanges();
		}
		return update;
	}

	start(includeCurrentState = false) {
		this.watchers.push(this.mozel.$watch('*', change => {
			this._changes[change.changePath] = this.mozel.$path(change.changePath);
			this.events.changed.fire(new MozelWatcherChangedEvent(change.changePath));
		}));
		// Watch collection changes
		this.mozel.$eachProperty(property => {
			if(!property.isCollectionType()) return;
			this.watchers.push(this.mozel.$watch(`${property.name}.*`, change => {
				this._changes[property.name] = this.mozel.$get(property.name);
				this.events.changed.fire(new MozelWatcherChangedEvent(change.changePath));
			}));
		});
		if(includeCurrentState) {
			this._changes = this.mozel.$export({shallow: true, nonDefault: true});
			this.events.changed.fire(new MozelWatcherChangedEvent("*"));
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
