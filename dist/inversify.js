import "reflect-metadata";
import { Container, injectable } from "inversify";
import Mozel from "@/Mozel";
/**
 * Registers the class to the default mozel DI Container, under the class name or static `type`.
 * @param {MozelClass} Target
 * @param {interfaces.Container} container
 */
function bindMozelType(Target, container) {
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
 * Registers the class to the default mozel DI Container, under the class name or static `type`.
 */
export function injectableMozel(container) {
    return function (Target) {
        if (!container)
            container = mozelContainer;
        injectable()(Target);
        bindMozelType(Target, container);
    };
}
let mozelContainer = new Container({ autoBindInjectable: true });
export default mozelContainer;
//# sourceMappingURL=inversify.js.map