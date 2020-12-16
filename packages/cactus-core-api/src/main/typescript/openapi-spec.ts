import { OpenAPIV3 } from "openapi-types";

export const CACTUS_OPEN_API_JSON: OpenAPIV3.Document = {
  openapi: "3.0.3",
  info: {
    title: "Hyperledger Core API",
    description:
      "Contains/describes the core API types for Cactus. Does " +
      "not describe actual endpoints on its own as this is left to the " +
      "implementing plugins who can import and re-use commonLy needed type " +
      "definitions from this specification. One example of said commonly " +
      "used type definitons would be the types related to consortium " +
      "management, cactus nodes, ledgers, etc..",
    version: "0.2.0",
  },
  servers: [
    {
      url: "https://www.cactus.stream/{basePath}",
      description: "Public test instance",
      variables: {
        basePath: {
          default: "",
        },
      },
    },
    {
      url: "http://localhost:4000/{basePath}",
      description: "Local test instance",
      variables: {
        basePath: {
          default: "",
        },
      },
    },
  ],
  components: {
    schemas: {
      ConsensusAlgorithmFamily: {
        type: "string",
        description:
          "Enumerates a list of consensus algorithm families in " +
          "existence. Does not intend to be an exhaustive list, just a " +
          "practical one, meaning that we only include items here that are " +
          "relevant to Hyperledger Cactus in fulfilling its own duties. " +
          "This can be extended later as more sophisticated features " +
          "of Cactus get implemented. " +
          "This enum is meant to be first and foremest a useful abstraction " +
          "for achieving practical tasks, not an encyclopedia and therefore " +
          "we ask of everyone that this to be extended only in ways that " +
          "serve a practical purpose for the runtime behavior of Cactus or " +
          "Cactus plugins in general. The bottom line is that we can accept " +
          "this enum being not 100% accurate as long as it 100% satisfies " +
          "what it was designed to do.",
        enum: [
          "org.hyperledger.cactus.consensusalgorithm.PROOF_OF_AUTHORITY",
          "org.hyperledger.cactus.consensusalgorithm.PROOF_OF_STAKE",
          "org.hyperledger.cactus.consensusalgorithm.PROOF_OF_WORK",
        ],
      },
      PrimaryKey: {
        type: "string",
        minLength: 1,
        maxLength: 128,
        nullable: false,
      },
      ConsortiumMemberId: {
        $ref: "#/components/schemas/PrimaryKey",
        description:
          "ID of Consortium member who operates the ledger (if any). " +
          "Defined as an optional property in case the ledger is a " +
          "permissionless and/or public one such as the Bitcoin or " +
          "Ethereum mainnets.",
      },
      CactusNodeId: {
        $ref: "#/components/schemas/PrimaryKey",
        description:
          "ID of a Cactus node that must uniquely distinguish it from all " +
          "other Cactus nodes within a Consortium. Note that API server " +
          "instances do not have their own identity the way a node does.",
      },
      ConsortiumId: {
        $ref: "#/components/schemas/PrimaryKey",
      },
      LedgerId: {
        description:
          "String that uniquely identifies a ledger within a" +
          " Cactus consortium so that transactions can be routed to the" +
          " correct ledger.",
        $ref: "#/components/schemas/PrimaryKey",
      },
      PluginInstanceId: {
        description:
          "String that uniquely identifies a plugin instance within a" +
          " Cactus consortium so that requests can be addressed/routed " +
          " directly to individual plugins when necessary.",
        $ref: "#/components/schemas/PrimaryKey",
      },
      ConsortiumDatabase: {
        required: [
          "consortium",
          "ledger",
          "consortiumMember",
          "cactusNode",
          "pluginInstance",
        ],
        properties: {
          consortium: {
            description:
              "A collection of Consortium entities. In practice " +
              "this should only ever contain a single consortium, but we " +
              "defined it as an array to keep the convention up with the" +
              " rest of the collections defined in the Consortium data in " +
              "general. Also, if we ever decide to somehow have some sort " +
              "of consortium to consortium integration (which does not make " +
              "much sense in the current frame of mind of the author in the " +
              "year 2020) then having this as an array will have proven " +
              "itself to be an excellent long term compatibility/" +
              "extensibility decision indeed.",
            type: "array",
            items: {
              $ref: "#/components/schemas/Consortium",
            },
            default: [],
            minItems: 0,
            maxItems: 2048,
          },
          ledger: {
            description:
              "The complete collection of all ledger entities in" +
              "existence within the consortium.",
            type: "array",
            items: {
              $ref: "#/components/schemas/Ledger",
            },
            default: [],
            minItems: 0,
            maxItems: 2048,
          },
          consortiumMember: {
            description:
              "The complete collection of all consortium member" +
              " entities in existence within the consortium.",
            type: "array",
            items: {
              $ref: "#/components/schemas/ConsortiumMember",
            },
            default: [],
            minItems: 0,
            maxItems: 2048,
          },
          cactusNode: {
            description:
              "The complete collection of all cactus nodes" +
              " entities in existence within the consortium.",
            type: "array",
            items: {
              $ref: "#/components/schemas/CactusNode",
            },
            default: [],
            minItems: 0,
            maxItems: 2048,
          },
          pluginInstance: {
            description:
              "The complete collection of all plugin instance" +
              " entities in existence within the consortium.",
            type: "array",
            items: {
              $ref: "#/components/schemas/PluginInstance",
            },
            default: [],
            minItems: 0,
            maxItems: 2048,
          },
        },
      },
      Ledger: {
        type: "object",
        required: ["id", "ledgerType"],
        properties: {
          id: {
            $ref: "#/components/schemas/LedgerId",
          },
          ledgerType: {
            $ref: "#/components/schemas/LedgerType",
            nullable: false,
          },
          consortiumMemberId: {
            $ref: "#/components/schemas/ConsortiumMemberId",
          },
        },
      },
      LedgerType: {
        description:
          "Enumerates the different ledger vendors and their " +
          "major versions encoded within the name of the LedgerType. " +
          `For example "BESU_1X" involves all of the [1.0.0;2.0.0) where ` +
          "1.0.0 is included and anything up until, but not 2.0.0. See: " +
          "https://stackoverflow.com/a/4396303/698470 for further explanation.",
        type: "string",
        enum: [
          "BESU_1X",
          "BESU_2X",
          "BURROW_0X",
          "CORDA_4X",
          "FABRIC_14X",
          "FABRIC_2",
          "QUORUM_2X",
          "SAWTOOTH_1X",
        ],
      },
      Consortium: {
        type: "object",
        required: ["id", "name", "mainApiHost", "memberIds"],
        properties: {
          id: {
            $ref: "#/components/schemas/ConsortiumId",
          },
          name: {
            type: "string",
          },
          mainApiHost: {
            type: "string",
          },
          memberIds: {
            description:
              "The collection (array) of primary keys of" +
              " consortium member entities that belong to this Consortium.",
            type: "array",
            items: {
              $ref: "#/components/schemas/ConsortiumMemberId",
            },
            default: [],
            minItems: 1,
            maxItems: 2048,
            nullable: false,
          },
        },
      },
      ConsortiumMember: {
        type: "object",
        required: ["id", "name", "nodeIds"],
        properties: {
          id: {
            $ref: "#/components/schemas/ConsortiumMemberId",
          },
          name: {
            type: "string",
            description:
              "The human readable name a Consortium member can be " +
              "referred to while making it easy for humans to distinguish " +
              "this particular consortium member entity from any other ones.",
            minLength: 1,
            maxLength: 2048,
            nullable: false,
          },
          nodeIds: {
            type: "array",
            default: [],
            nullable: false,
            minItems: 1,
            maxItems: 2048,
            items: {
              $ref: "#/components/schemas/CactusNodeId",
            },
          },
        },
      },
      CactusNodeMeta: {
        description: "A Cactus node meta information",
        type: "object",
        required: ["nodeApiHost", "publicKeyPem"],
        properties: {
          nodeApiHost: {
            type: "string",
            minLength: 1,
            maxLength: 1024,
            nullable: false,
          },
          publicKeyPem: {
            description:
              "The PEM encoded public key that was used to " +
              "generate the JWS included in the response (the jws property)",
            type: "string",
            minLength: 1,
            maxLength: 65535,
            nullable: false,
            format:
              "Must only contain the public key, never include here " +
              " the PEM that also contains a private key. See PEM format: " +
              "https://en.wikipedia.org/wiki/Privacy-Enhanced_Mail",
          },
        },
      },
      CactusNode: {
        description:
          "A Cactus node can be a single server, or a set of " +
          "servers behind a loand balancer acting as one.",
        type: "object",
        allOf: [
          {
            $ref: "#/components/schemas/CactusNodeMeta",
          },
          {
            type: "object",
            required: [
              "id",
              "consortiumId",
              "nodeApiHost",
              "memberId",
              "publicKeyPem",
              "pluginInstanceIds",
              "ledgerIds",
            ],
            properties: {
              id: {
                $ref: "#/components/schemas/CactusNodeId",
                example: "809a76ba-cfb8-4045-a5c6-ed70a7314c25",
              },
              consortiumId: {
                $ref: "#/components/schemas/ConsortiumId",
                description: "ID of the Cactus Consortium this node is in.",
                example: "3e2670d9-2d14-45bd-96f5-33e2c4b4e3fb",
              },
              memberId: {
                $ref: "#/components/schemas/ConsortiumMemberId",
                example: "b3674a28-e442-4feb-b1f3-8cbe46c20e5e",
              },
              ledgerIds: {
                description:
                  "Stores an array of Ledger entity IDs that are " +
                  "reachable (routable) via this Cactus Node. This " +
                  "information is used by the client side SDK API client to " +
                  "figure out at runtime where to send API requests that are " +
                  "specific to a certain ledger such as requests to execute " +
                  "transactions.",
                type: "array",
                nullable: false,
                minItems: 0,
                maxItems: 2048,
                default: [],
                items: {
                  $ref: "#/components/schemas/LedgerId",
                },
              },
              pluginInstanceIds: {
                type: "array",
                nullable: false,
                minItems: 0,
                maxItems: 2048,
                default: [],
                items: {
                  $ref: "#/components/schemas/PluginInstanceId",
                },
              },
            },
          },
        ],
      },
      PluginInstance: {
        type: "object",
        required: ["id", "packageName"],
        properties: {
          id: {
            $ref: "PluginInstanceId",
          },
          packageName: {
            type: "string",
            minLength: 1,
            maxLength: 4096,
            nullable: false,
          },
        },
      },
      JWSCompact: {
        description:
          "A JSON Web Signature. See: " +
          "https://tools.ietf.org/html/rfc7515 for info about standard.",
        type: "string",
        minLength: 5,
        maxLength: 65535,
        pattern: `/^[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)?$/`,
        example:
          "eyJhbGciOiJIUzI1NiJ9.eyJuYW1lIjoiSm9obiBEb2UiLCJpYXQiOjE1MTYyMzkwMjJ9.DOCNCqEMN7CQ_z-RMndiyldljXOk6WFIZxRzNF5Ylg4",
      },
      JWSRecipient: {
        description:
          "A JSON Web Signature. See: " +
          "https://tools.ietf.org/html/rfc7515 for info about standard.",
        type: "object",
        required: ["signature"],
        properties: {
          signature: {
            type: "string",
          },
          // In the generated models this shows up as _protected because it is
          // a reserved keyword in Typescript. Opened an issue here about  this:
          // https://github.com/OpenAPITools/openapi-generator/issues/7100
          protected: {
            type: "string",
          },
          header: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
      JWSGeneral: {
        type: "object",
        required: ["payload", "signatures"],
        properties: {
          payload: {
            type: "string",
            minLength: 1,
            maxLength: 65535,
          },
          signatures: {
            type: "array",
            items: {
              $ref: "#/components/schemas/JWSRecipient",
            },
          },
        },
      },
    },
  },
  paths: {},
};

export async function exportToFileSystemAsJson(): Promise<void> {
  const fnTag = "OpenApiSpec#exportToFileSystemAsJson()";
  const fs = await import("fs");
  const path = await import("path");
  const filename = `openapi-spec.json`;
  const defaultDest = path.join(__dirname, "../json/generated/", filename);
  const destination = process.argv[2] || defaultDest;

  // tslint:disable-next-line: no-console
  console.log(`${fnTag} destination=${destination}`);

  fs.writeFileSync(destination, JSON.stringify(CACTUS_OPEN_API_JSON, null, 4));
}

if (require.main === module) {
  exportToFileSystemAsJson();
}
