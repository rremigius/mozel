import Mozel, { MozelConstructor, MozelData } from "./Mozel";
import { Container } from "inversify";
export default interface MozelFactoryInterface {
    create<T extends Mozel>(ExpectedClass: MozelConstructor<T>, data?: MozelData<T>, asReference?: boolean): T;
    createAndResolveReferences<T extends Mozel>(ExpectedClass: MozelConstructor<T>, data?: MozelData<T>): T;
    destroy(mozel: Mozel): void;
    readonly dependencies: Container;
}
export declare const MozelFactoryType: unique symbol;
