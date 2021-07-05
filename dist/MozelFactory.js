var MozelFactory_1;
import { __decorate, __param } from "tslib";
import { Container, inject, injectable, optional } from "inversify";
import Registry from "./Registry";
import Mozel from "./Mozel";
import { MozelFactoryType } from "./MozelFactoryInterface";
import logRoot from "./log";
import { isArray } from "lodash";
const log = logRoot.instance("factory");
let MozelFactory = MozelFactory_1 = class MozelFactory {
    constructor(dependencies, mozelRegistry) {
        this.registry = mozelRegistry || new Registry();
        this.localDependencies = MozelFactory_1.createDependencyContainer();
        if (dependencies) {
            this.dependencies = dependencies;
            this.dependencies.parent = this.localDependencies;
        }
        else {
            this.dependencies = this.localDependencies;
        }
        // Set scoped globals
        this.localDependencies.bind(MozelFactoryType).toConstantValue(this);
        this.localDependencies.bind(Registry).toConstantValue(this.registry);
        this.initDependencies();
    }
    static createDependencyContainer() {
        return new Container({ autoBindInjectable: true });
    }
    // For override
    initDependencies() { }
    /**
     * Registers the class to the default mozel DI Container, under the class name or static `type`.
     * @param {MozelClass} MozelClass
     */
    register(MozelClass) {
        if (isArray(MozelClass)) {
            for (let Class of MozelClass) {
                this.register(Class);
            }
            return;
        }
        let type;
        if (MozelClass.hasOwnProperty('type')) {
            type = MozelClass.type;
        }
        else {
            type = MozelClass.name;
        }
        this.localDependencies.bind(Mozel).to(MozelClass).whenTargetNamed(type);
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
    destroy(mozel) {
        this.registry.remove(mozel);
    }
    createSet(ExpectedClass, data) {
        const mozels = data.map(item => this.create(ExpectedClass, item));
        mozels.forEach(item => item.$resolveReferences());
        return mozels;
    }
    /**
     * Creates a Mozel
     * If <T> matches ExpectedClass, is guaranteed to provide the correct class (or throw).
     *
     * Note: Factory has no knowledge of subclasses of Mozel (among other reasons to prevent circular dependencies).
     * @param {Class} ExpectedClass
     * @param {mozel} data
     * @param {boolean} asReference		Set to true if the Mozel will only be a reference to another Mozel. It will not be registered.
     */
    create(ExpectedClass, data, asReference = false) {
        function isT(mozel) {
            return mozel instanceof ExpectedClass;
        }
        let mozel;
        try {
            if (data && data._type && this.dependencies.isBoundNamed(Mozel, data._type)) {
                // Try to get most specific class
                mozel = this.dependencies.getNamed(Mozel, data._type);
            }
            else if (ExpectedClass) {
                // Try to resolve class from dependencies
                mozel = this.dependencies.get(ExpectedClass);
            }
            if (!mozel && ExpectedClass) {
                log.warn(`${ExpectedClass.type} dependency could not be resolved; using constructor directly.`);
                // DI failed; call exact class constructor
                mozel = new ExpectedClass();
            }
        }
        catch (e) {
            const message = `Mozel creation failed for ${ExpectedClass.type}: ${e.message}`;
            log.error(message, data);
            throw new Error(message);
        }
        if (!isT(mozel)) {
            const message = "Created Mozel was not a(n) " + ExpectedClass.name;
            log.error(message, data);
            throw new Error(message);
        }
        if (!mozel) {
            throw new Error("Could not instantiate Mozel. Unknown class or data _type.");
        }
        mozel.$isReference = asReference;
        if (data) {
            mozel.$setData(data);
        }
        // Register
        if (!mozel.gid) {
            mozel.gid = this.nextGID();
        }
        if (!mozel.$isReference) {
            this.registry.register(mozel);
        }
        return mozel;
    }
    createAndResolveReferences(ExpectedClass, data) {
        const mozel = this.create(ExpectedClass, data);
        mozel.$resolveReferences();
        return mozel;
    }
};
MozelFactory = MozelFactory_1 = __decorate([
    injectable(),
    __param(0, inject('container')), __param(0, optional()),
    __param(1, inject(Registry)), __param(1, optional())
], MozelFactory);
export default MozelFactory;
//# sourceMappingURL=MozelFactory.js.map