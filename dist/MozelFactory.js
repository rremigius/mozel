import { __decorate, __param } from "tslib";
import { Container, inject, injectable, optional } from "inversify";
import Registry from "@/Registry";
import Mozel from "@/Mozel";
import modelContainer from "@/inversify";
import { ModelFactoryType } from "@/MozelFactoryInterface";
let MozelFactory = class MozelFactory {
    constructor(diContainer, modelRegistry) {
        this.registry = modelRegistry || new Registry();
        this.diContainer = new Container({ autoBindInjectable: true });
        this.diContainer.parent = diContainer ? diContainer : modelContainer;
        // Set scoped globals
        this.diContainer.bind(ModelFactoryType).toConstantValue(this);
        this.diContainer.bind(Registry).toConstantValue(this.registry);
    }
    ensureUniqueGID(gid) {
        if (!gid || this.registry.byGid(gid)) {
            return this.nextGID();
        }
        return gid;
    }
    nextGID() {
        return this.registry.findMaxGid() + 1;
    }
    destroy(model) {
        this.registry.remove(model);
    }
    createSet(ExpectedClass, data) {
        const models = data.map(item => this.create(ExpectedClass, item));
        models.forEach(item => item.resolveReferences());
        return models;
    }
    /**
     * Creates a Model
     * If <T> matches ExpectedClass, is guaranteed to provide the correct class (or throw).
     *
     * Note: Factory has no knowledge of subclasses of Model (among other reasons to prevent circular dependencies).
     * @param {Class} ExpectedClass
     * @param {model} data
     * @param {boolean} root			Set to true if Model is root of its hierarchy and references should be resolved recursively after its creation.
     * @param {boolean} asReference		Set to true if the Model will only be a reference to another Model. It will not be registered.
     */
    create(ExpectedClass, data, root = false, asReference = false) {
        function isT(model) {
            return model instanceof ExpectedClass;
        }
        let model;
        try {
            if (data && data._type && this.diContainer.isBoundNamed(Mozel, data._type)) {
                // Try to get most specific class
                model = this.diContainer.getNamed(Mozel, data._type);
            }
            else if (ExpectedClass) {
                // Try to resolve exact class
                model = this.diContainer.resolve(ExpectedClass);
            }
            if (!model && ExpectedClass) {
                console.warn(`${ExpectedClass.type} dependency could not be resolved; using constructor directly.`);
                // DI failed; call exact class constructor
                model = new ExpectedClass();
            }
        }
        catch (e) {
            const message = `Model creation failed for ${ExpectedClass.type}: ${e.message}`;
            console.error(message, data);
            throw new Error(message);
        }
        if (!isT(model)) {
            const message = "Created Model was not a(n) " + ExpectedClass.name;
            console.error(message, data);
            throw new Error(message);
        }
        if (!model) {
            throw new Error("Could not instantiate Model. Unknown class or data _type.");
        }
        model.isReference = asReference;
        if (data) {
            model.setData(data, true);
        }
        // Register
        if (!model.gid) {
            model.gid = this.nextGID();
        }
        if (!model.isReference) {
            this.registry.register(model);
        }
        if (root && !model.isReference) {
            model.resolveReferences();
        }
        return model;
    }
};
MozelFactory = __decorate([
    injectable(),
    __param(0, inject('container')), __param(0, optional()),
    __param(1, inject(Registry)), __param(1, optional())
], MozelFactory);
export default MozelFactory;
//# sourceMappingURL=MozelFactory.js.map