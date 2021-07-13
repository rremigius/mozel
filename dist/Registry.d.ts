import { Class, alphanumeric } from "validation-kit";
export declare type Registerable = {
    id?: alphanumeric;
    gid?: alphanumeric;
};
export default class Registry<T extends Registerable> {
    readonly id: string;
    private indexByGid;
    register(item: T): void;
    remove(item: T): void;
    find(gid?: alphanumeric): T | undefined;
    byGid<E extends T>(gid: alphanumeric, ExpectedClass?: Class): E | undefined;
    /**
     * Find the current maximum numeric GID in the Registry. String values are ignored.
     */
    findMaxGid(): number;
}
