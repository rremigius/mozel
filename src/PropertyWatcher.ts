import {isComplexValue, PropertyValue} from "./Property";
import Mozel from "./Mozel";

export type PropertyWatcherOptions = {
	path:string,
	handler:PropertyChangeHandler<PropertyValue>
	immediate?:boolean,
	deep?:boolean,
	expect?:Function
}
export type PropertyWatcherOptionsArgument = Omit<PropertyWatcherOptions, 'path'|'handler'>

export type PropertyChangeHandler<T> = (newValue:T, oldValue:T, path:string)=>void;

export default class PropertyWatcher {
	readonly mozel:Mozel;
	readonly path: string;
	readonly immediate?: boolean;
	readonly deep?: boolean;
	private readonly handler: PropertyChangeHandler<any>

	private currentValues:Record<string, PropertyValue> = {};

	constructor(mozel:Mozel, options:PropertyWatcherOptions) {
		this.mozel = mozel;
		this.path = options.path;
		this.handler = options.handler;
		this.immediate = options.immediate;
		this.deep = options.deep;

		if (this.immediate) {
			this.execute(this.path);
		}
	}

	execute(path:string) {
		const appliedPath = this.applyMatchedPath(path);
		const values = this.mozel.$pathPattern(appliedPath);
		for(let valuePath in values) {
			const value = values[valuePath];
			this.handler(value, this.currentValues[valuePath], valuePath);
			this.currentValues[valuePath] = value;
		}
	}

	updateValues(path:string) {
		const appliedPath = this.applyMatchedPath(path);
		const values = this.mozel.$pathPattern(appliedPath);
		for(let path in values) {
			let value = values[path];
			if(this.deep && isComplexValue(value)) {
				value = value instanceof Mozel ? value.$cloneDeep() : value.cloneDeep();
			}
			this.currentValues[path] = value;
		}
	}

	matches(path:string) {
		// Exact path at which we're watching changes
		if (path === this.path) return true;

		for(let i = 0; i < Math.max(this.path.length, path.length); i++) {
			let watcherStep = this.path[i];
			let changeStep = path[i];

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
