import { Container } from "inversify";
import Registry from "@/Registry";
import Model, { ModelConstructor, ModelData } from "@/Model";
import { alphanumeric } from "validation-kit";
import ModelFactoryInterface from "@/ModelFactoryInterface";
export default class ModelFactory implements ModelFactoryInterface {
    readonly diContainer: Container;
    readonly registry: Registry<Model>;
    constructor(diContainer?: Container, modelRegistry?: Registry<Model>);
    ensureUniqueGID(gid: alphanumeric): alphanumeric;
    nextGID(): number;
    destroy(model: Model): void;
    /**
     * Creates a Model
     * If <T> matches ExpectedClass, is guaranteed to provide the correct class (or throw).
     *
     * Note: Factory has no knowledge of subclasses of Model (among other reasons to prevent circular dependencies).
     * @param {Class} ExpectedClass
     * @param {model} data
     * @param {boolean} root					Set to true if Model is root of its hierarchy and references should be resolved recursively after its creation.
     * @param {boolean} asReference		Set to true if the Model will only be a reference to another Model. It will not be registered.
     */
    create<T extends Model>(ExpectedClass: ModelConstructor<T>, data?: ModelData<T>, root?: boolean, asReference?: boolean): T;
}
