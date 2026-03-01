"use strict";

function createCorrelationId(nowMs) {
  const randomPart = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, "0");
  return `evt-${nowMs.toString(36)}-${randomPart}`;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUserCommand(payload) {
  const normalizedPayload = payload && typeof payload === "object" ? payload : {};
  const explicitType = normalizeText(normalizedPayload.type).toLowerCase();
  const command = normalizeText(normalizedPayload.command).toLowerCase();
  const text = normalizeText(normalizedPayload.text).toLowerCase();
  const raw = explicitType || command || text;

  if (raw === "status" || raw === "introspect" || raw === "what are you doing") {
    return "status";
  }
  if (raw === "announce-test" || raw === "announce") {
    return "announce-test";
  }
  if (raw === "bridge-test" || raw === "bridge") {
    return "bridge-test";
  }
  if (raw === "guardrail-test" || raw === "guardrail") {
    return "guardrail-test";
  }
  return raw || "unknown";
}

function asNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function asCooldownMap(value) {
  if (!value || typeof value !== "object") return {};
  return value;
}

class PetContractRouter {
  constructor({ now = Date.now, onTrace, announcementCooldownMs = 10000 } = {}) {
    this._now = typeof now === "function" ? now : Date.now;
    this._onTrace = typeof onTrace === "function" ? onTrace : null;
    this._announcementCooldownMs = asNumber(announcementCooldownMs, 10000);
    this._announcementLastSentByReason = new Map();
  }

  processEvent(inputEvent, context = {}) {
    const nowMs = this._now();
    const event = {
      type: normalizeText(inputEvent?.type),
      payload: inputEvent?.payload && typeof inputEvent.payload === "object" ? inputEvent.payload : {},
      correlationId:
        normalizeText(inputEvent?.correlationId) || createCorrelationId(nowMs),
      ts: asNumber(inputEvent?.ts, nowMs),
    };

    this._trace("event", event, context);

    const intents = this._deriveIntents(event, context);
    for (const intent of intents) {
      this._trace("intent", intent, context);
    }

    const suggestions = [];
    for (const intent of intents) {
      const derived = this._deriveSuggestions(intent, context);
      for (const suggestion of derived) {
        suggestions.push(suggestion);
        this._trace("suggestion", suggestion, context);
      }
    }

    return {
      ok: true,
      correlationId: event.correlationId,
      event,
      intents,
      suggestions,
    };
  }

  _deriveIntents(event, context) {
    if (event.type === "USER_COMMAND") {
      const normalizedCommand = normalizeUserCommand(event.payload);
      if (normalizedCommand === "status") {
        return [
          {
            type: "INTENT_INTROSPECTION_STATUS",
            reason: "user_command_status",
            correlationId: event.correlationId,
            ts: this._now(),
            payload: {
              command: "status",
            },
          },
        ];
      }

      if (normalizedCommand === "announce-test") {
        return [
          {
            type: "INTENT_PROACTIVE_ANNOUNCEMENT",
            reason: "user_command_announce_test",
            correlationId: event.correlationId,
            ts: this._now(),
            payload: {
              reason: "manual_test",
              text: "Manual announcement test from USER_COMMAND.",
              priority: "low",
            },
          },
        ];
      }

      if (normalizedCommand === "bridge-test" || normalizedCommand === "guardrail-test") {
        return [
          {
            type: "INTENT_BRIDGE_DIALOG",
            reason: "user_command_bridge_dialog",
            correlationId: event.correlationId,
            ts: this._now(),
            payload: {
              command: normalizedCommand,
              text:
                normalizeText(event.payload?.text) ||
                normalizeText(event.payload?.command) ||
                normalizedCommand,
            },
          },
        ];
      }

      return [
        {
          type: "INTENT_UNKNOWN_COMMAND",
          reason: "user_command_unknown",
          correlationId: event.correlationId,
          ts: this._now(),
          payload: {
            normalizedCommand,
          },
        },
      ];
    }

    if (event.type === "EXT_PROP_INTERACTED") {
      return [
        {
          type: "INTENT_PROP_INTERACTION",
          reason: "extension_prop_interaction",
          correlationId: event.correlationId,
          ts: this._now(),
          payload: {
            extensionId: event.payload.extensionId || "",
            propId: event.payload.propId || "",
            interactionType: event.payload.interactionType || "click",
          },
        },
      ];
    }

    if (event.type === "MEDIA") {
      const playing = Boolean(event.payload?.playing);
      const confidence = asNumber(event.payload?.confidence, 0);
      if (playing && confidence >= 0.7) {
        return [
          {
            type: "INTENT_STATE_MUSIC_MODE",
            reason: "media_playing_music_mode",
            correlationId: event.correlationId,
            ts: this._now(),
            payload: {
              provider: normalizeText(event.payload?.provider) || "media",
              source: normalizeText(event.payload?.source) || "media",
              title: normalizeText(event.payload?.title) || "unknown_track",
              artist: normalizeText(event.payload?.artist) || "unknown_artist",
              album: normalizeText(event.payload?.album) || "unknown_album",
              suggestedState:
                normalizeText(event.payload?.suggestedState) || "MusicChill",
              activeProp: normalizeText(event.payload?.activeProp) || "headphones",
              entryDialogue: normalizeText(event.payload?.entryDialogue) || "",
              fallbackMode: normalizeText(event.payload?.fallbackMode) || "none",
            },
          },
        ];
      }

      return [
        {
          type: "INTENT_MEDIA_IGNORED",
          reason: "media_not_playing",
          correlationId: event.correlationId,
          ts: this._now(),
          payload: {
            provider: normalizeText(event.payload?.provider) || "media",
            playing,
            confidence,
          },
        },
      ];
    }

    if (event.type === "FRESHRSS_ITEMS") {
      return [
        {
          type: "INTENT_HOBBY_SUMMARY",
          reason: "freshrss_latest_items",
          correlationId: event.correlationId,
          ts: this._now(),
          payload: {
            summary: normalizeText(event.payload?.summary) || "FreshRSS summary unavailable.",
            itemCount: Array.isArray(event.payload?.items) ? event.payload.items.length : 0,
            fallbackMode: normalizeText(event.payload?.fallbackMode) || "none",
          },
        },
      ];
    }

    return [
      {
        type: "INTENT_UNSUPPORTED_EVENT",
        reason: "unsupported_event_type",
        correlationId: event.correlationId,
        ts: this._now(),
        payload: {
          eventType: event.type || "unknown",
        },
      },
    ];
  }

