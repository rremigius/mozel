import {Container, inject, injectable, optional} from "inversify";
import {Class} from "validation-kit";
import Registry from "@/Registry";
import Mozel, {MozelConstructor, MozelData} from "@/Mozel";
import mozelContainer from "@/inversify";
import {alphanumeric} from "validation-kit";
import MozelFactoryInterface, {MozelFactoryType} from "@/MozelFactoryInterface";

@injectable()
export default class MozelFactory implements MozelFactoryInterface {

	static createDependencyContainer() {
		return new Container({autoBindInjectable:true});
	}

	// If not set in constructor params, will be set in constructor. And readonly, so will always have value.
	readonly diContainer:Container;
	readonly registry:Registry<Mozel>;

	constructor(
		@inject('container') @optional() diContainer?:Container,
		@inject(Registry) @optional() mozelRegistry?:Registry<Mozel>
	) {
		this.registry = mozelRegistry || new Registry<Mozel>();

		this.diContainer = MozelFactory.createDependencyContainer();
		this.diContainer.parent = diContainer ? diContainer : mozelContainer;

		// Set scoped globals
		this.diContainer.bind(MozelFactoryType).toConstantValue(this);
		this.diContainer.bind(Registry).toConstantValue(this.registry);
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
		const mozels = data.map(item => this.create<T>(ExpectedClass, item));
		mozels.forEach(item => item.resolveReferences());
		return mozels;
	}

	/**
	 * Creates a Mozel
	 * If <T> matches ExpectedClass, is guaranteed to provide the correct class (or throw).
	 *
	 * Note: Factory has no knowledge of subclasses of Mozel (among other reasons to prevent circular dependencies).
	 * @param {Class} ExpectedClass
	 * @param {mozel} data
	 * @param {boolean} root			Set to true if Mozel is root of its hierarchy and references should be resolved recursively after its creation.
	 * @param {boolean} asReference		Set to true if the Mozel will only be a reference to another Mozel. It will not be registered.
	 */
	create<T extends Mozel>(ExpectedClass:MozelConstructor<T>, data?:MozelData<T>, root:boolean = false, asReference:boolean = false) {
		function isT(mozel:any) : mozel is T {
			return mozel instanceof ExpectedClass;
		}

		let mozel;
		try {
			if (data && data._type && this.diContainer.isBoundNamed(Mozel, data._type)) {
				// Try to get most specific class
				mozel = this.diContainer.getNamed<Mozel>(Mozel, data._type);
			} else if (ExpectedClass) {
				// Try to resolve exact class
				mozel = this.diContainer.resolve<Mozel>(ExpectedClass);
			}
			if(!mozel && ExpectedClass) {
				console.warn(`${ExpectedClass.type} dependency could not be resolved; using constructor directly.`);
				// DI failed; call exact class constructor
				mozel = new ExpectedClass();
			}
		} catch(e) {
			const message = `Mozel creation failed for ${ExpectedClass.type}: ${e.message}`;
			console.error(message, data);
			throw new Error(message);
		}

		if(!isT(mozel)) {
			const message = "Created Mozel was not a(n) " + ExpectedClass.name;
			console.error(message, data);
			throw new Error(message);
		}

		if(!mozel) {
			throw new Error("Could not instantiate Mozel. Unknown class or data _type.");
		}

		mozel.isReference = asReference;

		if(data) {
			mozel.setData(data, true);
		}

		// Register
		if(!mozel.gid) {
			mozel.gid = this.nextGID();
		}
		if(!mozel.isReference) {
			this.registry.register(mozel);
		}

		if(root && !mozel.isReference) {
			mozel.resolveReferences();
		}

		return mozel;
	}
}
