/*
Simple definition file to prevent circular dependencies between ModelFactory and Model
 */

import Mozel, {MozelConstructor, MozelData} from "@/Mozel";

export default interface MozelFactoryInterface {
	create<T extends Mozel>(ExpectedClass:MozelConstructor<T>, data?:MozelData<T>, root?:boolean, asReference?:boolean):T;
	destroy(model:Mozel):void;
}

export const ModelFactoryType = Symbol.for("ModelFactory");
