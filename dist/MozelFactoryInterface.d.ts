import Mozel, { MozelConstructor, MozelData } from "./Mozel";
export default interface MozelFactoryInterface {
    create<T extends Mozel>(ExpectedClass: MozelConstructor<T>, data?: MozelData<T>, root?: boolean, asReference?: boolean): T;
    destroy(mozel: Mozel): void;
}
export declare const MozelFactoryType: unique symbol;
