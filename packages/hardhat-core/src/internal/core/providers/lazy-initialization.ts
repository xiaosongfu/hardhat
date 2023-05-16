import { EventEmitter } from "events";
import {
  EthereumProvider,
  JsonRpcRequest,
  JsonRpcResponse,
  RequestArguments,
} from "../../../types";

export type ProviderFactory = () => Promise<EthereumProvider>;
export type Listener = (...args: any[]) => void;

/**
 * A class that delays the (async) creation of its internal provider until the first call
 * to a JSON RPC method via request/send/sendAsync.
 * Trying to use the EventEmitter API without calling request first (initializing the provider)
 * will throw.
 */
export class LazyInitializationProvider implements EthereumProvider {
  protected provider: EthereumProvider | undefined;
  private _emitter: EventEmitter = new EventEmitter();

  constructor(private _providerFactory: ProviderFactory) {}

  // Provider methods

  public async request(args: RequestArguments): Promise<unknown> {
    await this._initProvider();
    return this.provider!.request(args);
  }

  public async send(method: string, params?: any[]): Promise<any> {
    await this._initProvider();
    return this.provider!.send(method, params);
  }

  public sendAsync(
    payload: JsonRpcRequest,
    callback: (error: any, response: JsonRpcResponse) => void
  ): void {
    this._initProvider().then(
      () => {
        this.provider!.sendAsync(payload, callback);
      },
      (e) => {
        callback(e, null as any);
      }
    );
  }

  // EventEmitter methods

  public addListener(event: string | symbol, listener: EventListener): this {
    this._getEmitter().addListener(event, listener);
    return this;
  }

  public on(event: string | symbol, listener: EventListener): this {
    this._getEmitter().on(event, listener);
    return this;
  }

  public once(
    event: string | symbol,
    listener: (...args: any[]) => void
  ): this {
    this._getEmitter().once(event, listener);
    return this;
  }

  public prependListener(
    event: string | symbol,
    listener: (...args: any[]) => void
  ): this {
    this._getEmitter().prependListener(event, listener);
    return this;
  }

  public prependOnceListener(
    event: string | symbol,
    listener: (...args: any[]) => void
  ): this {
    this._getEmitter().prependOnceListener(event, listener);
    return this;
  }

  public removeListener(
    event: string | symbol,
    listener: (...args: any[]) => void
  ): this {
    this._getEmitter().removeListener(event, listener);
    return this;
  }

  public off(event: string | symbol, listener: (...args: any[]) => void): this {
    this._getEmitter().off(event, listener);
    return this;
  }

  public removeAllListeners(event?: string | symbol | undefined): this {
    this._getEmitter().removeAllListeners(event);
    return this;
  }

  public setMaxListeners(n: number): this {
    this._getEmitter().setMaxListeners(n);
    return this;
  }

  public getMaxListeners(): number {
    return this._getEmitter().getMaxListeners();
  }

  // disable ban-types to satisfy the EventEmitter interface
  // eslint-disable-next-line @typescript-eslint/ban-types
  public listeners(event: string | symbol): Function[] {
    return this._getEmitter().listeners(event);
  }

  // disable ban-types to satisfy the EventEmitter interface
  // eslint-disable-next-line @typescript-eslint/ban-types
  public rawListeners(event: string | symbol): Function[] {
    return this._getEmitter().rawListeners(event);
  }

  public emit(event: string | symbol, ...args: any[]): boolean {
    return this._getEmitter().emit(event, ...args);
  }

  public eventNames(): Array<string | symbol> {
    return this._getEmitter().eventNames();
  }

  public listenerCount(type: string | symbol): number {
    return this._getEmitter().listenerCount(type);
  }

  private _getEmitter(): EventEmitter {
    return this.provider === undefined ? this._emitter : this.provider;
  }

  private async _initProvider(): Promise<void> {
    if (this.provider === undefined) {
      this.provider = await this._providerFactory();

      // Copy any event emitter events before initialization over to the provider
      const recordedEvents = this._emitter.eventNames();

      for (const event of recordedEvents) {
        const listeners = this._emitter.rawListeners(event) as Listener[];
        for (const listener of listeners) {
          this.provider.on(event, listener);
          this._emitter.removeListener(event, listener);
        }
      }

      this.provider.setMaxListeners(this._emitter.getMaxListeners());
    }
  }
}