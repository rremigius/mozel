import { Container } from "inversify";
import Registry from "@/Registry";
import Mozel, { MozelConstructor, MozelData } from "@/Mozel";
import { alphanumeric } from "validation-kit";
import ModelFactoryInterface from "@/MozelFactoryInterface";
export default class MozelFactory implements ModelFactoryInterface {
    readonly diContainer: Container;
    readonly registry: Registry<Mozel>;
    constructor(diContainer?: Container, modelRegistry?: Registry<Mozel>);
    ensureUniqueGID(gid: alphanumeric): alphanumeric;
    nextGID(): number;
    destroy(model: Mozel): void;
    createSet<T extends Mozel>(ExpectedClass: MozelConstructor<T>, data: MozelData<T>[]): T[];
    /**
     * Creates a Model
     * If <T> matches ExpectedClass, is guaranteed to provide the correct class (or throw).
     *
     * Note: Factory has no knowledge of subclasses of Model (among other reasons to prevent circular dependencies).
     * @param {Class} ExpectedClass
     * @param {model} data
     * @param {boolean} root			Set to true if Model is root of its hierarchy and references should be resolved recursively after its creation.
     * @param {boolean} asReference		Set to true if the Model will only be a reference to another Model. It will not be registered.
     */
    create<T extends Mozel>(ExpectedClass: MozelConstructor<T>, data?: MozelData<T>, root?: boolean, asReference?: boolean): T;
}
