import { Container } from "inversify";
import Registry from "./Registry";
import Mozel, { MozelConstructor, MozelData } from "./Mozel";
import MozelFactoryInterface from "./MozelFactoryInterface";
export default class MozelFactory implements MozelFactoryInterface {
    static createDependencyContainer(): Container;
    readonly dependencies: Container;
    readonly localDependencies: Container;
    readonly registry: Registry<Mozel>;
    constructor(dependencies?: Container, mozelRegistry?: Registry<Mozel>);
    initDependencies(): void;
    /**
     * Registers the class to the default mozel DI Container, under the class name or static `type`.
     * @param {MozelClass} MozelClass
     */
    register(MozelClass: (typeof Mozel) | (typeof Mozel)[]): void;
    bind(serviceIdentifier: any): import("inversify/dts/interfaces/interfaces").interfaces.BindingToSyntax<unknown>;
    destroy(mozel: Mozel): void;
    createSet<T extends Mozel>(ExpectedClass: MozelConstructor<T>, data: MozelData<T>[]): T[];
    /**
     * Alias for `create`, with `root = true`
     * @param ExpectedClass
     * @param data
     */
    createRoot<T extends Mozel>(ExpectedClass: MozelConstructor<T>, data?: MozelData<T>): T;
    /**
     * Creates a Mozel
     * If <T> matches ExpectedClass, is guaranteed to provide the correct class (or throw).
     *
     * Note: Factory has no knowledge of subclasses of Mozel (among other reasons to prevent circular dependencies).
     * @param {Class} ExpectedClass
     * @param {mozel} data
     * @param {boolean} root			Unless set to true, orphaned Mozels will destroy themselves.
     */
    create<T extends Mozel>(ExpectedClass: MozelConstructor<T>, data?: MozelData<T>, root?: boolean): T;
}
