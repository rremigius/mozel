import {isComplexValue, PropertyValue} from "./Property";
import Mozel from "./Mozel";
import {isNumber, debounce} from "lodash";

export type WatcherDebounceOptions = {
	wait?:number,
	maxWait?:number,
	leading?:boolean,
	trailing?:boolean
}
export type PropertyWatcherOptions = {
	path:string,
	handler:PropertyChangeHandler<PropertyValue>
	immediate?:boolean,
	deep?:boolean,
	debounce?:number|WatcherDebounceOptions,
}
export type PropertyWatcherOptionsArgument = Omit<PropertyWatcherOptions, 'path'|'handler'>

export type PropertyChangeHandler<T> = (change:{newValue:T, oldValue:T, valuePath:string, changePath:string})=>void;

export default class PropertyWatcher {
	readonly mozel:Mozel;
	readonly path: string;
	readonly immediate?: boolean;
	readonly deep?: boolean;
	readonly debounce?:number|WatcherDebounceOptions;

	private readonly handler: PropertyChangeHandler<any>;

	private currentValues:Record<string, PropertyValue> = {};
	private deepValues:Record<string, PropertyValue> = {};

	constructor(mozel:Mozel, options:PropertyWatcherOptions) {
		this.mozel = mozel;
		this.path = options.path;
		this.handler = options.handler;
		this.immediate = options.immediate;
		this.deep = options.deep;
		this.debounce = options.debounce;

		if(this.debounce !== undefined) {
			if(isNumber(this.debounce)) {
				this.handler = debounce(this.handler, this.debounce);
			} else {
				this.handler = debounce(this.handler, this.debounce.wait || 0, this.debounce);
			}
		}
	}

	execute(path:string) {
		const appliedPath = this.applyMatchedPath(path);
		const values = this.mozel.$pathPattern(appliedPath);

		for(let valuePath in values) {
			const newValue = values[valuePath];
			// Only fire if changed
			if(this.hasChanged(newValue, valuePath, path)) {
				const oldValue = this.deep ? this.deepValues[valuePath] : this.currentValues[valuePath];
				this.handler({newValue, oldValue, valuePath, changePath: path});
			}
		}
	}

	hasChanged(newWatcherValue:any, watcherPath:string, changePath:string) {
		const current = this.currentValues[watcherPath];

		// Value changed
		if(current !== newWatcherValue) return true;

		// Value didn't change, and we're not looking deeper
		if(!this.deep) return false;

		// Change occurred no deeper than our watcher path
		if(changePath.length <= watcherPath.length || changePath.substring(0, watcherPath.length) !== watcherPath) {
			return false;
		}

		// Compare deep value with our deep clone
		const currentDeep = this.deepValues[watcherPath];
		const deeperPath = changePath.substring(watcherPath.length + 1); // remove watcher path, including final '.'

		// If the change happened deep, but current or new value is not a Mozel, then it must be different
		// (although it should not even be possible, actually)
		if(!(currentDeep instanceof Mozel) || !(newWatcherValue instanceof Mozel)) return true;

		const deepOldValue = currentDeep.$path(deeperPath);
		const deepNewValue = newWatcherValue.$path(deeperPath);
		return deepOldValue !== deepNewValue;
	}

	updateValues(path:string) {
		const appliedPath = this.applyMatchedPath(path);
		const values = this.mozel.$pathPattern(appliedPath, [], false); // prevent infinite loops
		for(let path in values) {
			let value = values[path];
			this.currentValues[path] = value;
			// Make deep clone so we can compare deeper paths
			if(this.deep) {
				if(isComplexValue(value)) {
					this.deepValues[path] = value instanceof Mozel ? value.$cloneDeep() : value.cloneDeep();
				} else {
					this.deepValues[path] = value;
				}
			}
		}
		// Reset values next tick. All updates should be completed within the tick
		setTimeout(()=>this.resetValues());
	}

	resetValues() {
		this.currentValues = {};
		this.deepValues = {};
	}

	matches(path:string) {
		// Exact path at which we're watching changes
		if (path === this.path) return true;
		if (this.path === '') return this.deep; // if we're watching all of the Mozel, we just need to check `deep`

		const watcherPath = this.path.split('.');
		const changePath = path.split('.');
		for(let i = 0; i < Math.max(watcherPath.length, changePath.length); i++) {
			let watcherStep = watcherPath[i];
			let changeStep = changePath[i];

			// Change happened deeper than watcher path, then 'deep' determines whether it should match
			if(watcherStep === undefined) return this.deep;

			// change happened above watcher path: watcher path changed as well
			if(changeStep === undefined) return true;

			// Wildcard matches any
			if(!(watcherStep === '*' || watcherStep === changeStep)) {
				return false;
			}
		}
		return true;
	}

	applyMatchedPath(matchedPath:string) {
		if(matchedPath === this.path) return matchedPath;

		// We use the matched path until:
		// - end of matched path
		// - end of watcher path
		// if watcher path is longer, we complete the path with watcher path steps
		let matchedChunks = matchedPath.split('.');
		let watcherChunks = this.path.split('.');
		const result = [];
		for(let i = 0; i < watcherChunks.length; i++) {
			if(i < matchedChunks.length) result.push(matchedChunks[i]);
			else result.push(watcherChunks[i]);
		}
		return result.join('.');
	}
}
