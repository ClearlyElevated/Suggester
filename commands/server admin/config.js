const { colors, emoji } = require("../../config.json");
const { dbQueryNoNew, dbQuery, dbModify } = require("../../utils/db");
const { findRole, handleChannelInput, findEmoji, handleRoleInput } = require("../../utils/config");
const { checkPermissions } = require("../../utils/checks");
const { confirmation } = require("../../utils/actions");
const nodeEmoji = require("node-emoji");
const { string } = require("../../utils/strings");
module.exports = {
	controls: {
		name: "config",
		permission: 2,
		aliases: ["serverconfig", "cfg", "configure"],
		usage: "config (element) (additional parameters)",
		description: "Shows/edits server configuration",
		image: "images/Config.gif",
		enabled: true,
		docs: "admin/config",
		permissions: ["VIEW_CHANNEL", "SEND_MESSAGES", "EMBED_LINKS", "USE_EXTERNAL_EMOJIS"],
		cooldown: 5
	},
	do: async (message, client, args, Discord) => {
		let server;
		let permission = await checkPermissions(message.member, client);
		if (!args[0] || permission > 1) server = message.guild;
		else if (client.guilds.cache.get(args[0])) {
			server = client.guilds.cache.get(args[0]);
			args = args.splice(1);
		}
		if (!server) server = message.guild;
		
		let qServerDB = await dbQuery("Server", {id: server.id});

		if (!args[0]) {
			let embed = new Discord.MessageEmbed();
			embed.setDescription(string("CONFIG_HELP", { prefix: qServerDB.config.prefix }));
			embed.setColor(colors.default);
			return message.channel.send(embed);
		}

		async function listRoles (roleList, server, title, fatal, append) {
			if (!roleList) return `${string(title, {}, fatal ? "error" : "success")} ${string("NONE_CONFIGURED")}`;
			if (typeof roleList === "string") {
				let role;
				if (server.roles.cache.get(roleList)) role = `${string(title, {}, "success")} ${server.roles.cache.get(roleList).name} (ID: \`${roleList}\`)`;
				else if (roleList) {
					roleList = "";
					await dbModify("Server", {id: server.id}, qServerDB);
				}
				return !role ? `${string(title, {}, fatal ? "error" : "success")} ${string("NONE_CONFIGURED")}` : role;
			} else {
				let roles = [];
				if (roleList.length > 0) {
					roleList.forEach(roleId => {
						if (server.roles.cache.get(roleId)) {
							roles.push(`${server.roles.cache.get(roleId).name} (ID: \`${roleId}\`)`);
						} else {
							let index = roleList.findIndex(r => r === roleId);
							roleList.splice(index, 1);
						}
					});
					await dbModify("Server", {id: server.id}, qServerDB);
				}
				if (roles.length < 1) return [`${string(title, {}, fatal ? "error" : "success")} ${string("NONE_CONFIGURED")} ${append ? append : ""}`, fatal ? true : null];
				else return [`${string(title, {}, "success")}\n> ${roles.join("\n> ")}`];
			}
		}

		async function showChannel (channel, server, title, fatal, append) {
			let foundChannel = server.channels.cache.get(channel);
			if (!foundChannel || foundChannel.type !== "text") {
				return [`${string(title, {}, "error")} ${string("NONE_CONFIGURED")} ${append ? append : ""}`, true];
			}
			return [`${string(title, {}, "success")} <#${foundChannel.id}> (${foundChannel.id})`];
		}

		function checkEmoji(emoji) {
			if (emoji === "none") return string("DISABLED");
			else if (nodeEmoji.find(emoji)) return emoji;
			else if (emoji.startsWith("a")) return `<${emoji}>`;
			else return `<:${emoji}>`;
		}

		async function handleEmojiInput (input, server, current_name, disabled_str, success_str) {
			if (!input) return string("CFG_NO_EMOJI_ERROR", {}, "error");
			if (["none", "off", "disable"].includes(input.toLowerCase())) {
				if (qServerDB.config.emojis[current_name] === "none") return string("CFG_EMOJI_DISABLED_ERROR", {}, "error");
				qServerDB.config.emojis[current_name] = "none";
				await dbModify("Server", {id: server.id}, qServerDB);
				return string(disabled_str, {}, "success");
			}
			let emote = await findEmoji(input, server.emojis.cache);
			if (emote[0]) {
				qServerDB.config.emojis[current_name] = emote[0];
				await dbModify("Server", {id: server.id}, qServerDB);
				return string(success_str, { emote: emote[1] }, "success");
			} else return string("CFG_EMOJI_NOT_FOUND_ERROR", {}, "error");
		}

		switch (args[0]) {
		case "admin":
		case "adminrole": {
			switch (args[1]) {
			case "add":
			case "+": {
				let origRole = args.splice(2).join(" ");
				let output = await handleRoleInput("add", origRole, server.roles.cache, "admin_roles", "CFG_ALREADY_ADMIN_ROLE_ERROR", "CFG_ADMIN_ROLE_ADD_SUCCESS");
				if (output === "CONFIRM") {
					if ((
						await confirmation(
							message,
							string("EVERYONE_PERMISSION_WARNING", { check: `<:${emoji.check}>`, x: `<:${emoji.x}>`}),
							{
								deleteAfterReaction: true
							}
						)
					)) return message.channel.send((await handleRoleInput("add", origRole, server.roles.cache, "admin_roles", "CFG_ALREADY_ADMIN_ROLE_ERROR", "CFG_ADMIN_ROLE_ADD_SUCCESS", true)), { disableMentions: "everyone" });
					else return message.channel.send(string("CANCELLED", {}, "error"));
				} else return message.channel.send(output, { disableMentions: "everyone" });
			}
			case "remove":
			case "-":
			case "rm":
			case "delete": {
				return message.channel.send((await handleRoleInput("remove", args.splice(2).join(" "), server.roles.cache, "admin_roles", "CFG_NOT_ADMIN_ROLE_ERROR", "CFG_ADMIN_ROLE_REMOVE_SUCCESS")), { disableMentions: "everyone" });
			}
			case "list": {
				return message.channel.send((await listRoles(qServerDB.config.admin_roles, server, "CFG_ADMIN_ROLES_TITLE", true))[0]);
			}
			default: {
				if (args[1]) return message.channel.send(string("CFG_INVALID_ROLE_PARAM_ERROR"));
				else return message.channel.send((await listRoles(qServerDB.config.admin_roles, server, "CFG_ADMIN_ROLES_TITLE", true))[0]);
			}
			}
		}
		case "staff":
		case "staffrole":
		case "reviewrole": {
			switch (args[1]) {
			case "add":
			case "+": {
				let origRole = args.splice(2).join(" ");
				let output = await handleRoleInput("add", origRole, server.roles.cache, "staff_roles", "CFG_ALREADY_STAFF_ROLE_ERROR", "CFG_STAFF_ROLE_ADD_SUCCESS");
				if (output === "CONFIRM") {
					if ((
						await confirmation(
							message,
							string("EVERYONE_PERMISSION_WARNING", { check: `<:${emoji.check}>`, x: `<:${emoji.x}>`}),
							{
								deleteAfterReaction: true
							}
						)
					)) return message.channel.send((await handleRoleInput("add", origRole, server.roles.cache, "staff_roles", "CFG_ALREADY_STAFF_ROLE_ERROR", "CFG_STAFF_ROLE_ADD_SUCCESS", true)), { disableMentions: "everyone" });
					else return message.channel.send(string("CANCELLED", {}, "error"));
				} else return message.channel.send(output, { disableMentions: "everyone" });
			}
			case "remove":
			case "-":
			case "rm":
			case "delete": {
				return message.channel.send((await handleRoleInput("remove", args.splice(2).join(" "), server.roles.cache, "staff_roles", "CFG_NOT_STAFF_ROLE_ERROR", "CFG_STAFF_ROLE_REMOVE_SUCCESS")), { disableMentions: "everyone" });
			}
			case "list": {
				return message.channel.send((await listRoles(qServerDB.config.staff_roles, server, "CFG_STAFF_ROLES_TITLE", true))[0]);
			}
			default: {
				if (args[1]) return message.channel.send(string("CFG_INVALID_ROLE_PARAM_ERROR"));
				else return message.channel.send((await listRoles(qServerDB.config.staff_roles, server, "CFG_STAFF_ROLES_TITLE", true))[0]);
			}
			}
		}
		case "allowed":
		case "allowedrole":
		case "suggestrole": {
			switch (args[1]) {
			case "add":
			case "+": {
				return message.channel.send((await handleRoleInput("add", args.splice(2).join(" "), server.roles.cache, "allowed_roles", "CFG_ALREADY_ALLOWED_ROLE_ERROR", "CFG_ALLOWED_ROLE_ADD_SUCCESS")), { disableMentions: "everyone" });
			}
			case "remove":
			case "-":
			case "rm":
			case "delete": {
				return message.channel.send((await handleRoleInput("remove", args.splice(2).join(" "), server.roles.cache, "allowed_roles", "CFG_NOT_ALLOWED_ROLE_ERROR", "CFG_ALLOWED_ROLE_REMOVE_SUCCESS")), { disableMentions: "everyone" });
			}
			case "list": {
				return message.channel.send((await listRoles(qServerDB.config.allowed_roles, server, "CFG_ALLOWED_ROLES_TITLE", true))[0]);
			}
			default: {
				if (args[1]) return message.channel.send(string("CFG_INVALID_ROLE_PARAM_ERROR"));
				else return message.channel.send((await listRoles(qServerDB.config.allowed_roles, server, "CFG_ALLOWED_ROLES_TITLE", true))[0]);
			}
			}
		}
		case "blocked":
		case "blockedroles":
		case "blacklist":
		case "blacklistroles":
		case "blockedrole": {
			switch (args[1]) {
			case "add":
			case "+": {
				return message.channel.send((await handleRoleInput("add", args.splice(2).join(" "), server.roles.cache, "blocked_roles", "CFG_ALREADY_BLOCKED_ROLE_ERROR", "CFG_BLOCKED_ROLE_ADD_SUCCESS")), { disableMentions: "everyone" });
			}
			case "remove":
			case "-":
			case "rm":
			case "delete": {
				return message.channel.send((await handleRoleInput("remove", args.splice(2).join(" "), server.roles.cache, "blocked_roles", "CFG_NOT_BLOCKED_ROLE_ERROR", "CFG_BLOCK_ROLE_REMOVE_SUCCESS")), { disableMentions: "everyone" });
			}
			case "list": {
				return message.channel.send((await listRoles(qServerDB.config.blocked_roles, server, "CFG_BLOCKED_ROLES_TITLE", false))[0]);
			}
			default: {
				if (args[1]) return message.channel.send(string("CFG_INVALID_ROLE_PARAM_ERROR"));
				else return message.channel.send((await listRoles(qServerDB.config.blocked_roles, server, "CFG_BLOCKED_ROLES_TITLE", false))[0]);
			}
			}
		}
		case "approvedrole":
		case "approverole": {
			if (!args[1]) return message.channel.send((await listRoles(qServerDB.config.approved_role, server, "CFG_APPROVED_ROLE_TITLE", false)));
			let input = args.splice(1).join(" ");
			if (input.toLowerCase() === "none" || input.toLowerCase() === "reset") {
				qServerDB.config.approved_role = "";
				await dbModify("Server", {id: server.id}, qServerDB);
				return message.channel.send(string("CFG_RESET_APPROVED_ROLE_SUCCESS", {}, "success"));
			}
			if (!server.me.permissions.has("MANAGE_ROLES")) return message.channel.send(string("CFG_NO_MANAGE_ROLES_ERROR", { bot: `<@${client.user.id}>` }, "error"));
			let role = await findRole(input, server.roles.cache);
			if (!role) return message.channel.send(string("CFG_INVALID_ROLE_ERROR", {}, "error"));
			if (qServerDB.config.approved_role === role.id) return message.channel.send(string("CFG_ALREADY_APPROVED_ROLE_ERROR", {}, "error"));
			if (!role.editable || role.managed) return message.channel.send(string("CFG_UNMANAGEABLE_ROLE_ERROR", { role: role.name }, "error"), {disableMentions: "everyone"});
			qServerDB.config.approved_role = role.id;
			await dbModify("Server", {id: server.id}, qServerDB);
			return message.channel.send(string("CFG_APPROVED_ROLE_SUCCESS", { role: role.name }, "success"), {disableMentions: "everyone"});
		}
		case "pingrole":
		case "ping": {
			if (!args[1]) return message.channel.send((await listRoles(qServerDB.config.ping_role, server, "CFG_PING_ROLE_TITLE", false)));
			let input = args.splice(1).join(" ");
			if (input.toLowerCase() === "none" || input.toLowerCase() === "reset") {
				qServerDB.config.ping_role = "";
				await dbModify("Server", {id: server.id}, qServerDB);
				return message.channel.send(string("CFG_RESET_PING_ROLE_SUCCESS", {}, "success"));
			}
			if (!server.me.permissions.has("MENTION_EVERYONE")) return message.channel.send(string("CFG_NO_MENTION_EVERYONE_ERROR", { bot: `<@${client.user.id}>` }, "error"));
			let role = await findRole(input, server.roles.cache);
			if (!role) return message.channel.send(string("CFG_INVALID_ROLE_ERROR", {}, "error"));
			if (qServerDB.config.ping_role === role.id) return message.channel.send(string("CFG_ALREADY_PING_ROLE_ERROR", {}, "error"));
			qServerDB.config.ping_role = role.id;
			await dbModify("Server", {id: server.id}, qServerDB);
			return message.channel.send(string("CFG_PING_ROLE_SUCCESS", { role: role.name }, "success"), {disableMentions: "everyone"});
		}
		case "review":
		case "reviewchannel": {
			if (!args[1]) return message.channel.send((await showChannel(qServerDB.config.channels.staff, server, "CFG_REVIEW_CHANNEL_TITLE", qServerDB.config.mode === "review", qServerDB.config.mode === "autoapprove" ? string("CFG_REVIEW_NOT_NECESSARY_APPEND") : ""))[0]);
			return message.channel.send((await handleChannelInput(args.splice(1).join(" ").toLowerCase(), server, "staff", "staff", "CFG_REVIEW_SET_SUCCESS")));
		}
		case "suggestions":
		case "suggestionschannel": {
			if (!args[1]) return message.channel.send((await showChannel(qServerDB.config.channels.suggestions, server, "CFG_SUGGESTION_CHANNEL_TITLE", true))[0]);
			return message.channel.send((await handleChannelInput(args.splice(1).join(" ").toLowerCase(), server, "suggestions", "suggestions", "CFG_SUGGESTIONS_SET_SUCCESS")));
		}
		case "denied":
		case "deniedchannel": {
			if (!args[1]) return message.channel.send((await showChannel(qServerDB.config.channels.denied, server, "CFG_DENIED_CHANNEL_TITLE", false))[0]);
			return message.channel.send((await handleChannelInput(args.splice(1).join(" ").toLowerCase(), server, "denied", "denied", "CFG_DENIED_SET_SUCCESS", "CFG_DENIED_RESET_SUCCESS")));
		}
		case "log":
		case "logs":
		case "logchannel": {
			if (!args[1]) return message.channel.send((await showChannel(qServerDB.config.channels.log, server, "CFG_LOG_CHANNEL_TITLE", false))[0]);
			return message.channel.send((await handleChannelInput(args.splice(1).join(" ").toLowerCase(), server, "log", "log", "CFG_LOG_SET_SUCCESS", "CFG_LOG_RESET_SUCCESS")));
		}
		case "commands":
		case "command":
		case "commandchannel":
		case "commandschannel": {
			if (!args[1]) return message.channel.send((await showChannel(qServerDB.config.channels.commands, server, "CFG_COMMANDS_CHANNEL_TITLE", false, string("CFG_COMMANDS_CHANNEL_APPEND")))[0]);
			return message.channel.send((await handleChannelInput(args.splice(1).join(" ").toLowerCase(), server, "commands", "commands", "CFG_COMMANDS_SET_SUCCESS", "CFG_COMMANDS_RESET_SUCCESS")));
		}
		case "archive":
		case "archivechannel":
		case "implementedchannel":
		case "implemented": {
			if (!args[1]) return message.channel.send((await showChannel(qServerDB.config.channels.archive, server, "CFG_ARCHIVE_CHANNEL_TITLE", false))[0]);
			return message.channel.send((await handleChannelInput(args.splice(1).join(" ").toLowerCase(), server, "archive", "denied", "CFG_ARCHIVE_SET_SUCCESS", "CFG_ARCHIVE_RESET_SUCCESS")));
		}
		case "prefix": {
			if (!args[1]) return message.channel.send(`${string("CFG_PREFIX_TITLE", {}, "success")} ${Discord.escapeMarkdown(qServerDB.config.prefix)}`);
			let prefix = args[1];
			if (prefix.length > 20) return message.channel.send(string("CFG_PREFIX_TOO_LONG_ERROR", {}, "error"));
			let disallowed = ["suggester:", `${client.user.id}:`];
			if (disallowed.includes(prefix.toLowerCase())) return message.channel.send(string("CFG_PREFIX_DISALLOWED_ERROR", {}, "error"));
			qServerDB.config.prefix = prefix.toLowerCase();
			await dbModify("Server", {id: server.id}, qServerDB);
			return message.channel.send(string("CFG_PREFIX_SET_SUCCESS", { prefix: Discord.escapeMarkdown(prefix.toLowerCase()) }, "success"));
		}
		case "mode": {
			if (!args[1]) return message.channel.send(`${string("CFG_MODE_TITLE", {}, "success")} ${qServerDB.config.mode}`);
			switch (args[1].toLowerCase()) {
			case "review":
				qServerDB.config.mode = "review";
				await dbModify("Server", {id: server.id}, qServerDB);
				return message.channel.send(string("CFG_MODE_REVIEW_SET_SUCCESS", {}, "success"));
			case "autoapprove":
			case "auto-approve":
			case "auto_approve":
			case "auto": {
				if ((await dbQueryNoNew("Suggestion", {status: "awaiting_review", id: server.id}))) return message.channel.send(string("CFG_SUGGESTIONS_AWAITING_REVIEW_ERROR", {}, "error"));
				qServerDB.config.mode = "autoapprove";
				await dbModify("Server", {id: server.id}, qServerDB);
				return message.channel.send(string("CFG_MODE_AUTOAPPROVE_SET_SUCCESS", {}, ""));
			}
			default:
				return message.channel.send(string("CFG_MODE_INVALID_ERROR", {}, "error"));
			}
		}
		case "emoji":
		case "emotes":
		case "emojis":
		case "emote":
		case "react":
		case "reactions": {
			if (!args[1]) {
				let reactEmbed = new Discord.MessageEmbed()
					.setDescription(string(qServerDB.config.react ? "CFG_FEED_REACTIONS_ENABLED" : "CFG_FEED_REACTIONS_DISABLED"))
					.addField(string("CFG_EMOJI_UPVOTE_TITLE"), (await findEmoji(checkEmoji(qServerDB.config.emojis.up), server.emojis.cache))[1] || (qServerDB.config.emojis.up === "none" ? string("DISABLED") : "👍"))
					.addField(string("CFG_EMOJI_MID_TITLE"), (await findEmoji(checkEmoji(qServerDB.config.emojis.mid), server.emojis.cache))[1] || (qServerDB.config.emojis.mid === "none" ? string("DISABLED") : "🤷"))
					.addField(string("CFG_EMOJI_DOWNVOTE_TITLE"), (await findEmoji(checkEmoji(qServerDB.config.emojis.down), server.emojis.cache))[1] || (qServerDB.config.emojis.down === "none" ? string("DISABLED") : "👎"))
					.setColor(qServerDB.config.react ? colors.default : colors.orange);
				return message.channel.send(reactEmbed);
			}

			switch (args[1].toLowerCase()) {
			case "up":
			case "upvote":
			case "yes": {
				return message.channel.send((await handleEmojiInput(args[2], server, "up", "CFG_EMOJI_UP_DISABLE_SUCCESS", "CFG_EMOJI_UP_SET_SUCCESS")));
			}
			case "shrug":
			case "neutral":
			case "middle":
			case "mid": {
				return message.channel.send((await handleEmojiInput(args[2], server, "mid", "CFG_EMOJI_MID_DISABLE_SUCCESS", "CFG_EMOJI_MID_SET_SUCCESS")));
			}
			case "down":
			case "downvote":
			case "no": {
				return message.channel.send((await handleEmojiInput(args[2], server, "down", "CFG_EMOJI_DOWN_DISABLE_SUCCESS", "CFG_EMOJI_DOWN_SET_SUCCESS")));
			}
			case "enable":
			case "on": {
				if (!qServerDB.config.react) {
					qServerDB.config.react = true;
					await dbModify("Server", {id: server.id}, qServerDB);
					return message.channel.send(string("CFG_FEED_REACTIONS_ENABLED", {}, "success"));
				} else return message.channel.send(string("CFG_FEED_REACTIONS_ALREADY_ENABLED", {}, "error"));
			}
			case "disable":
			case "off": {
				if (qServerDB.config.react) {
					qServerDB.config.react = false;
					await dbModify("Server", {id: server.id}, qServerDB);
					return message.channel.send(string("CFG_FEED_REACTIONS_DISABLED", {}, "success"));
				} else return message.channel.send(string("CFG_FEED_REACTIONS_ALREADY_DISABLED", {}, "error"));
			}
			case "toggle":
				qServerDB.config.react = !qServerDB.config.react;
				await dbModify("Server", {id: server.id}, qServerDB);
				return message.channel.send(string(qServerDB.config.react ? "CFG_FEED_REACTIONS_ENABLED" : "CFG_FEED_REACTIONS_DISABLED", {}, "success"));
			default:
				return message.channel.send(string("CFG_EMOJI_INVALID_SETTING_ERROR", {}, "error"));
			}
		}
		case "notify":
		case "notifications":
		case "notification":
		case "notif": {
			if (!args[1]) return message.channel.send(string(qServerDB.config.notify ? "GUILD_NOTIFICATIONS_ENABLED" : "GUILD_NOTIFICATIONS_DISABLED"));
			switch (args[1].toLowerCase()) {
			case "enable":
			case "on": {
				if (!qServerDB.config.notify) {
					qServerDB.config.notify = true;
					await dbModify("Server", {id: server.id}, qServerDB);
					return message.channel.send(string("GUILD_NOTIFICATIONS_ENABLED", {}, "success"));
				} else return message.channel.send(string("GUILD_NOTIFICATIONS_ALREADY_ENABLED", {}, "error"));
			}
			case "disable":
			case "off": {
				if (qServerDB.config.notify) {
					qServerDB.config.notify = false;
					await dbModify("Server", {id: server.id}, qServerDB);
					return message.channel.send(string("GUILD_NOTIFICATIONS_DISABLED", {}, "success"));
				} else return message.channel.send(string("GUILD_NOTIFICATIONS_ALREADY_DISABLED", {}, "error"));
			}
			case "toggle":
				qServerDB.config.notify = !qServerDB.config.notify;
				await dbModify("Server", {id: server.id}, qServerDB);
				return message.channel.send(string(qServerDB.config.notify ? "GUILD_NOTIFICATIONS_ENABLED" : "GUILD_NOTIFICATIONS_DISABLED", {}, "success"));
			default:
				return message.channel.send(string("ON_OFF_TOGGLE_ERROR", {}, "error"));
			}
		}
		case "clear":
		case "clean":
		case "cleancommands":
		case "cleancommand": {
			if (!args[1]) return message.channel.send(string(qServerDB.config.clean_suggestion_command ? "CFG_CLEAN_COMMANDS_ENABLED" : "CFG_CLEAN_COMMANDS_DISABLED"));
			switch (args[1].toLowerCase()) {
			case "enable":
			case "on": {
				if (!qServerDB.config.clean_suggestion_command) {
					if (!server.me.permissions.has("MANAGE_MESSAGES")) return message.channel.send(string("CFG_CLEAN_COMMANDS_NO_MANAGE_MESSAGES", {}, "error"));
					qServerDB.config.clean_suggestion_command = true;
					await dbModify("Server", {id: server.id}, qServerDB);
					return message.channel.send(string("CFG_CLEAN_COMMANDS_ENABLED", {}, "success"));
				} else return message.channel.send(string("CFG_CLEAN_COMMANDS_ALREADY_ENABLED", {}, "error"));
			}
			case "disable":
			case "off": {
				if (qServerDB.config.clean_suggestion_command) {
					qServerDB.config.clean_suggestion_command = false;
					await dbModify("Server", {id: server.id}, qServerDB);
					return message.channel.send(string("CFG_CLEAN_COMMANDS_DISABLED", {}, "success"));
				} else return message.channel.send(string("CFG_CLEAN_COMMANDS_ALREADY_DISABLED", {}, "error"));
			}
			case "toggle":
				if (!qServerDB.config.clean_suggestion_command && !server.me.permissions.has("MANAGE_MESSAGES")) return message.channel.send(string("CFG_CLEAN_COMMANDS_NO_MANAGE_MESSAGES", {}, "error"));
				qServerDB.config.clean_suggestion_command = !qServerDB.config.clean_suggestion_command;
				await dbModify("Server", {id: server.id}, qServerDB);
				return message.channel.send(string(qServerDB.config.clean_suggestion_command ? "CFG_CLEAN_COMMANDS_ENABLED" : "CFG_CLEAN_COMMANDS_DISABLED", {}, "success"));
			default:
				return message.channel.send(string("ON_OFF_TOGGLE_ERROR", {}, "error"));
			}
		}
		case "list": {
			let cfgRolesArr = [];
			let cfgChannelsArr = [];
			let cfgOtherArr = [];
			let issuesCountFatal = 0;

			// Admin roles
			let adminRoles = await listRoles(qServerDB.config.admin_roles, server, "CFG_ADMIN_ROLES_TITLE", true);
			if (adminRoles[1]) issuesCountFatal++;
			cfgRolesArr.push(adminRoles[0]);
			// Staff roles
			let staffRoles = await listRoles(qServerDB.config.staff_roles, server, "CFG_STAFF_ROLES_TITLE", true);
			if (staffRoles[1]) issuesCountFatal++;
			cfgRolesArr.push(staffRoles[0]);
			// Allowed roles
			cfgRolesArr.push((await listRoles(qServerDB.config.allowed_roles, server, "CFG_ALLOWED_ROLES_TITLE", false, string("CFG_ALLOWED_ROLES_APPEND")))[0]);
			// Blocked roles
			cfgRolesArr.push((await listRoles(qServerDB.config.blocked_roles, server, "CFG_BLOCKED_ROLES_TITLE", false))[0]);
			// Approved suggestion role
			cfgRolesArr.push((await listRoles(qServerDB.config.approved_role, server, "CFG_APPROVED_ROLE_TITLE", false)));
			// Submitted suggestion mention role
			cfgRolesArr.push((await listRoles(qServerDB.config.ping_role, server, "CFG_PING_ROLE_TITLE", false)));
			// Suggestions channel
			let suggestionChannel = await showChannel(qServerDB.config.channels.suggestions, server, "CFG_SUGGESTION_CHANNEL_TITLE", true);
			if (suggestionChannel[1]) {
				issuesCountFatal++;
				qServerDB.config.channels.suggestions = "";
				await dbModify("Server", {id: server.id}, qServerDB);
			}
			cfgChannelsArr.push(suggestionChannel[0]);
			// Staff review channel
			let reviewChannel = await showChannel(qServerDB.config.channels.staff, server, "CFG_REVIEW_CHANNEL_TITLE", qServerDB.config.mode === "review", qServerDB.config.mode === "autoapprove" ? string("CFG_REVIEW_NOT_NECESSARY_APPEND") : "");
			if (reviewChannel[1]) {
				if (qServerDB.config.mode === "review") issuesCountFatal++;
				qServerDB.config.channels.staff = "";
				await dbModify("Server", {id: server.id}, qServerDB);
			}
			cfgChannelsArr.push(reviewChannel[0]);
			// Denied channel
			let deniedChannel = await showChannel(qServerDB.config.channels.denied, server, "CFG_DENIED_CHANNEL_TITLE", false);
			if (deniedChannel[1]) {
				qServerDB.config.channels.denied = "";
				await dbModify("Server", {id: server.id}, qServerDB);
			}
			cfgChannelsArr.push(deniedChannel[0]);
			// Log channel
			let logChannel = await showChannel(qServerDB.config.channels.log, server, "CFG_LOG_CHANNEL_TITLE", false);
			if (logChannel[1]) {
				qServerDB.config.channels.log = "";
				await dbModify("Server", {id: server.id}, qServerDB);
			}
			cfgChannelsArr.push(logChannel[0]);
			// Archive channel
			let archiveChannel = await showChannel(qServerDB.config.channels.archive, server, "CFG_ARCHIVE_CHANNEL_TITLE", false);
			if (archiveChannel[1]) {
				qServerDB.config.channels.archive = "";
				await dbModify("Server", {id: server.id}, qServerDB);
			}
			cfgChannelsArr.push(archiveChannel[0]);
			// Commands channel
			let commandsChannel = await showChannel(qServerDB.config.channels.commands, server, "CFG_COMMANDS_CHANNEL_TITLE", false, string("CFG_COMMANDS_CHANNEL_APPEND"));
			if (commandsChannel[1]) {
				qServerDB.config.channels.commands = "";
				await dbModify("Server", {id: server.id}, qServerDB);
			}
			cfgChannelsArr.push(commandsChannel[0]);
			// Emojis
			let upEmoji = (await findEmoji(checkEmoji(qServerDB.config.emojis.up), server.emojis.cache))[1] || (qServerDB.config.emojis.up === "none" ? string("CFG_UPVOTE_REACTION_DISABLED") : "👍");
			let midEmoji = (await findEmoji(checkEmoji(qServerDB.config.emojis.mid), server.emojis.cache))[1] || (qServerDB.config.emojis.mid === "none" ? string("CFG_MID_REACTION_DISABLED") : "🤷");
			let downEmoji = (await findEmoji(checkEmoji(qServerDB.config.emojis.down), server.emojis.cache))[1] || (qServerDB.config.emojis.down === "none" ? string("CFG_DOWNVOTE_REACTION_DISABLED") : "👎");

			cfgOtherArr.push(`${string("CFG_REACTION_EMOJIS_TITLE", {}, "success")} ${qServerDB.config.react ? string("ENABLED") : string("DISABLED")} (${upEmoji}, ${midEmoji}, ${downEmoji})`);
			// Mode
			let mode = string("ERROR", {}, "error");
			switch (qServerDB.config.mode) {
			case "review":
				mode = string("CFG_MODE_REVIEW");
				break;
			case "autoapprove":
				mode = string("CFG_MODE_AUTOAPPROVE");
				break;
			}
			cfgOtherArr.push(`${string("CFG_MODE_TITLE", {}, "success")} ${mode}`);
			// Prefix
			cfgOtherArr.push(`${string("CFG_PREFIX_TITLE", {}, "success")} ${Discord.escapeMarkdown(qServerDB.config.prefix)}`);
			// Notify
			cfgOtherArr.push(`${string("CFG_NOTIFICATIONS_TITLE", {}, "success")} ${string(qServerDB.config.notify ? "ENABLED" : "DISABLED")}`);
			//Clean Suggestion Command
			cfgOtherArr.push(`${string("CFG_CLEAN_COMMANDS_TITLE", {}, "success")} ${string(qServerDB.config.clean_suggestion_command ? "ENABLED" : "DISABLED")}`);

			let cfgEmbed = new Discord.MessageEmbed()
				.setAuthor(string("SERVER_CONFIGURATION_TITLE", { server: server.name }), server.iconURL({ dynamic: true, format: "png" }))
				.addField(string("ROLE_CONFIGURATION_TITLE"), cfgRolesArr.join("\n"))
				.addField(string("CHANNEL_CONFIGURATION_TITLE"), cfgChannelsArr.join("\n"))
				.addField(string("OTHER_CONFIGURATION_TITLE"), cfgOtherArr.join("\n"));
			cfgEmbed.setColor(issuesCountFatal > 0 ? colors.red : colors.green)
				.addField(string("CFG_STATUS_TITLE"), issuesCountFatal > 0 ? string("CFG_STATUS_BAD", {}, "error") : string("CFG_STATUS_GOOD", {}, "success"));

			if (args[args.length-1].toLowerCase() === "--flags" && permission <= 1) {
				const permissions = require("../../utils/permissions");
				let hasPermissionList = [];
				Object.keys(permissions).forEach(perm => {
					server.me.permissions.has(perm) ? hasPermissionList.push(string(`PERMISSION:${perm}`)) : "";
				});

				cfgEmbed.addField(string("CFG_PERMISSIONS_TITLE"), hasPermissionList.length > 0 ? hasPermissionList.join(", ") : "None");
				if (qServerDB.flags && qServerDB.flags.length > 0) cfgEmbed.addField(string("CFG_FLAGS_TITLE"), qServerDB.flags.join(", "));
			}
			return message.channel.send(cfgEmbed);
		}
		default:
			return message.channel.send(string("CFG_NO_PARAMS_ERROR", {}, "error"));
		}

	}
};
