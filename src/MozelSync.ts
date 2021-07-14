import Mozel, {deep} from "./Mozel";
import PropertyWatcher from "./PropertyWatcher";

export default class MozelSync {
	readonly mozel:Mozel;

	private watchers:PropertyWatcher[] = [];
	private _changes:Record<string, any> = {};
	get changes() {
		return this._changes;
	}

	constructor(mozel:Mozel) {
		this.mozel = mozel;
	}

	startWatching() {
		this.watchers.push(this.mozel.$watch('', change => {
			this._changes[change.changePath] = this.mozel.$path(change.changePath);
		}, {deep}));
	}

	stopWatching() {
		for(let watcher of this.watchers) {
			this.mozel.$removeWatcher(watcher);
		}
	}
}
