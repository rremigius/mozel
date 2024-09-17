import Mozel from "./Mozel";

export default Mozel;

export {
	property,
	alphanumeric,
	Alphanumeric,
	deep,
	reference,
	required,
	immediate,
	LogLevel,
	PropertyKeys,
	schema,
	PropertySchema,
	MozelSchema,
	ChangedEvent,
	DestroyedEvent
} from './Mozel';

export { default as Collection } from "./Collection"
export { default as MozelFactory } from "./MozelFactory"
export { default as GenericMozel } from "./GenericMozel"
export { default as Registry } from "./Registry"
export { default as Template } from "./Templater"

import {property} from "./Mozel"
import MozelFactory from "./MozelFactory";

class Foo extends Mozel {
	@property(String)
	foo?:string;
}

const factory = new MozelFactory();
const mozel = factory.create(Foo, {foo: "asd"});