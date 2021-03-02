import Model, { ModelConstructor, ModelData } from "@/Model";
export default interface ModelFactoryInterface {
    create<T extends Model>(ExpectedClass: ModelConstructor<T>, data?: ModelData<T>, root?: boolean, asReference?: boolean): T;
    destroy(model: Model): void;
}
export declare const ModelFactoryType: unique symbol;
