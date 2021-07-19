import {v4 as uuid} from "uuid";
import PropertyWatcher from "../../PropertyWatcher";
import {call, findAllDeep, forEach, get, isArray, isEqual, isPlainObject, mapValues, values} from "../../utils";
import Mozel, {shallow} from "../../Mozel";
import Collection from "../../Collection";
import EventInterface from "event-interface-mixin";
import Log from "log-control";
import {alphanumeric, isPrimitive} from "validation-kit";

const log = Log.instance("mozel-watcher");

export type Changes = Record<string, any>
export class OutdatedUpdateError extends Error {
	constructor(public baseVersion:number, public requiredVersion:number) {
		super(`Received update has a base version (${baseVersion}) that is lower than any update kept in history (${requiredVersion}). Cannot apply update.`);
	}
}
export type Commit = {
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
	private newMozels:Set<alphanumeric> = new Set<alphanumeric>();
	private mozelsInUpdates:Set<alphanumeric> = new Set<alphanumeric>();
	private stopCallbacks:Function[] = [];

	private priority:number;
	private version:number = 0;
	private historyMaxLength:number;
	private history:Commit[] = [];
	get historyMinBaseVersion() {
		return !this.history.length ? 0 : this.history[0].baseVersion;
	}
	get lastUpdate():Commit|undefined {
		if(!this.history.length) return;
		return this.history[this.history.length-1];
	}

	public syncID:string;
	public readonly events = new MozelWatcherEvents();

	private onDestroyed = ()=>this.destroy();

	/**
	 *
	 * @param mozel
	 * @param options
	 * 			options.asNewMozel	Function to check whether a Mozel property is new and should be included in full
	 */
	constructor(mozel:Mozel, options?:{syncID?:string, priority?:number, historyLength?:number}) {
		const $options = options || {};
		this.mozel = mozel;
		this.mozel.$events.destroyed.on(this.onDestroyed);
		this.syncID = $options.syncID || uuid();
		this.historyMaxLength = $options.historyLength || 20;
		this.priority = $options.priority || 0;
	}

	isNewMozel(mozel:Mozel) {
		return this.newMozels.has(mozel.gid);
	}

	/*
			Priority: 1										Priority: 2
			{b: 0, foo: 'a'}								{b: 0, foo: 'a'}
			{b: 1, foo: 'b'}		{b: 0, foo: 'b', v: 1}>	{b: 0, foo: 'x'}
			{b: 1, foo: 'b'} x<{b: 0, foo: 'x', v: 1}		{b: 1, foo: 'b'}
			{b: 1, foo: 'b'}								{b: 1, foo: 'b'}
	 */

	/**
	 * Merges the update into the current Mozel.
	 * Returns the final update, with all overrides removed, and its own priority applied
	 * @param update
	 */
	merge(update:Commit):Commit {
		if(update.baseVersion < this.historyMinBaseVersion) {
			// We cannot apply changes from before our history, as it would overwrite anything already committed.
			throw new OutdatedUpdateError(update.baseVersion, this.historyMinBaseVersion);
		}
		const changes = this.overrideChangesFromHistory(update);
		const mozels = findAllDeep(changes, (value, key) => key === 'gid');
		mozels.map(mozel => this.mozelsInUpdates.add(mozel.gid));

		// Update version
		const version = Math.max(update.version, this.version);
		this.version = version;

		// Create merge commit, add to history and clean history
		const merged = {...update, changes, priority: this.priority, version};
		this.history.push(merged);
		this.autoCleanHistory();

		// Update Mozel
		this.mozel.$setData(changes, true);

		return merged;
	}

	overrideChangesFromHistory(update:Commit) {
		let changes = {...update.changes};
		const priorityAdvantage = this.priority > update.priority ? 1 : 0;

		this.history.forEach(history => {
			// Any update with a higher base version than the received update should override the received update
			if(history.baseVersion + priorityAdvantage > update.baseVersion) {
				changes = this.removeChanges(changes, history.changes);
			}
		});
		// Also resolve current conflicting changes
		if(this.version + priorityAdvantage > update.baseVersion) {
			changes = this.removeChanges(changes, this.changes);
		}
		return changes;
	}

	/**
	 *
	 * @param {Changes} changes
	 * @param {Changes} override
	 */
	removeChanges(changes:Changes, override:Changes) {
		changes = {...changes};
		forEach(override, (_, key) => {
			delete changes[key];
		});
		return changes;
	}

	clearChanges() {
		this._changes = {};
		this.newMozels.clear();
		this.mozelsInUpdates.clear();
	}

	getHistory() {
		return [...this.history];
	}

	autoCleanHistory() {
		if(this.history.length > this.historyMaxLength) {
			this.history.splice(0, this.history.length - this.historyMaxLength);
		}
	}

	hasChanges() {
		return Object.keys(this.changes).length > 0;
	}

	createUpdateInfo():Commit {
		return {
			syncID: this.syncID,
			version: this.version,
			baseVersion: this.version,
			priority: this.priority,
			changes: {}
		};
	}

	createFullState() {
		const update = this.createUpdateInfo();
		update.changes = this.mozel.$export({shallow});
		return update;
	}

	commit() {
		const update = this.createUpdateInfo();
		update.version++;
		forEach(this.changes, (change, key) => {
			if(change instanceof Mozel) {
				/*
				New mozels we include in full; existing mozels only gid
				If we don't include full export for new Mozels, data may be separated from property assignment
				and receiving MozelSync will not know what to do with the data
				*/
				const options = this.isNewMozel(change) ? undefined : {keys: ['gid']};
				update.changes[key] = change.$export(options);
				return;
			}
			if(change instanceof Collection) {
				if(change.isMozelType()) {
					update.changes[key] = change.map(mozel => {
						// New mozels we include in full; existing mozels only gid (see comment above)
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

		this.history.push(update);
		this.clearChanges();

		return update;
	}

	isEqualChangeValue(value1:unknown, value2:unknown):boolean {
		if(isPrimitive(value1) || isPrimitive(value2)) return value1 === value2;
		if(isPlainObject(value1) || value1 instanceof Mozel || isPlainObject(value2) || value2 instanceof Mozel) {
			/*
			If we received a full Mozel as a property, we have initialized the Mozel on our side. As long as we
			don't change the Mozel, we don't need to include it as a change in our next update. We should not
			record it as a new Mozel, though.
			 */
			return get(value1, 'gid') === get(value2, 'gid');
		}
		if(value1 instanceof Collection || value2 instanceof Collection || isArray(value1) || isArray(value2)) {
			const arr1 = value1 instanceof Collection ? value1.export({shallow}) : value1;
			const arr2 = value2 instanceof Collection ? value2.export({shallow}) : value2;
			if(!isArray(arr1) || !isArray(arr2)) { return false }
			if(arr1.length !== arr2.length) return false;

			return !arr1.find((item, i) => !this.isEqualChangeValue(item, arr2[i]));
		}
		return false;
	}

	start(includeCurrentState = false) {
		// Watch property changes
		this.watchers.push(this.mozel.$watch('*', change => {
			const lastUpdate = this.lastUpdate;
			if(lastUpdate && this.isEqualChangeValue(change.newValue, lastUpdate.changes[change.changePath])) {
				// If the change is a direct result of the last update, we don't need to include it in our changes.
				// We don't need to tell whoever sent the update to also apply the same changes of their own update.
				delete this._changes[change.changePath]; // also remove any change if already recorded
				return;
			}
			this._changes[change.changePath] = this.mozel.$path(change.changePath);
			this.events.changed.fire(new MozelWatcherChangedEvent(change.changePath));
		}));

		// Watch collection changes
		this.mozel.$eachProperty(property => {
			if(!property.isCollectionType()) return;
			this.watchers.push(this.mozel.$watch(`${property.name}.*`, change => {
				const lastUpdate = this.lastUpdate;
				if(lastUpdate && this.isEqualChangeValue(this.mozel.$get(property.name), lastUpdate.changes[property.name])) {
					// If the change is a direct result of the last update, we don't need to include it in our changes.
					// We don't need to tell whoever sent the update to also apply the same changes of their own update.
					return;
				}
				this._changes[property.name] = this.mozel.$get(property.name);
				this.events.changed.fire(new MozelWatcherChangedEvent(change.changePath));
			}));
		});

		// Keep track of newly created Mozels
		this.stopCallbacks.push(
			this.mozel.$registry.events.added.on(event => {
				const mozel = event.item;
				if(!(mozel instanceof Mozel) || this.mozelsInUpdates.has(mozel.gid)) return;

				/*
				We only add newly created Mozels that are not already mentioned in updates (we don't need to tell
				the receiver to create the Mozel that they created).
				 */
				this.newMozels.add(mozel.gid);
			})
		);

		if(includeCurrentState) {
			this._changes = this.mozel.$export({shallow: true, nonDefault: true});
			this.events.changed.fire(new MozelWatcherChangedEvent("*"));
		}
	}

	stop() {
		for(let watcher of this.watchers) {
			this.mozel.$removeWatcher(watcher);
		}
		this.stopCallbacks.forEach(call);
	}

	destroy() {
		this.stop();
		this.mozel.$events.destroyed.off(this.onDestroyed);
	}
}
