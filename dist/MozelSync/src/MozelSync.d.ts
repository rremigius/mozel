import { alphanumeric } from "validation-kit";
import EventInterface from "event-interface-mixin";
import { Commit, MozelWatcher } from "./MozelWatcher";
import Mozel from "../../Mozel";
import Registry from "../../Registry";
export declare class MozelSyncNewCommitsEvent {
    updates: Record<string, Commit>;
    constructor(updates: Record<string, Commit>);
}
export declare class MozelSyncEvents extends EventInterface {
    newCommits: import("event-interface-mixin").EventEmitter<MozelSyncNewCommitsEvent>;
}
export default class MozelSync {
    private _id;
    get id(): string;
    set id(value: string);
    private _autoCommit?;
    get autoCommit(): number | undefined;
    set autoCommit(value: number | undefined);
    private _commitThrottled;
    get commitThrottled(): () => void;
    private mozels;
    private newPropertyMozels;
    private watchers;
    private unRegisterCallbacks;
    private destroyCallbacks;
    private registry?;
    readonly historyLength: number;
    private active;
    priority: number;
    readonly events: MozelSyncEvents;
    constructor(options?: {
        model?: Mozel;
        registry?: Registry<Mozel>;
        priority?: number;
        historyLength?: number;
        autoCommit?: number;
    });
    createFullStates(): {
        [x: string]: Commit;
        [x: number]: Commit;
    };
    hasChanges(): boolean;
    commit(): Record<alphanumeric, Commit>;
    /**
     * Merges the given updates for each MozelWatcher
     * @param updates
     */
    merge(updates: Record<alphanumeric, Commit>): Record<alphanumeric, Commit>;
    getWatcher(gid: alphanumeric): MozelWatcher;
    register(mozel: Mozel): void;
    unregister(mozel: Mozel): void;
    has(mozel: Mozel): boolean;
    syncRegistry(registry: Registry<Mozel>): void;
    start(): void;
    stop(): void;
    destroy(): void;
}
