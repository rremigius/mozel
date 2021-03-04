import { isComplexValue } from "./Property";
export default class PropertyWatcher {
    constructor(options) {
        this.path = options.path;
        this.handler = options.handler;
        this.immediate = options.immediate;
        this.deep = options.deep;
    }
    execute(newValue, parent) {
        // TS: currentValue is allowed to be undefined
        this.handler(newValue, this.currentValue, parent);
    }
    setCurrentValue(value) {
        if (this.deep && isComplexValue(value)) {
            // TS: if value was a Mozel but T wasn't, then we should not be here.
            this.currentValue = value.cloneDeep();
            return;
        }
        this.currentValue = value;
    }
    matches(path) {
        // Exact path at which we're watching changes
        if (path === this.path)
            return true;
        // Paths should fully overlap
        for (let i = 0; i < Math.min(this.path.length, path.length); i++) {
            let watcherStep = this.path[i];
            let otherStep = path[i];
            // Wildcard matches any
            if (!(watcherStep === '*' || watcherStep === otherStep)) {
                return false;
            }
        }
        return true;
    }
    applyMatchedPath(matchedPath) {
        if (matchedPath === this.path)
            return matchedPath;
        // We use the matched path until:
        // - end of matched path
        // - end of watcher path
        // if watcher path is longer, we complete the path with watcher path steps
        let matchedChunks = matchedPath.split('.');
        let watcherChunks = this.path.split('.');
        const result = [];
        for (let i = 0; i < watcherChunks.length; i++) {
            if (i < matchedChunks.length)
                result.push(matchedChunks[i]);
            else
                result.push(watcherChunks[i]);
        }
        return result.join('.');
    }
}
//# sourceMappingURL=PropertyWatcher.js.map