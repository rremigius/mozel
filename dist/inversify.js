import "reflect-metadata";
import { Container, injectable } from "inversify";
import Model from "@/Model";
/**
 * Registers the class to the default model DI Container, under the class name or static `type`.
 * @param {ModelClass} Target
 * @param {interfaces.Container} container
 */
function bindModelType(Target, container) {
    if (!Target.hasOwnProperty('type')) {
        console.warn(`No 'type' getter defined for ${Target.name}. Cannot bind Model dependency.`);
        return;
    }
    container.bind(Model).to(Target).whenTargetNamed(Target.type);
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