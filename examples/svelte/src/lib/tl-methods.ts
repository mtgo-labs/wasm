/**
 * Curated list of common Telegram TL methods for autocomplete.
 *
 * Each entry includes the method name, a short description, and a JSON
 * params template that auto-fills when the method is selected.
 */
export interface TLMethod {
  name: string;
  description: string;
  /** JSON string template for the method's params, or null if params-less. */
  template: string | null;
}

export const tlMethods: TLMethod[] = [
  // ── users ──────────────────────────────────────────────
  {
    name: "users.getUsers",
    description: "Get info about users by ID",
    template: `{
  "id": [
    {"_": "inputUserSelf"}
  ]
}`,
  },
  {
    name: "users.getFullUser",
    description: "Get full user profile",
    template: `{
  "id": {"_": "inputUserSelf"}
}`,
  },

  // ── messages ───────────────────────────────────────────
  {
    name: "messages.sendMessage",
    description: "Send a text message",
    template: `{
  "peer": {"_": "inputPeerSelf"},
  "message": "Hello from mtgo-wasm!",
  "random_id": 0,
  "reply_to_msg_id": 0
}`,
  },
  {
    name: "messages.getDialogs",
    description: "Get chat list / dialogs",
    template: `{
  "offset_date": 0,
  "offset_id": 0,
  "offset_peer": {"_": "inputPeerEmpty"},
  "limit": 100,
  "hash": 0
}`,
  },
  {
    name: "messages.getHistory",
    description: "Get message history for a chat",
    template: `{
  "peer": {"_": "inputPeerSelf"},
  "offset_id": 0,
  "offset_date": 0,
  "add_offset": 0,
  "limit": 20,
  "max_id": 0,
  "min_id": 0,
  "hash": 0
}`,
  },
  {
    name: "messages.getMessages",
    description: "Get specific messages by ID",
    template: `{
  "id": [{"_": "inputMessageID", "id": 1}],
  "peer": {"_": "inputPeerSelf"}
}`,
  },
  {
    name: "messages.deleteMessages",
    description: "Delete messages",
    template: `{
  "id": [1],
  "revoke": true
}`,
  },
  {
    name: "messages.editMessage",
    description: "Edit a sent message",
    template: `{
  "peer": {"_": "inputPeerSelf"},
  "id": 1,
  "message": "Edited text",
  "flags": 2048
}`,
  },
  {
    name: "messages.forwardMessages",
    description: "Forward messages to another chat",
    template: `{
  "from_peer": {"_": "inputPeerSelf"},
  "to_peer": {"_": "inputPeerSelf"},
  "id": [1],
  "random_id": [0],
  "flags": 0
}`,
  },
  {
    name: "messages.search",
    description: "Search messages in a chat",
    template: `{
  "peer": {"_": "inputPeerSelf"},
  "q": "search query",
  "filter": {"_": "inputMessagesFilterEmpty"},
  "min_date": 0,
  "max_date": 0,
  "offset_id": 0,
  "add_offset": 0,
  "limit": 20,
  "max_id": 0,
  "min_id": 0,
  "hash": 0
}`,
  },
  {
    name: "messages.readHistory",
    description: "Mark messages as read",
    template: `{
  "peer": {"_": "inputPeerSelf"},
  "max_id": 0
}`,
  },
  {
    name: "messages.getPeerDialogs",
    description: "Get dialog info for peers",
    template: `{
  "peers": [{"_": "inputPeerSelf"}]
}`,
  },
  {
    name: "messages.getAllDrafts",
    description: "Get all draft messages",
    template: null,
  },
  {
    name: "messages.getUnreadMentions",
    description: "Get unread mentions",
    template: `{
  "peer": {"_": "inputPeerSelf"},
  "offset_id": 0,
  "add_offset": 0,
  "limit": 20,
  "max_id": 0,
  "min_id": 0
}`,
  },
  {
    name: "messages.sendReaction",
    description: "Send a reaction to a message",
    template: `{
  "peer": {"_": "inputPeerSelf"},
  "msg_id": 1,
  "reaction": [{"_": "reactionEmoji", "emoticon": "👍"}]
}`,
  },
  {
    name: "messages.getMessageReactions",
    description: "Get reactions on a message",
    template: `{
  "id": [1]
}`,
  },
  {
    name: "messages.getStickerSet",
    description: "Get a sticker set",
    template: `{
  "stickerset": {"_": "inputStickerSetShortName", "short_name": "Duck"},
  "hash": 0
}`,
  },

  // ── chats ──────────────────────────────────────────────
  {
    name: "messages.createChat",
    description: "Create a new basic group",
    template: `{
  "users": [{"_": "inputUserSelf"}],
  "title": "New Group",
  "ttl_period": 0
}`,
  },
  {
    name: "messages.migrateChat",
    description: "Upgrade basic group to supergroup",
    template: `{
  "chat_id": 123456
}`,
  },

  // ── channels ───────────────────────────────────────────
  {
    name: "channels.createChannel",
    description: "Create a channel or supergroup",
    template: `{
  "title": "New Channel",
  "about": "",
  "broadcast": true,
  "megagroup": false,
  "for_import": false
}`,
  },
  {
    name: "channels.getFullChannel",
    description: "Get full channel/supergroup info",
    template: `{
  "channel": {"_": "inputChannel", "channel_id": 123456, "access_hash": 0}
}`,
  },
  {
    name: "channels.exportInvite",
    description: "Export channel invite link",
    template: `{
  "channel": {"_": "inputChannel", "channel_id": 123456, "access_hash": 0}
}`,
  },
  {
    name: "channels.inviteToChannel",
    description: "Invite users to a channel",
    template: `{
  "channel": {"_": "inputChannel", "channel_id": 123456, "access_hash": 0},
  "users": [{"_": "inputUserSelf"}]
}`,
  },
  {
    name: "channels.kickFromChannel",
    description: "Kick a user from a channel",
    template: `{
  "channel": {"_": "inputChannel", "channel_id": 123456, "access_hash": 0},
  "user_id": {"_": "inputUserSelf"},
  "kicked": true
}`,
  },
  {
    name: "channels.editAdmin",
    description: "Edit admin permissions",
    template: `{
  "channel": {"_": "inputChannel", "channel_id": 123456, "access_hash": 0},
  "user_id": {"_": "inputUserSelf"},
  "admin_rights": {"_": "chatAdminRights", "other": true}
}`,
  },
  {
    name: "channels.deleteChannel",
    description: "Delete a channel",
    template: `{
  "channel": {"_": "inputChannel", "channel_id": 123456, "access_hash": 0}
}`,
  },

  // ── contacts ───────────────────────────────────────────
  {
    name: "contacts.getContacts",
    description: "Get contact list",
    template: `{
  "hash": 0
}`,
  },
  {
    name: "contacts.resolveUsername",
    description: "Resolve @username to a peer",
    template: `{
  "username": "durov"
}`,
  },
  {
    name: "contacts.search",
    description: "Search contacts by name",
    template: `{
  "q": "search query",
  "limit": 20
}`,
  },

  // ── account ────────────────────────────────────────────
  {
    name: "account.updateProfile",
    description: "Update profile (name, bio, etc)",
    template: `{
  "first_name": "Name",
  "last_name": "",
  "about": "Bio",
  "flags": 7
}`,
  },
  {
    name: "account.updateStatus",
    description: "Set online/offline status",
    template: `{
  "offline": false
}`,
  },
  {
    name: "account.getAuthorizations",
    description: "Get active sessions",
    template: null,
  },
  {
    name: "account.resetAuthorization",
    description: "Terminate a session",
    template: `{
  "hash": 0
}`,
  },
  {
    name: "account.getPassword",
    description: "Get 2FA password settings",
    template: null,
  },
  {
    name: "account.getPasswordSettings",
    description: "Get detailed 2FA settings",
    template: `{
  "password": {"_": "inputCheckPasswordEmpty"}
}`,
  },
  {
    name: "account.getNotifySettings",
    description: "Get notification settings",
    template: `{
  "peer": {"_": "inputNotifyPeer", "peer": {"_": "inputPeerSelf"}}
}`,
  },
  {
    name: "account.updateNotifySettings",
    description: "Update notification settings",
    template: `{
  "peer": {"_": "inputNotifyPeer", "peer": {"_": "inputPeerSelf"}},
  "settings": {
    "_": "inputPeerNotifySettings",
    "show_previews": true,
    "silent": false,
    "mute_until": 0
  }
}`,
  },
  {
    name: "account.getWallPapers",
    description: "Get available wallpapers",
    template: null,
  },

  // ── bots ───────────────────────────────────────────────
  {
    name: "bots.answerCallbackQuery",
    description: "Answer a callback query",
    template: `{
  "query_id": 0,
  "message": "Answer",
  "alert": false
}`,
  },
  {
    name: "bots.setBotCommands",
    description: "Set bot command list",
    template: `{
  "scope": {"_": "botCommandScopeDefault"},
  "lang_code": "en",
  "commands": [
    {"_": "botCommand", "command": "start", "description": "Start"}
  ]
}`,
  },

  // ── photos ─────────────────────────────────────────────
  {
    name: "photos.getUserPhotos",
    description: "Get a user's profile photos",
    template: `{
  "user_id": {"_": "inputUserSelf"},
  "offset": 0,
  "max_id": 0,
  "limit": 1
}`,
  },
  {
    name: "photos.updateProfilePhoto",
    description: "Update profile photo",
    template: `{
  "id": {"_": "inputPhoto", "id": 0, "access_hash": 0}
}`,
  },

  // ── help / utility ─────────────────────────────────────
  {
    name: "help.getAppConfig",
    description: "Get app config (limits, features)",
    template: null,
  },
  {
    name: "help.getCdnConfig",
    description: "Get CDN config",
    template: null,
  },
  {
    name: "help.getInviteText",
    description: "Get invite text for the app",
    template: null,
  },
  {
    name: "langpack.getLangPack",
    description: "Get language pack strings",
    template: `{
  "lang_pack": "android",
  "lang_code": "en"
}`,
  },
];

/** Filter methods by a search string (matches name or description). */
export function filterMethods(query: string, limit = 8): TLMethod[] {
  const q = query.toLowerCase().trim();
  if (!q) return tlMethods.slice(0, limit);
  return tlMethods
    .filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q),
    )
    .slice(0, limit);
}

/** Get the params template for a method name, or null if not found. */
export function getTemplate(methodName: string): string | null {
  return tlMethods.find((m) => m.name === methodName)?.template ?? null;
}
