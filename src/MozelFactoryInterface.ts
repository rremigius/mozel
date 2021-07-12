/*
Simple definition file to prevent circular dependencies between MozelFactory and Mozel
 */

import Mozel, {MozelConstructor, MozelData} from "./Mozel";
import {Container} from "inversify";
import Registry from "./Registry";

export default interface MozelFactoryInterface {
	registry:Registry<Mozel>;

	create<T extends Mozel>(ExpectedClass:MozelConstructor<T>, data?:MozelData<T>, asReference?:boolean):T;
	createAndResolveReferences<T extends Mozel>(ExpectedClass:MozelConstructor<T>, data?:MozelData<T>):T;
	destroy(mozel:Mozel):void;
	readonly dependencies:Container;
}

export const MozelFactoryType = Symbol.for("MozelFactory");
