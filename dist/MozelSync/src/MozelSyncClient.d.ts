import { Socket } from "socket.io-client";
import MozelSync from "./MozelSync";
import Mozel from "../../Mozel";
export default class MozelSyncClient {
    readonly io: Socket;
    readonly isDefaultIO: boolean;
    readonly sync: MozelSync;
    private connecting;
    private destroyCallbacks;
    constructor(options?: {
        model?: Mozel;
        sync?: MozelSync;
        socket?: Socket | number;
    });
    initIO(): void;
    start(): Promise<void>;
    connect(): Promise<unknown>;
    disconnect(): void;
    onConnected(id: string): void;
    onDisconnected(id: string): void;
    destroy(): void;
    onDestroy(): void;
}
