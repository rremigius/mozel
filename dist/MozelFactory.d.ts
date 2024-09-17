import { Container } from "inversify";
import Registry from "./Registry";
import Mozel, { MozelConfig, MozelConstructor, MozelData } from "./Mozel";
import MozelFactoryInterface from "./MozelFactoryInterface";
export default class MozelFactory implements MozelFactoryInterface {
    private static defaultInstance;
    static default(): MozelFactory;
    static createDependencyContainer(): Container;
    readonly dependencies: Container;
    readonly localDependencies: Container;
    readonly registry: Registry<Mozel>;
    constructor(dependencies?: Container, mozelRegistry?: Registry<Mozel>);
    initDependencies(): void;
    /**
     * Registers the class to the default mozel DI Container, under the class name or static `type`.
     * @param {MozelClass} MozelClass
     * @param {string} [type]			The type for which to register the class. When initializing mozels from raw data,
     * 									the `_type` property will match against the registered types of the mozels to
     * 									find a suitable candidate for instantiation. If left empty, will default to
     * 									the `type()` getter of the class or the class name.
     */
    register(MozelClass: (typeof Mozel) | (typeof Mozel)[], type?: string): void;
    bind(serviceIdentifier: any): import("inversify").interfaces.BindingToSyntax<unknown>;
    destroy(mozel: Mozel): void;
    createSet<T extends Mozel>(ExpectedClass: MozelConstructor<T>, data: MozelData<T>[], init?: (mozel: T) => void): T[];
    /**
     * Alias for `create`, with `root = true`
     * @param ExpectedClass
     * @param data
     * @param config
     */
    createRoot<T extends Mozel>(ExpectedClass: MozelConstructor<T>, data?: MozelData<T>, config?: MozelConfig<T>): T;
    /**
     * Creates a Mozel
     * If <T> matches ExpectedClass, is guaranteed to provide the correct class (or throw).
     *
     * Note: Factory has no knowledge of subclasses of Mozel (among other reasons to prevent circular dependencies).
     * @param {Class} ExpectedClass		Class to instantiate
     * @param {mozel} data				Data to fill the Mozel
     * @param {MozelConfig} config		Config for Mozel to be set before data
     * @param {boolean} root			Unless set to true, orphaned Mozels will destroy themselves.
     */
    create<T extends Mozel>(ExpectedClass: MozelConstructor<T>, data?: MozelData<T>, config?: MozelConfig<T>, root?: boolean): T;
}
