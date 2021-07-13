import {Container, inject, injectable, optional} from "inversify";
import {alphanumeric, Class} from "validation-kit";
import Registry from "./Registry";
import Mozel, {MozelClass, MozelConstructor, MozelData} from "./Mozel";
import MozelFactoryInterface, {MozelFactoryType} from "./MozelFactoryInterface";
import logRoot from "./log";
import {isArray} from "lodash";

const log = logRoot.instance("factory");

@injectable()
export default class MozelFactory implements MozelFactoryInterface {

	static createDependencyContainer() {
		return new Container({autoBindInjectable:true});
	}

	// If not set in constructor params, will be set in constructor. And readonly, so will always have value.
	readonly dependencies:Container;
	readonly localDependencies:Container;
	readonly registry:Registry<Mozel>;

	constructor(
		@inject('container') @optional() dependencies?:Container,
		@inject(Registry) @optional() mozelRegistry?:Registry<Mozel>
	) {
		this.registry = mozelRegistry || new Registry<Mozel>();

		this.dependencies = dependencies || MozelFactory.createDependencyContainer();
		this.localDependencies = MozelFactory.createDependencyContainer();
		this.localDependencies.parent = this.dependencies;

		// Set scoped globals
		this.localDependencies.bind(MozelFactoryType).toConstantValue(this);
		this.localDependencies.bind(Registry).toConstantValue(this.registry);

		this.initDependencies();
	}

	// For override
	initDependencies() { }

	/**
	 * Registers the class to the default mozel DI Container, under the class name or static `type`.
	 * @param {MozelClass} MozelClass
	 */
	register(MozelClass:(typeof Mozel)|(typeof Mozel)[]) {
		if(isArray(MozelClass)) {
			for(let Class of MozelClass) {
				this.register(Class);
			}
			return;
		}
		let type;
		if(MozelClass.hasOwnProperty('type')) {
			type = MozelClass.type;
		} else {
			type = MozelClass.name;
		}
		this.localDependencies.bind<Mozel>(Mozel).to(MozelClass).whenTargetNamed(type);
	}

	ensureUniqueGID(gid:alphanumeric) {
		if(!gid || this.registry.byGid(gid)) {
			return this.nextGID();
		}
		return gid;
	}

	nextGID() {
		return this.registry.findMaxGid() + 1;
	}

	destroy(mozel:Mozel) {
		this.registry.remove(mozel);
	}

	createSet<T extends Mozel>(ExpectedClass:MozelConstructor<T>, data:MozelData<T>[]) {
		return data.map(item => this.create<T>(ExpectedClass, item, true));
	}

	/**
	 * Alias for `create`, with `root = true`
	 * @param ExpectedClass
	 * @param data
	 */
	createRoot<T extends Mozel>(ExpectedClass:MozelConstructor<T>, data?:MozelData<T>) {
		return this.create(ExpectedClass, data, true);
	}

	/**
	 * Creates a Mozel
	 * If <T> matches ExpectedClass, is guaranteed to provide the correct class (or throw).
	 *
	 * Note: Factory has no knowledge of subclasses of Mozel (among other reasons to prevent circular dependencies).
	 * @param {Class} ExpectedClass
	 * @param {mozel} data
	 * @param {boolean} root			Unless set to true, orphaned Mozels will destroy themselves.
	 */
	create<T extends Mozel>(ExpectedClass:MozelConstructor<T>, data?:MozelData<T>, root = false) {
		function isT(mozel:any) : mozel is T {
			return mozel instanceof ExpectedClass;
		}

		let mozel;
		try {
			if (data && data._type && this.localDependencies.isBoundNamed(Mozel, data._type)) {
				// Try to get most specific class
				mozel = this.localDependencies.getNamed<Mozel>(Mozel, data._type);
			} else if (ExpectedClass) {
				// Try to resolve class from dependencies
				mozel = this.localDependencies.get<Mozel>(ExpectedClass);
			}
			if(!mozel && ExpectedClass) {
				log.warn(`${ExpectedClass.type} dependency could not be resolved; using constructor directly.`);
				// DI failed; call exact class constructor
				mozel = new ExpectedClass();
			}
		} catch(e) {
			const message = `Mozel creation failed for ${ExpectedClass.type}: ${e.message}`;
			log.error(message, data);
			throw new Error(message);
		}

		if(!isT(mozel)) {
			const message = "Created Mozel was not a(n) " + ExpectedClass.name;
			log.error(message, data);
			throw new Error(message);
		}

		if(!mozel) {
			throw new Error("Could not instantiate Mozel. Unknown class or data _type.");
		}

		if(data) {
			mozel.$setData(data);
		}
		mozel.$root = root;

		// Register
		if(!mozel.gid) {
			mozel.gid = this.nextGID();
		}
		this.registry.register(mozel);

		return mozel;
	}
}
