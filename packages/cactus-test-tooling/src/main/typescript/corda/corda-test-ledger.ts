import { EventEmitter } from "events";

import { Config as SshConfig } from "node-ssh";
import Docker, { Container, ContainerInfo } from "dockerode";
import Joi from "joi";

import { ITestLedger } from "../i-test-ledger";
import { Containers } from "../common/containers";

import {
  LogLevelDesc,
  Logger,
  LoggerProvider,
  Checks,
} from "@hyperledger/cactus-common";

/*
 * Contains options for Corda container
 */
export interface ICordaTestLedgerConstructorOptions {
  containerImageVersion?: string;
  containerImageName?: string;
  rpcPortA?: number;
  rpcPortB?: number;
  braidPortA?: number;
  braidPortB?: number;
  logLevel?: LogLevelDesc;
}

/*
 * Provides default options for Corda container
 */
export const CORDA_TEST_LEDGER_DEFAULT_OPTIONS = Object.freeze({
  containerImageVersion: "latest",
  containerImageName: "hyperledger/corda-all-in-one",
  rpcPortA: 10013,
  rpcPortB: 10014,
  braidPortA: 8081,
  braidPortB: 8082,
});

/*
 * Provides validations for the Corda container's options
 */
export const CORDA_TEST_LEDGER_OPTIONS_JOI_SCHEMA: Joi.Schema = Joi.object().keys(
  {
    containerImageVersion: Joi.string().min(5).required(),
    containerImageName: Joi.string().min(1).required(),
    rpcPortA: Joi.number().min(1).max(65535).required(),
    rpcPortB: Joi.number().min(1).max(65535).required(),
    braidPortA: Joi.number().min(1).max(65535).required(),
    braidPortB: Joi.number().min(1).max(65535).required(),
  }
);

export class CordaTestLedger implements ITestLedger {
  public static readonly CLASS_NAME = "CordaTestLedger";

  private readonly log: Logger;

  public get className() {
    return CordaTestLedger.CLASS_NAME;
  }

  public readonly containerImageVersion: string;
  public readonly containerImageName: string;
  public readonly rpcPortA: number;
  public readonly rpcPortB: number;
  public readonly braidPortA: number;
  public readonly braidPortB: number;

  private container: Container | undefined;

  constructor(
    public readonly options: ICordaTestLedgerConstructorOptions = {}
  ) {
    const fnTag = `${this.className}#constructor()`;
    Checks.truthy(options, `${fnTag} options`);

    this.containerImageVersion =
      options.containerImageVersion ||
      CORDA_TEST_LEDGER_DEFAULT_OPTIONS.containerImageVersion;
    this.containerImageName =
      options.containerImageName ||
      CORDA_TEST_LEDGER_DEFAULT_OPTIONS.containerImageName;

    this.rpcPortA =
      options.rpcPortA || CORDA_TEST_LEDGER_DEFAULT_OPTIONS.rpcPortA;

    this.rpcPortB =
      options.rpcPortB || CORDA_TEST_LEDGER_DEFAULT_OPTIONS.rpcPortB;

    this.braidPortA =
      options.braidPortA || CORDA_TEST_LEDGER_DEFAULT_OPTIONS.braidPortA;

    this.braidPortB =
      options.braidPortB || CORDA_TEST_LEDGER_DEFAULT_OPTIONS.braidPortB;

    this.validateConstructorOptions();
    const label = "corda-test-ledger";
    const level = options.logLevel || "INFO";
    this.log = LoggerProvider.getOrCreate({ level, label });
  }

