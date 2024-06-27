/*
Simple definition file to prevent circular dependencies between MozelFactory and Mozel
 */

import Mozel, {MozelConstructor, MozelData} from "./Mozel";
import {Container} from "inversify";
import Registry from "./Registry";

export default interface MozelFactoryInterface {
	registry:Registry<Mozel>;

	create<T extends Mozel>(ExpectedClass:MozelConstructor<T>, data?:MozelData<T>, init?:(mozel:T)=>void, root?:boolean):T;
	destroy(mozel:Mozel):void;
	readonly dependencies:Container;
}

export const MozelFactoryType = Symbol.for("MozelFactory");
