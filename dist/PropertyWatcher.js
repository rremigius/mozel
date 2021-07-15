import Mozel from "./Mozel";
import { debounce, isNumber } from "lodash";
import Collection from "./Collection";
import { includes } from "./utils";
export default class PropertyWatcher {
    constructor(mozel, options) {
        this.currentValues = {};
        this.deepValues = {};
        this.mozel = mozel;
        this.path = options.path;
        this.handler = options.handler;
        this.immediate = options.immediate;
        this.deep = options.deep;
        this.debounce = options.debounce;
        if (this.debounce !== undefined) {
            if (isNumber(this.debounce)) {
                this.handler = debounce(this.handler, this.debounce);
            }
            else {
                this.handler = debounce(this.handler, this.debounce.wait || 0, this.debounce);
            }
        }
    }
    execute(path) {
        const appliedPath = this.applyMatchedPath(path);
        const values = this.mozel.$pathPattern(appliedPath);
        for (let valuePath in values) {
            const newValue = values[valuePath];
            // Only fire if changed
            if (this.hasChanged(newValue, valuePath, path)) {
                const changePath = includes(path, '*') ? valuePath : path;
                const oldValue = this.deep ? this.deepValues[valuePath] : this.currentValues[valuePath];
                this.handler({ newValue, oldValue, valuePath, changePath });
            }
        }
    }
    hasChanged(newWatcherValue, watcherPath, changePath) {
        const current = this.currentValues[watcherPath];
        // Value changed
        if (current !== newWatcherValue)
            return true;
        // Value didn't change, and we're not looking deeper
        if (!this.deep)
            return false;
        // Change occurred no deeper than our watcher path
        if (changePath.length <= watcherPath.length || changePath.substring(0, watcherPath.length) !== watcherPath) {
            return false;
        }
        // Compare deep value with our deep clone
        const currentDeep = this.deepValues[watcherPath];
        // remove watcher path, including final '.' (for empty watcherPath, do not expect '.')
        const deeperPath = changePath.substring(watcherPath.length ? watcherPath.length + 1 : 0);
        // If the change happened deep, but current or new value is not a Mozel, then it must be different
        // (although it should not even be possible, actually)
        if (!(currentDeep instanceof Mozel) || !(newWatcherValue instanceof Mozel))
            return true;
        const deepOldValue = currentDeep.$path(deeperPath);
        const deepNewValue = newWatcherValue.$path(deeperPath);
        return deepOldValue !== deepNewValue;
    }
    updateValues(path) {
        const appliedPath = this.applyMatchedPath(path);
        const values = this.mozel.$pathPattern(appliedPath, [], false); // prevent infinite loops
        for (let path in values) {
            let value = values[path];
            this.currentValues[path] = value;
            // Make deep clone so we can compare deeper paths
            if (this.deep) {
                this.destroyDeepValues(this.deepValues[path]);
                this.deepValues[path] = this.cloneDeepValues(value);
            }
        }
        // Reset values next tick. All updates should be completed within the tick
        setTimeout(() => this.resetValues());
    }
    destroyDeepValues(value) {
        if (value instanceof Mozel) {
            return value.$destroy();
        }
        else if (value instanceof Collection) {
            return value.parent.$destroy();
        }
    }
    cloneDeepValues(value) {
        if (value instanceof Mozel) {
            return value.$cloneDeep();
        }
        else if (value instanceof Collection) {
            const mozel = value.parent.$cloneDeep();
            return mozel.$get(value.relation);
        }
        return value;
    }
    resetValues() {
        this.currentValues = {};
        this.deepValues = {};
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
        if (this.path === '')
            return [];
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