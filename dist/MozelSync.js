import { deep } from "./Mozel";
export default class MozelSync {
    constructor(mozel) {
        this.watchers = [];
        this._changes = {};
        this.mozel = mozel;
    }
    get changes() {
        return this._changes;
    }
    startWatching() {
        this.watchers.push(this.mozel.$watch('', change => {
            this._changes[change.changePath] = this.mozel.$path(change.changePath);
        }, { deep }));
    }
    stopWatching() {
        for (let watcher of this.watchers) {
            this.mozel.$removeWatcher(watcher);
        }
    }
}
//# sourceMappingURL=MozelSync.js.map