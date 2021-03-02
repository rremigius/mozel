import "reflect-metadata";
import { Container } from "inversify";
import { MozelClass } from "@/Mozel";
/**
 * CLASS decorator factory
 * Registers the class to the default mozel DI Container, under the class name or static `type`.
 */
export declare function injectableMozel(container?: Container): (Target: MozelClass) => void;
declare let mozelContainer: Container;
export default mozelContainer;
