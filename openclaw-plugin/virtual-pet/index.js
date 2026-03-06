import lane from "./skills/virtual-pet-lane/index.js";

const TOOL_NAME = "virtual_pet_lane";
const GATEWAY_METHOD_BUILD_CALL = "virtualpetlane.build_call";
const GATEWAY_METHOD_CONTRACT = "virtualpetlane.contract";

function toOptionalString(value, fallback = null) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toPayloadObject(value) {
  if (!isPlainObject(value)) return {};
  return value;
}

function asErrorMessage(error) {
  if (!error) return "unknown_error";
  if (typeof error.message === "string" && error.message.trim().length > 0) {
    return error.message.trim();
  }
  return String(error);
}

function buildCallFromParams(params) {
  const safe = isPlainObject(params) ? params : {};
  const callId = toOptionalString(safe.call, null);
  const correlationId = toOptionalString(safe.correlationId, null);
  const contractVersion = toOptionalString(safe.contractVersion, lane.CONTRACT_VERSION);
  const payload = toPayloadObject(safe.payload);

  if (contractVersion !== lane.CONTRACT_VERSION) {
    throw new Error("contract_version_unsupported");
  }
  if (!callId) {
    throw new Error("call_required");
  }
  if (!Object.values(lane.CALL_IDS).includes(callId)) {
    throw new Error("unknown_call");
  }
  if (!correlationId) {
    throw new Error("correlation_id_required");
  }

  return lane.createLaneCall({
    call: callId,
    correlationId,
    payload,
  });
}

function buildToolResponse(action, mode = "tool") {
  const details = {
    mode,
    contractVersion: lane.CONTRACT_VERSION,
    action,
    proposedActions: [action],
  };
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(details, null, 2),
      },
    ],
    details,
  };
}

const plugin = {
  id: "virtual-pet-lane",
  name: "Virtual Pet Lane",
  description: "Builds versioned virtual_pet_lane_call envelopes for guarded Virtual Pet app actions.",
  configSchema: {
    parse(value) {
      if (!isPlainObject(value)) return {};
      return {};
    },
    uiHints: {},
  },
  register(api) {
    api.registerTool({
      name: TOOL_NAME,
      label: "Virtual Pet Lane",
      description:
        "Build virtual_pet_lane_call payloads for virtual_pet.status.read, virtual_pet.command.request, and virtual_pet.memory.sync_intent.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["call", "correlationId", "payload"],
        properties: {
          call: {
            type: "string",
            enum: [lane.CALL_IDS.commandRequest, lane.CALL_IDS.statusRead, lane.CALL_IDS.memorySyncIntent],
            description: "The lane call id to build.",
          },
          correlationId: {
            type: "string",
            minLength: 1,
            maxLength: 128,
            description: "Caller-generated correlation id echoed by the Virtual Pet app lane.",
          },
          payload: {
            type: "object",
            description: "Call payload object for the selected call id.",
          },
          contractVersion: {
            type: "string",
            enum: [lane.CONTRACT_VERSION],
            description: "Lane contract version. Only vp-plugin-lane-v1 is currently supported.",
          },
        },
      },
      async execute(_toolCallId, params) {
        const action = buildCallFromParams(params);
        return buildToolResponse(action, "tool");
      },
    });

    api.registerGatewayMethod(GATEWAY_METHOD_BUILD_CALL, async ({ params, respond }) => {
      try {
        const action = buildCallFromParams(params);
        respond(true, {
          contractVersion: lane.CONTRACT_VERSION,
          action,
        });
      } catch (error) {
        respond(false, {
          error: asErrorMessage(error),
        });
      }
    });

    api.registerGatewayMethod(GATEWAY_METHOD_CONTRACT, async ({ respond }) => {
      respond(true, {
        contractVersion: lane.CONTRACT_VERSION,
        actionType: lane.VIRTUAL_PET_LANE_ACTION,
        callIds: Object.assign({}, lane.CALL_IDS),
      });
    });
  },
};

export default plugin;
