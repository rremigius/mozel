import Mozel, { Data } from '@/Mozel';
/**
 * GenericMozel can take any number of Primitive Properties, which can be defined on the fly.
 * Any keys passed to the `create` argument object, or defined after construction, are initialized as Properties,
 * will be validated as undefined Primitive types, and will be exported in the `export()` method.
 *
 */
export default class GenericMozel<K extends Data = Data> extends Mozel {
    [key: string]: any;
    MozelDataType: {
        [I in keyof K]?: K[I];
    };
    private genericProperties;
    static create<T extends Mozel>(data?: Data): T;
    initialized: boolean;
    constructor();
    /**
     * Sets a Property value on the GenericMozel. If the Property did not exist, it will be initialized first.
     * @param {string} property
     * @param value
     * @param {boolean} [init]			Allow intialization of Mozels and Collections.
     */
    set(property: string, value: any, init?: boolean): boolean;
    setData(data: Data): void;
    exportGeneric(): {
        [x: string]: import("@/Property").PropertyValue;
    };
    /**
     * Initialize a property if it was not already initialized.
     * @param {string} name		The name of the property.
     * @return {boolean}	True if the property is initialized (or already was), false if it could not.
     */
    initProperty(name: string): boolean;
}
