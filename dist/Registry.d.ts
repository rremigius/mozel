import { Class, alphanumeric } from "validation-kit";
export declare type Registerable = {
    id?: alphanumeric;
    gid?: alphanumeric;
};
export default class Registry<T extends Registerable> {
    private indexById;
    private indexByGid;
    register(item: T): void;
    remove(item: T): void;
    find(ids: {
        id?: alphanumeric;
        gid?: alphanumeric;
    }): T | undefined;
    byId<E extends T>(id: alphanumeric, ExpectedClass?: Class): E | undefined;
    byGid<E extends T>(gid: alphanumeric, ExpectedClass?: Class): E | undefined;
    /**
     * Find the current maximum numeric GID in the Registry. String values are ignored.
     */
    findMaxGid(): number;
}
