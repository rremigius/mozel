import "reflect-metadata";

import {Container, injectable, interfaces} from "inversify";
import Mozel, {MozelClass} from "./Mozel";

import logRoot from "./log";

const log = logRoot.instance("mozel/injection");

/**
 * Registers the class to the default mozel DI Container, under the class name or static `type`.
 * @param {MozelClass} Target
 * @param {interfaces.Container} container
 */
function bindMozelType(Target:MozelClass, container:interfaces.Container) {
	let type;
	if(Target.hasOwnProperty('type')) {
		type = Target.type;
	} else {
		type = Target.name;
		log.warn(`No 'type' getter defined for ${Target.name}. Using class name, which is not always reliable.`);
	}
	container.bind<Mozel>(Mozel).to(Target).whenTargetNamed(type);
}

/**
 * CLASS decorator factory
 * Registers the class to the default mozel DI Container, under the class name or static `type`.
 */
export function injectableMozel(container?:Container) {
	return function(Target:MozelClass) {
		if(!container) container = mozelContainer;
		injectable()(Target);
		bindMozelType(Target, container);
	};
}

let mozelContainer = new Container({autoBindInjectable:true});

export default mozelContainer;
