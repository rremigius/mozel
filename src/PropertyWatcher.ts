import {isComplexValue, PropertyValue} from "./Property";
import Mozel from "./Mozel";
import Collection from "./Collection";
import Log from "./log";

const log = Log.instance("watcher");

export type PropertyWatcherOptions = {
	path:string,
	handler:PropertyChangeHandler
	immediate?:boolean,
	deep?:boolean
}

export type PropertyChangeHandler = (newValue:PropertyValue, oldValue:PropertyValue, path:string)=>void;

export default class PropertyWatcher {
	readonly mozel:Mozel;
	readonly path: string;
	readonly immediate?: boolean;
	readonly deep?: boolean;
	private readonly handler: PropertyChangeHandler

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
		const values = this.mozel.getPathValues(appliedPath);
		for(let valuePath in values) {
			const value = values[valuePath];
			this.handler(value, this.currentValues[valuePath], valuePath);
			this.currentValues[valuePath] = value;
		}
	}

	updateValues(path:string) {
		const appliedPath = this.applyMatchedPath(path);
		const values = this.mozel.getPathValues(appliedPath);
		for(let path in values) {
			let value = values[path];
			if(this.deep && isComplexValue(value)) {
				value = value.cloneDeep();
			}
			this.currentValues[path] = value;
		}
	}

	matches(path:string) {
		// Exact path at which we're watching changes
		if (path === this.path) return true;

		// Paths should fully overlap
		for(let i = 0; i < Math.min(this.path.length, path.length); i++) {
			let watcherStep = this.path[i];
			let otherStep = path[i];
			// Wildcard matches any
			if(!(watcherStep === '*' || watcherStep === otherStep)) {
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