  _deriveSuggestions(intent, context) {
    const source = normalizeText(context.source) || "offline";
    if (intent.type === "INTENT_INTROSPECTION_STATUS") {
      const statusText = normalizeText(context.statusText) || "I am running in local mode.";
      return [
        {
          type: "PET_RESPONSE",
          mode: "text",
          source,
          text: statusText,
          correlationId: intent.correlationId,
          ts: this._now(),
        },
      ];
    }

    if (intent.type === "INTENT_PROACTIVE_ANNOUNCEMENT") {
      const reason = normalizeText(intent.payload?.reason) || "general";
      const cooldownMap = asCooldownMap(context.announcementCooldownMsByReason);
      const cooldownMs = asNumber(cooldownMap[reason], this._announcementCooldownMs);
      const nowMs = this._now();
      const lastSentMs = this._announcementLastSentByReason.get(reason) || 0;
      if (nowMs - lastSentMs < cooldownMs) {
        return [
          {
            type: "PET_ANNOUNCEMENT_SKIPPED",
            reason,
            skipReason: "cooldown_active",
            cooldownMs,
            source,
            correlationId: intent.correlationId,
            ts: nowMs,
          },
        ];
      }

      this._announcementLastSentByReason.set(reason, nowMs);
      return [
        {
          type: "PET_ANNOUNCEMENT",
          reason,
          channel: "bubble",
          priority: normalizeText(intent.payload?.priority) || "low",
          source,
          text:
            normalizeText(intent.payload?.text) ||
            "I have something to share.",
          correlationId: intent.correlationId,
          ts: nowMs,
        },
      ];
    }

    if (intent.type === "INTENT_PROP_INTERACTION") {
      const extensionId = normalizeText(intent.payload?.extensionId) || "extension";
      const propId = normalizeText(intent.payload?.propId) || "prop";
      return [
        {
          type: "PET_RESPONSE",
          mode: "text",
          source,
          text: `Interacting with ${propId} from ${extensionId}.`,
          correlationId: intent.correlationId,
          ts: this._now(),
        },
      ];
    }

    if (intent.type === "INTENT_BRIDGE_DIALOG") {
      const bridgeDialogText =
        normalizeText(context.bridgeDialogText) || "Bridge unavailable. Local dialog fallback active.";
      const fallbackMode = normalizeText(context.bridgeFallbackMode) || "none";
      return [
        {
          type: "PET_RESPONSE",
          mode: "text",
          source,
          fallbackMode,
          text: bridgeDialogText,
          correlationId: intent.correlationId,
          ts: this._now(),
        },
      ];
    }

    if (intent.type === "INTENT_STATE_MUSIC_MODE") {
      const suggestedState =
        normalizeText(context.mediaSuggestedState) ||
        normalizeText(intent.payload?.suggestedState) ||
        "MusicChill";
      const responseText =
        normalizeText(context.mediaResponseText) ||
        `Suggesting ${suggestedState} for ${intent.payload?.title || "unknown_track"}.`;
      return [
        {
          type: "PET_RESPONSE",
          mode: "text",
          source,
          fallbackMode:
            normalizeText(context.integrationFallbackMode) ||
            normalizeText(intent.payload?.fallbackMode) ||
            "none",
          suggestedState,
          provider: normalizeText(intent.payload?.provider) || "media",
          activeProp: normalizeText(intent.payload?.activeProp) || "headphones",
          text: responseText,
          correlationId: intent.correlationId,
          ts: this._now(),
        },
      ];
    }

    if (intent.type === "INTENT_MEDIA_IGNORED") {
      return [];
    }

    if (intent.type === "INTENT_HOBBY_SUMMARY") {
      return [
        {
          type: "PET_RESPONSE",
          mode: "text",
          source,
          fallbackMode: normalizeText(intent.payload?.fallbackMode) || "none",
          text:
            normalizeText(context.freshRssResponseText) ||
            normalizeText(intent.payload?.summary) ||
            "FreshRSS summary unavailable.",
          correlationId: intent.correlationId,
          ts: this._now(),
        },
      ];
    }

    if (intent.type === "INTENT_UNKNOWN_COMMAND") {
      return [
        {
          type: "PET_RESPONSE",
          mode: "text",
          source,
          text: "I did not understand that command yet.",
          correlationId: intent.correlationId,
          ts: this._now(),
        },
      ];
    }

    return [
      {
        type: "PET_RESPONSE",
        mode: "text",
        source,
        text: "I cannot process that event yet.",
        correlationId: intent.correlationId,
        ts: this._now(),
      },
    ];
  }

  _trace(stage, payload, context) {
    if (!this._onTrace) return;
    this._onTrace({
      stage,
      payload,
      context: {
        source: normalizeText(context?.source) || "offline",
      },
      ts: this._now(),
    });
  }
}

function createPetContractRouter(options) {
  return new PetContractRouter(options);
}

module.exports = {
  createPetContractRouter,
};
