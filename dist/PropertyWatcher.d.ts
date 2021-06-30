import { PropertyValue } from "./Property";
import Mozel from "./Mozel";
export declare type WatcherThrottleOptions = {
    wait?: number;
    leading?: boolean;
    trailing?: boolean;
};
export declare type PropertyWatcherOptions = {
    path: string;
    handler: PropertyChangeHandler<PropertyValue>;
    immediate?: boolean;
    deep?: boolean;
    throttle?: number | WatcherThrottleOptions;
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
    readonly throttle?: number | WatcherThrottleOptions;
    private readonly handler;
    private currentValues;
    private deepValues;
    constructor(mozel: Mozel, options: PropertyWatcherOptions);
    execute(path: string): void;
    hasChanged(newWatcherValue: any, watcherPath: string, changePath: string): boolean;
    updateValues(path: string): void;
    matches(path: string): boolean | undefined;
    applyMatchedPath(matchedPath: string): string;
}
