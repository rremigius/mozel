import Mozel from "./Mozel";
import { forEach, isNumber } from "./utils";
import { Collection } from "./index";
import { v4 as uuid } from "uuid";
export default class MozelSync {
    constructor(options) {
        this._id = uuid();
        this.mozels = {};
        this.watchers = {};
        this.listeners = {};
        this.registryListeners = [];
        this.syncs = new Set();
        this.active = false;
        if (!options)
            return;
        this.priority = isNumber(options.priority) ? options.priority : 0;
        if (options.registry)
            this.syncRegistry(options.registry);
    }
    get id() {
        return this._id;
    }
    createUpdates() {
        const updates = {};
        forEach(this.watchers, watcher => {
            const update = watcher.createUpdate();
            if (!update)
                return;
            updates[watcher.mozel.gid] = update;
        });
        return updates;
    }
    applyUpdates(updates) {
        forEach(updates, (update, gid) => {
            const watcher = this.watchers[gid];
            if (!watcher)
                return;
            watcher.applyUpdate(update);
        });
    }
    update() {
        const updates = this.createUpdates();
        this.syncs.forEach(sync => sync.applyUpdates(updates));
    }
    getWatcher(gid) {
        return this.watchers[gid];
    }
    register(mozel) {
        this.mozels[mozel.gid] = mozel;
        const watcher = new MozelWatcher(this.id, mozel, this.priority);
        this.watchers[mozel.gid] = watcher;
        this.listeners[mozel.gid] = [
            mozel.$events.destroyed.on(() => this.unregister(mozel))
        ];
        if (this.active)
            watcher.start(true);
    }
    unregister(mozel) {
        if (!(mozel.gid in this.watchers))
            return;
        this.watchers[mozel.gid].destroy();
        delete this.watchers[mozel.gid];
        delete this.mozels[mozel.gid];
        mozel.$events.$offAll(this.listeners[mozel.gid]);
    }
    has(mozel) {
        return !!this.mozels[mozel.gid];
    }
    syncRegistry(registry) {
        this.registryListeners = [
            registry.events.added.on(event => this.register(event.item)),
            registry.events.removed.on(event => this.unregister(event.item))
        ];
        // Also register current Mozels
        registry.all().forEach(mozel => this.register(mozel));
    }
    syncWith(sync, twoWay = true) {
        this.syncs.add(sync);
        if (twoWay)
            sync.syncWith(this, false);
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
        if (this.registry) {
            this.registry.events.$offAll(this.registryListeners);
        }
    }
}
export class MozelWatcher {
    constructor(syncID, mozel, priority = 0) {
        this.watchers = [];
        this._changes = {};
        this.version = 0;
        this.history = [];
        /**
         * A map of other MozelSyncs and the highest version received from them.
         * @private
         */
        this.syncBaseVersions = {};
        this.onDestroyed = () => this.destroy();
        this.mozel = mozel;
        this.mozel.$events.destroyed.on(this.onDestroyed);
        this.priority = priority;
        this.syncID = syncID;
    }
    get changes() {
        return this._changes;
    }
    /*
            Priority: 1										Priority: 2
            {b: 0, foo: 'a'}								{b: 0, foo: 'a'}
            {b: 1, foo: 'b'}		{b: 0, foo: 'b', v: 1}>	{b: 0, foo: 'x'}
            {b: 1, foo: 'b'} x<{b: 0, foo: 'x', v: 1}		{b: 1, foo: 'b'}
            {b: 1, foo: 'b'}								{b: 1, foo: 'b'}
     */
    applyUpdate(update) {
        const changes = this.overrideChangesFromHistory(update);
        this.mozel.$setData(changes, true);
        this.history.push(update);
        this.version = Math.max(update.version, this.version);
        this.syncBaseVersions[update.syncID] = update.baseVersion;
        this.autoCleanHistory();
    }
    overrideChangesFromHistory(update) {
        let changes = { ...update.changes };
        this.history.forEach(history => {
            // Any update with a higher base version than the received update should override the received update
            if (history.baseVersion > update.baseVersion
                || (this.priority > update.priority && history.baseVersion >= update.baseVersion)) {
                changes = this.removeChanges(changes, history.changes);
            }
        });
        // Also resolve current conflicting changes
        if (this.version > update.baseVersion
            || (this.priority > update.priority && this.version >= update.baseVersion)) {
            changes = this.removeChanges(changes, this.changes);
        }
        return changes;
    }
    removeChanges(changes, override) {
        changes = { ...changes };
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
        let lowest = null;
        forEach(this.syncBaseVersions, version => {
            if (lowest === null || version < lowest)
                lowest = version;
        });
        lowest = lowest || 0;
        this.clearHistory(lowest);
    }
    clearHistory(fromBaseVersion) {
        if (!isNumber(fromBaseVersion)) {
            this.history = [];
            return;
        }
        this.history = this.history.filter(update => update.baseVersion > fromBaseVersion);
    }
    createUpdate() {
        const update = {
            syncID: this.syncID,
            version: this.version + 1,
            baseVersion: this.version,
            priority: this.priority,
            changes: {}
        };
        forEach(this.changes, (change, key) => {
            if (change instanceof Mozel) {
                update.changes[key] = change.$export({ keys: ['gid'] });
                return;
            }
            if (change instanceof Collection) {
                update.changes[key] = change.export({ keys: ['gid'] });
                return;
            }
            update.changes[key] = change;
        });
        if (!Object.keys(update.changes).length) {
            return;
        }
        this.version = update.version;
        this.history.push(update);
        this.clearChanges();
        return update;
    }
    getSyncVersions() {
        return { ...this.syncBaseVersions };
    }
    start(includeCurrentState = false) {
        this.watchers.push(this.mozel.$watch('*', change => {
            this._changes[change.changePath] = this.mozel.$path(change.changePath);
        }));
        // Watch collection changes
        this.mozel.$eachProperty(property => {
            if (!property.isCollectionType())
                return;
            this.watchers.push(this.mozel.$watch(`${property.name}.*`, change => {
                this._changes[property.name] = this.mozel.$get(property.name);
            }));
        });
        if (includeCurrentState) {
            this._changes = this.mozel.$export({ shallow: true, nonDefault: true });
        }
    }
    stop() {
        for (let watcher of this.watchers) {
            this.mozel.$removeWatcher(watcher);
        }
    }
    destroy() {
        this.stop();
        this.mozel.$events.destroyed.off(this.onDestroyed);
    }
}
//# sourceMappingURL=MozelSync.js.map