/*
Simple definition file to prevent circular dependencies between MozelFactory and Mozel
 */

import Mozel, {MozelConstructor, MozelData} from "./Mozel";

export default interface MozelFactoryInterface {
	create<T extends Mozel>(ExpectedClass:MozelConstructor<T>, data?:MozelData<T>, root?:boolean, asReference?:boolean):T;
	destroy(mozel:Mozel):void;
}

export const MozelFactoryType = Symbol.for("MozelFactory");
