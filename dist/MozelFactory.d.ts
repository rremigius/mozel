import { Container } from "inversify";
import Registry from "@/Registry";
import Mozel, { MozelConstructor, MozelData } from "@/Mozel";
import { alphanumeric } from "validation-kit";
import MozelFactoryInterface from "@/MozelFactoryInterface";
export default class MozelFactory implements MozelFactoryInterface {
    static createDependencyContainer(): Container;
    readonly diContainer: Container;
    readonly registry: Registry<Mozel>;
    constructor(diContainer?: Container, mozelRegistry?: Registry<Mozel>);
    ensureUniqueGID(gid: alphanumeric): alphanumeric;
    nextGID(): number;
    destroy(mozel: Mozel): void;
    createSet<T extends Mozel>(ExpectedClass: MozelConstructor<T>, data: MozelData<T>[]): T[];
    /**
     * Creates a Mozel
     * If <T> matches ExpectedClass, is guaranteed to provide the correct class (or throw).
     *
     * Note: Factory has no knowledge of subclasses of Mozel (among other reasons to prevent circular dependencies).
     * @param {Class} ExpectedClass
     * @param {mozel} data
     * @param {boolean} root			Set to true if Mozel is root of its hierarchy and references should be resolved recursively after its creation.
     * @param {boolean} asReference		Set to true if the Mozel will only be a reference to another Mozel. It will not be registered.
     */
    create<T extends Mozel>(ExpectedClass: MozelConstructor<T>, data?: MozelData<T>, root?: boolean, asReference?: boolean): T;
}
