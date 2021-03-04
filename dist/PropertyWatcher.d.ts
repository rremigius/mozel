import { PropertyValue } from "./Property";
import Mozel from "./Mozel";
export declare type PropertyWatcherOptions<T extends PropertyValue> = {
    path: string;
    handler: PropertyChangeHandler<T>;
    immediate?: boolean;
    deep?: boolean;
};
export declare type PropertyChangeHandler<T extends PropertyValue> = (newValue: T, oldValue: T, parent: Mozel) => void;
export default class PropertyWatcher<T extends PropertyValue> {
    readonly path: string;
    readonly immediate?: boolean;
    readonly deep?: boolean;
    private readonly handler;
    private currentValue?;
    constructor(options: PropertyWatcherOptions<T>);
    execute(newValue: T, parent: Mozel): void;
    setCurrentValue(value: T): void;
    matches(path: string): boolean;
    applyMatchedPath(matchedPath: string): string;
}
