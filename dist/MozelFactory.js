var MozelFactory_1;
import { __decorate, __param } from "tslib";
import { Container, inject, injectable, optional } from "inversify";
import Registry from "./Registry";
import Mozel from "./Mozel";
import { MozelFactoryType } from "./MozelFactoryInterface";
import logRoot from "./log";
import { isArray } from "lodash";
const log = logRoot.instance("factory");
let MozelFactory = class MozelFactory {
    static { MozelFactory_1 = this; }
    static defaultInstance = new MozelFactory_1();
    static default() {
        return this.defaultInstance;
    }
    static createDependencyContainer() {
        return new Container({ autoBindInjectable: true });
    }
    // If not set in constructor params, will be set in constructor. And readonly, so will always have value.
    dependencies;
    localDependencies;
    registry;
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
    // For override
    initDependencies() { }
    /**
     * Registers the class to the default mozel DI Container, under the class name or static `type`.
     * @param {MozelClass} MozelClass
     * @param {string} [type]			The type for which to register the class. When initializing mozels from raw data,
     * 									the `_type` property will match against the registered types of the mozels to
     * 									find a suitable candidate for instantiation. If left empty, will default to
     * 									the `type()` getter of the class or the class name.
     */
    register(MozelClass, type) {
        if (isArray(MozelClass)) {
            for (let Class of MozelClass) {
                this.register(Class);
            }
            return;
        }
        if (type === undefined) {
            if (MozelClass.hasOwnProperty('type')) {
                type = MozelClass.type;
            }
            else {
                type = MozelClass.name;
            }
        }
        this.localDependencies.bind(Mozel).to(MozelClass).whenTargetNamed(type);
    }
    bind(serviceIdentifier) {
        return this.localDependencies.bind(serviceIdentifier);
    }
    destroy(mozel) {
        this.registry.remove(mozel);
    }
    createSet(ExpectedClass, data, init) {
        return data.map(item => this.create(ExpectedClass, item, init, true));
    }
    /**
     * Alias for `create`, with `root = true`
     * @param ExpectedClass
     * @param data
     * @param config
     */
    createRoot(ExpectedClass, data, config) {
        return this.create(ExpectedClass, data, config, true);
    }
    /**
     * Creates a Mozel
     * If <T> matches ExpectedClass, is guaranteed to provide the correct class (or throw).
     *
     * Note: Factory has no knowledge of subclasses of Mozel (among other reasons to prevent circular dependencies).
     * @param {Class} ExpectedClass		Class to instantiate
     * @param {mozel} data				Data to fill the Mozel
     * @param {MozelConfig} config		Config for Mozel to be set before data
     * @param {boolean} root			Unless set to true, orphaned Mozels will destroy themselves.
     */
    create(ExpectedClass, data, config, root = false) {
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
            if (!(e instanceof Error)) {
                log.error("Unknown error occurred:", e);
                throw new Error("Unknown error occurred.");
            }
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
        if (config) {
            mozel.$setConfig(config);
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
    __param(0, inject('container')),
    __param(0, optional()),
    __param(1, inject(Registry)),
    __param(1, optional())
], MozelFactory);
export default MozelFactory;
//# sourceMappingURL=MozelFactory.js.map