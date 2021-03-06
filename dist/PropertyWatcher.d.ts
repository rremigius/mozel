import { PropertyValue } from "./Property";
import Mozel from "./Mozel";
export declare type WatcherDebounceOptions = {
    wait?: number;
    maxWait?: number;
    leading?: boolean;
    trailing?: boolean;
};
export declare type PropertyWatcherOptions = {
    path: string;
    handler: PropertyChangeHandler<PropertyValue>;
    immediate?: boolean;
    deep?: boolean;
    debounce?: number | WatcherDebounceOptions;
};
export declare type PropertyWatcherOptionsArgument = Omit<PropertyWatcherOptions, 'path' | 'handler'>;
export declare type PropertyChangeHandler<T> = (change: {
    newValue: T;
    oldValue: T;
    valuePath: string;
    changePath: string;
}) => void;
export default class PropertyWatcher {
    readonly mozel: Mozel;
    readonly path: string;
    readonly immediate?: boolean;
    readonly deep?: boolean;
    readonly debounce?: number | WatcherDebounceOptions;
    private readonly handler;
    private currentValues;
    private deepValues;
    constructor(mozel: Mozel, options: PropertyWatcherOptions);
    execute(path: string): void;
    hasChanged(newWatcherValue: any, watcherPath: string, changePath: string): boolean;
    updateValues(path: string): void;
    resetValues(): void;
    matches(path: string): boolean | undefined;
    applyMatchedPath(matchedPath: string): string | never[];
}
