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
        this.dependencies = dependencies || MozelFactory_1.createDependencyContainer();
        this.localDependencies = MozelFactory_1.createDependencyContainer();
        this.localDependencies.parent = this.dependencies;
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
    bind(serviceIdentifier) {
        return this.localDependencies.bind(serviceIdentifier);
    }
    destroy(mozel) {
        this.registry.remove(mozel);
    }
    createSet(ExpectedClass, data) {
        return data.map(item => this.create(ExpectedClass, item, true));
    }
    /**
     * Alias for `create`, with `root = true`
     * @param ExpectedClass
     * @param data
     */
    createRoot(ExpectedClass, data) {
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
    create(ExpectedClass, data, root = false) {
        function isT(mozel) {
            return mozel instanceof ExpectedClass;
        }
        let mozel;
        try {
            if (data && data._type && this.localDependencies.isBoundNamed(Mozel, data._type)) {
                // Try to get most specific class
                mozel = this.localDependencies.getNamed(Mozel, data._type);
            }
            else if (ExpectedClass) {
                // Try to resolve class from dependencies
                mozel = this.localDependencies.get(ExpectedClass);
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
        if (data) {
            mozel.$setData(data);
        }
        mozel.$root = root;
        // Register
        this.registry.register(mozel);
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