  public async start(skipPull: boolean = false): Promise<Container> {
    const containerNameAndTag = this.getContainerImageName();

    if (this.container) {
      await this.container.stop();
      await this.container.remove();
    }
    const docker = new Docker();

    if (!skipPull) {
      await Containers.pullImage(containerNameAndTag);
    }

    return new Promise<Container>((resolve, reject) => {
      const eventEmitter: EventEmitter = docker.run(
        containerNameAndTag,
        [],
        [],
        {
          // TODO: scrutinize this and eliminate needing root if possible
          // (might not be possible due to something with Corda itself, but we have to investigate)
          User: "root",
          ExposedPorts: {
            [`${this.rpcPortA}/tcp`]: {}, // corda PartyA RPC
            "22/tcp": {}, // ssh server
            "20013/tcp": {}, // node ssh
            "7005/tcp": {}, // Party A - Jolokia
            "7006/tcp": {}, // Party B - Jolokia
          },
          // will allocate random port on host and then we can use the getRpcAHostPort() method to determine
          // what that port exactly is. This is a workaround needed for macOS which has issues with routing to docker
          // container's IP addresses directly...
          // https://stackoverflow.com/a/39217691
          PublishAllPorts: true,
        },
        {},
        (err: any) => {
          if (err) {
            reject(err);
          }
        }
      );

      eventEmitter.once("start", async (container: Container) => {
        this.container = container;
        try {
          let isHealthy: boolean = false;
          do {
            const containerInfo = await this.getContainerInfo();
            this.log.debug(`ContainerInfo.Status=%o`, containerInfo.Status);
            this.log.debug(`ContainerInfo.State=%o`, containerInfo.State);
            isHealthy = containerInfo.Status.endsWith("(healthy)");
            if (!isHealthy) {
              await new Promise((resolve2) => setTimeout(resolve2, 1000));
            }
          } while (!isHealthy);
          resolve(container);
        } catch (ex) {
          reject(ex);
        }
      });
    });
  }

  public async logDebugPorts(): Promise<void> {
    this.log.debug(`Querying public Jolokia ports for party A,B...`);
    const partyAJolokiaPort = await this.getJolokiaAPublicPort();
    const httpUrlA = `http://127.0.0.1:${partyAJolokiaPort}/jolokia/`;
    this.log.info(`Party A Node Jolokia accessible: %o`, httpUrlA);

    const partyBJolokiaPort = await this.getJolokiaBPublicPort();
    const httpUrlB = `http://127.0.0.1:${partyBJolokiaPort}/jolokia/`;
    this.log.info(`Party B Node Jolokia accessible: %o`, httpUrlB);

    const hawtIoPublicPort = await this.getHawtIoPublicPort();
    const httpUrlHawtIo = `http://127.0.0.1:${hawtIoPublicPort}/hawtio`;
    this.log.info(`Hawt.io Web UI accessible: %o`, httpUrlHawtIo);
  }

  public stop(): Promise<any> {
    return Containers.stop(this.getContainer());
  }

  public destroy(): Promise<any> {
    if (this.container) {
      return this.container.remove();
    } else {
      return Promise.reject(
        new Error(
          `CordaTestLedger#destroy() Container was never created, nothing to destroy.`
        )
      );
    }
  }

  protected async getContainerInfo(): Promise<ContainerInfo> {
    const docker = new Docker();
    const image = this.getContainerImageName();
    const containerInfos = await docker.listContainers({});

    const aContainerInfo = containerInfos.find((ci) => ci.Image === image);

    if (aContainerInfo) {
      return aContainerInfo;
    } else {
      throw new Error(`CordaTestLedger#getContainerInfo() no image "${image}"`);
    }
  }

  public async getBraidAPublicPort(): Promise<number> {
    const aContainerInfo = await this.getContainerInfo();
    return Containers.getPublicPort(this.braidPortA, aContainerInfo);
  }

  public async getBraidBPublicPort(): Promise<number> {
    const aContainerInfo = await this.getContainerInfo();
    return Containers.getPublicPort(this.braidPortB, aContainerInfo);
  }

  public async getRpcAPublicPort(): Promise<number> {
    const aContainerInfo = await this.getContainerInfo();
    return Containers.getPublicPort(this.rpcPortA, aContainerInfo);
  }

  public async getRpcBPublicPort(): Promise<number> {
    const aContainerInfo = await this.getContainerInfo();
    return Containers.getPublicPort(this.rpcPortB, aContainerInfo);
  }

