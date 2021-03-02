export default class Registry {
    constructor() {
        this.indexById = {};
        this.indexByGid = {};
    }
    register(item) {
        if (item.id) {
            if (item.id in this.indexById) {
                console.error(`Duplicate registration for ID: ${item.id}.`);
            }
            else {
                this.indexById[item.id] = item;
            }
        }
        if (item.gid) {
            if (item.gid in this.indexByGid) {
                console.error(`Duplicate registration for GID: ${item.gid}.`);
            }
            else {
                this.indexByGid[item.gid] = item;
            }
        }
    }
    remove(item) {
        if (item.id) {
            delete this.indexById[item.id];
        }
        if (item.gid) {
            delete this.indexByGid[item.gid];
        }
    }
    find(ids) {
        if (ids.id) {
            let item = this.byId(ids.id);
            if (item)
                return item;
        }
        if (ids.gid) {
            let item = this.byGid(ids.gid);
            if (item)
                return item;
        }
        return; // not found
    }
    byId(id, ExpectedClass) {
        const found = this.indexById[id];
        if (ExpectedClass && !(found instanceof ExpectedClass)) {
            console.error(`Object with ID ${id} was found, but was not a ${ExpectedClass.name}.`);
            return undefined;
        }
        return found;
    }
    byGid(gid, ExpectedClass) {
        const found = this.indexByGid[gid];
        if (ExpectedClass && !(found instanceof ExpectedClass)) {
            console.error(`Object with GID ${gid} was found, but was not a ${ExpectedClass.name}.`);
            return undefined;
        }
        return found;
    }
    /**
     * Find the current maximum numeric GID in the Registry. String values are ignored.
     */
    findMaxGid() {
        let max = 0;
        Object.keys(this.indexByGid).forEach((gid) => {
            const numeric = parseInt(gid);
            if (numeric.toString() !== gid)
                return; // gid is not an integer string index
            if (numeric > max)
                max = numeric;
        });
        return max;
    }
}
//# sourceMappingURL=Registry.js.map