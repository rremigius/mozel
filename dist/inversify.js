import "reflect-metadata";
import { Container, injectable } from "inversify";
import Mozel from "@/Mozel";
/**
 * Registers the class to the default model DI Container, under the class name or static `type`.
 * @param {ModelClass} Target
 * @param {interfaces.Container} container
 */
function bindModelType(Target, container) {
    let type;
    if (Target.hasOwnProperty('type')) {
        type = Target.type;
    }
    else {
        type = Target.name;
        console.warn(`No 'type' getter defined for ${Target.name}. Using class name, which is not always reliable.`);
    }
    container.bind(Mozel).to(Target).whenTargetNamed(type);
}
/**
 * CLASS decorator factory
 * Registers the class to the default model DI Container, under the class name or static `type`.
 */
export function injectableModel(container) {
    return function (Target) {
        if (!container)
            container = modelContainer;
        injectable()(Target);
        bindModelType(Target, container);
    };
}
let modelContainer = new Container({ autoBindInjectable: true });
export default modelContainer;
//# sourceMappingURL=inversify.js.map