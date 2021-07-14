import Mozel from "./Mozel";
export default class MozelSync {
    readonly mozel: Mozel;
    private watchers;
    private _changes;
    get changes(): Record<string, any>;
    constructor(mozel: Mozel);
    startWatching(): void;
    stopWatching(): void;
}
