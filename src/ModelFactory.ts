import {Container, inject, injectable, optional} from "inversify";
import {Class} from "validation-kit";
import Registry from "@/Registry";
import Model, {ModelConstructor, ModelData} from "@/Model";
import modelContainer from "@/inversify";
import {alphanumeric} from "validation-kit";
import ModelFactoryInterface, {ModelFactoryType} from "@/ModelFactoryInterface";

@injectable()
export default class ModelFactory implements ModelFactoryInterface {

	// If not set in constructor params, will be set in constructor. And readonly, so will always have value.
	readonly diContainer:Container;
	readonly registry:Registry<Model>;

	constructor(
		@inject('container') @optional() diContainer?:Container,
		@inject(Registry) @optional() modelRegistry?:Registry<Model>
	) {
		this.registry = modelRegistry || new Registry<Model>();

		this.diContainer = new Container({autoBindInjectable:true});
		this.diContainer.parent = diContainer ? diContainer : modelContainer;

		// Set scoped globals
		this.diContainer.bind(ModelFactoryType).toConstantValue(this);
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

	destroy(model:Model) {
		this.registry.remove(model);
	}

	/**
	 * Creates a Model
	 * If <T> matches ExpectedClass, is guaranteed to provide the correct class (or throw).
	 *
	 * Note: Factory has no knowledge of subclasses of Model (among other reasons to prevent circular dependencies).
	 * @param {Class} ExpectedClass
	 * @param {model} data
	 * @param {boolean} root					Set to true if Model is root of its hierarchy and references should be resolved recursively after its creation.
	 * @param {boolean} asReference		Set to true if the Model will only be a reference to another Model. It will not be registered.
	 */
	create<T extends Model>(ExpectedClass:ModelConstructor<T>, data?:ModelData<T>, root:boolean = false, asReference:boolean = false) {
		function isT(model:any) : model is T {
			return model instanceof ExpectedClass;
		}

		let model;
		try {
			if (data && data._type && this.diContainer.isBoundNamed(Model, data._type)) {
				// Try to get most specific class
				model = this.diContainer.getNamed<Model>(Model, data._type);
			} else if (ExpectedClass) {
				// Try to resolve exact class
				model = this.diContainer.resolve<Model>(ExpectedClass);
			}
			if(!model && ExpectedClass) {
				console.warn(`${ExpectedClass.type} dependency could not be resolved; using constructor directly.`);
				// DI failed; call exact class constructor
				model = new ExpectedClass();
			}
		} catch(e) {
			const message = `Model creation failed for ${ExpectedClass.type}: ${e.message}`;
			console.error(message, data);
			throw new Error(message);
		}

		if(!isT(model)) {
			const message = "Created Model was not a(n) " + ExpectedClass.name;
			console.error(message, data);
			throw new Error(message);
		}

		if(!model) {
			throw new Error("Could not instantiate Model. Unknown class or data _type.");
		}

		model.isReference = asReference;

		if(data) {
			model.setData(data, true);
		}

		// Register
		if(!model.gid) {
			model.gid = this.nextGID();
		}
		if(!model.isReference) {
			this.registry.register(model);
		}

		if(root && !model.isReference) {
			model.resolveReferences();
		}

		return model;
	}
}
