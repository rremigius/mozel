import "reflect-metadata";

import {Container, injectable, interfaces} from "inversify";
import Model, {Data, ModelClass} from "@/Model";

/**
 * Registers the class to the default model DI Container, under the class name or static `type`.
 * @param {ModelClass} Target
 * @param {interfaces.Container} container
 */
function bindModelType(Target:ModelClass, container:interfaces.Container) {
	let type;
	if(Target.hasOwnProperty('type')) {
		type = Target.type;
	} else {
		type = Target.name;
		console.warn(`No 'type' getter defined for ${Target.name}. Using class name, which is not always reliable.`);
	}
	container.bind<Model>(Model).to(Target).whenTargetNamed(type);
}

/**
 * CLASS decorator factory
 * Registers the class to the default model DI Container, under the class name or static `type`.
 */
export function injectableModel(container?:Container) {
	return function(Target:ModelClass) {
		if(!container) container = modelContainer;
		injectable()(Target);
		bindModelType(Target, container);
	};
}

let modelContainer = new Container({autoBindInjectable:true});

export default modelContainer;
