import { isComplexValue } from "./Property";
import Mozel from "./Mozel";
import { throttle, isNumber } from "lodash";
export default class PropertyWatcher {
    constructor(mozel, options) {
        this.currentValues = {};
        this.mozel = mozel;
        this.path = options.path;
        this.handler = options.handler;
        this.immediate = options.immediate;
        this.deep = options.deep;
        this.throttle = options.throttle;
        if (isNumber(this.throttle))
            this.handler = throttle(this.handler, this.throttle);
    }
    execute(path) {
        const appliedPath = this.applyMatchedPath(path);
        const values = this.mozel.$pathPattern(appliedPath);
        for (let valuePath in values) {
            const value = values[valuePath];
            // Only fire if changed
            if (this.currentValues[valuePath] !== values[valuePath]) {
                this.handler(value, this.currentValues[valuePath], valuePath);
                this.currentValues[valuePath] = value;
            }
        }
    }
    updateValues(path) {
        const appliedPath = this.applyMatchedPath(path);
        const values = this.mozel.$pathPattern(appliedPath);
        for (let path in values) {
            let value = values[path];
            if (this.deep && isComplexValue(value)) {
                value = value instanceof Mozel ? value.$cloneDeep() : value.cloneDeep();
            }
            this.currentValues[path] = value;
        }
    }
    matches(path) {
        // Exact path at which we're watching changes
        if (path === this.path)
            return true;
        if (this.path === '')
            return this.deep; // if we're watching all of the Mozel, we just need to check `deep`
        const watcherPath = this.path.split('.');
        const changePath = path.split('.');
        for (let i = 0; i < Math.max(watcherPath.length, changePath.length); i++) {
            let watcherStep = watcherPath[i];
            let changeStep = changePath[i];
            // Change happened deeper than watcher path, then 'deep' determines whether it should match
            if (watcherStep === undefined)
                return this.deep;
            // change happened above watcher path: watcher path changed as well
            if (changeStep === undefined)
                return true;
            // Wildcard matches any
            if (!(watcherStep === '*' || watcherStep === changeStep)) {
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