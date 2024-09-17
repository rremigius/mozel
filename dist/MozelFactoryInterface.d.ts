import Mozel, { MozelConfig, MozelConstructor, MozelData } from "./Mozel";
import { Container } from "inversify";
import Registry from "./Registry";
export default interface MozelFactoryInterface {
    registry: Registry<Mozel>;
    create<T extends Mozel>(ExpectedClass: MozelConstructor<T>, data?: MozelData<T>, config?: MozelConfig<T>, root?: boolean): T;
    destroy(mozel: Mozel): void;
    readonly dependencies: Container;
}
export declare const MozelFactoryType: unique symbol;
