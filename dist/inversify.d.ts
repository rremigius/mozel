import "reflect-metadata";
import { Container } from "inversify";
import { ModelClass } from "@/Model";
/**
 * CLASS decorator factory
 * Registers the class to the default model DI Container, under the class name or static `type`.
 */
export declare function injectableModel(container?: Container): (Target: ModelClass) => void;
declare let modelContainer: Container;
export default modelContainer;
