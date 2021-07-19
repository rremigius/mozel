import { Server, Socket } from "socket.io";
import MozelSync from "./MozelSync";
import Mozel from "../../Mozel";
export default class MozelSyncServer {
    readonly io: Server;
    readonly isDefaultIO: boolean;
    readonly sync: MozelSync;
    readonly port: number;
    readonly destroyCallbacks: Function[];
    constructor(options?: {
        model?: Mozel;
        sync?: MozelSync;
        io?: Server | number;
    });
    start(): void;
    stop(): void;
    initUser(id: string, socket: Socket): void;
    removeUser(id: string): void;
    onUserConnected(id: string): void;
    onUserDisconnected(id: string): void;
    destroy(): void;
}