  public async getPartyABraidPublicPort(): Promise<number> {
    const aContainerInfo = await this.getContainerInfo();
    return Containers.getPublicPort(8083, aContainerInfo);
  }

  public async getHawtIoPublicPort(): Promise<number> {
    const aContainerInfo = await this.getContainerInfo();
    return Containers.getPublicPort(8080, aContainerInfo);
  }

  public async getJolokiaAPublicPort(): Promise<number> {
    const aContainerInfo = await this.getContainerInfo();
    return Containers.getPublicPort(7005, aContainerInfo);
  }

  public async getJolokiaBPublicPort(): Promise<number> {
    const aContainerInfo = await this.getContainerInfo();
    return Containers.getPublicPort(7006, aContainerInfo);
  }

  public async getSSHPublicPort(): Promise<number> {
    const aContainerInfo = await this.getContainerInfo();
    return Containers.getPublicPort(22, aContainerInfo);
  }

  public async getPartyASSHPublicPort(): Promise<number> {
    const aContainerInfo = await this.getContainerInfo();
    return Containers.getPublicPort(20013, aContainerInfo);
  }

  public async getPartyBSSHPublicPort(): Promise<number> {
    const aContainerInfo = await this.getContainerInfo();
    return Containers.getPublicPort(20014, aContainerInfo);
  }

  public async getRpcApiHttpHost(): Promise<string> {
    const publicPort: number = await this.getRpcAPublicPort();
    return `http://localhost:${publicPort}`;
  }

  public async getCorDappsDirPartyA(): Promise<string> {
    return "/opt/corda/partyA/cordapps/";
  }

  public async getCorDappsDirPartyB(): Promise<string> {
    return "/opt/corda/partyB/cordapps/";
  }

  public async getSshConfig(): Promise<SshConfig> {
    const publicPort = await this.getSSHPublicPort();
    return {
      host: "127.0.0.1",
      port: publicPort,
      username: "root",
      password: "root",
    };
  }

  public async getSshConfigPartyA(): Promise<SshConfig> {
    const publicPort = await this.getPartyASSHPublicPort();
    return {
      host: "127.0.0.1",
      port: publicPort,
      username: "user1",
      password: "test",
    };
  }

  public async getSshConfigPartyB(): Promise<SshConfig> {
    const publicPort = await this.getPartyBSSHPublicPort();
    return {
      host: "127.0.0.1",
      port: publicPort,
      username: "user1",
      password: "test",
    };
  }

  public async getContainerIpAddress(): Promise<string> {
    const aContainerInfo = await this.getContainerInfo();
    const { NetworkSettings } = aContainerInfo;
    const networkNames: string[] = Object.keys(NetworkSettings.Networks);
    if (networkNames.length < 1) {
      throw new Error(`CordaTestLedger#getContainerIpAddress() no networks`);
    } else {
      // return IP address of container on the first network that we found it connected to. Make this configurable?
      return NetworkSettings.Networks[networkNames[0]].IPAddress;
    }
  }

  public getContainer(): Container {
    if (!this.container) {
      throw new Error(
        `CordaTestLedger container wasn't started by this instance yet.`
      );
    } else {
      return this.container;
    }
  }

  public getContainerImageName(): string {
    return `${this.containerImageName}:${this.containerImageVersion}`;
  }

  private validateConstructorOptions(): void {
    const fnTag = "CordaTestLedger#validateConstructorOptions()";
    const validationResult = Joi.validate<ICordaTestLedgerConstructorOptions>(
      {
        containerImageVersion: this.containerImageVersion,
        containerImageName: this.containerImageName,
        rpcPortA: this.rpcPortA,
        rpcPortB: this.rpcPortB,
        braidPortA: this.braidPortA,
        braidPortB: this.braidPortB,
      },
      CORDA_TEST_LEDGER_OPTIONS_JOI_SCHEMA
    );

    if (validationResult.error) {
      throw new Error(`${fnTag} ${validationResult.error.annotate()}`);
    }
  }
}