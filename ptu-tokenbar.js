import { registerSettings } from "./settings.js";
import { TokenBar } from "./apps/tokenbar.js";
import { PTUTokenBarAPI } from "./ptu-tokenbar-api.js";

export let debug = (...args) => {
    if (debugEnabled > 1) console.log("DEBUG: ptu-tokenbar | ", ...args);
};
export let log = (...args) => console.log("ptu-tokenbar | ", ...args);
export let warn = (...args) => {
    if (debugEnabled > 0) console.warn("ptu-tokenbar | ", ...args);
};
export let error = (...args) => console.error("ptu-tokenbar | ", ...args);
export let i18n = key => {
    return game.i18n.localize(key);
};
export let setting = key => {
    return game.settings.get("ptu-tokenbar", key);
};

export const MTB_MOVEMENT_TYPE = {
    FREE: 'free',
    NONE: 'none',
    COMBAT: 'combat'
}

export class PTUTokenBar {
    static tracker = false;
    static tokenbar = null;

    static init() {
	    log("initializing");
        // element statics
        //CONFIG.debug.hooks = true;

        PTUTokenBar.SOCKET = "module.ptu-tokenbar";

        registerSettings();

        let oldTokenCanDrag = Token.prototype._canDrag;
        Token.prototype._canDrag = function (user, event) {
            return (PTUTokenBar.allowMovement(this, false) ? oldTokenCanDrag.call(this, user, event) : false);
        };
    }

    static ready() {
        game.socket.on(PTUTokenBar.SOCKET, PTUTokenBar.onMessage);

        // console.dir(game.system.id) ptu

        PTUTokenBar.requestoptions = [];
        if (["dnd5e"].includes(game.system.id)) {
            PTUTokenBar.requestoptions.push({ id: "init", text: i18n("PTUTokenBar.Initiative") });
            PTUTokenBar.requestoptions.push({ id: "death", text: i18n("PTUTokenBar.DeathSavingThrow") });
        }
        if (["pf2e"].includes(game.system.id)) {
            PTUTokenBar.requestoptions.push({ id: "attribute", text: "Attributes", groups: { "perception": CONFIG.PF2E.attributes.perception } });
        }
        let config;
		switch (game.system.id) {
			case "tormenta20":
				config = CONFIG.T20;
				break;
			default:
				config = CONFIG[game.system.id.toUpperCase()];
		}
		if(config){
			//Ability rolls
			if (config.abilities != undefined) {
				PTUTokenBar.requestoptions.push({ id: "ability", text: i18n("PTUTokenBar.Ability"), groups: config.abilities });
			}
			else if (config.atributos != undefined) {
				PTUTokenBar.requestoptions.push({ id: "ability", text: i18n("PTUTokenBar.Ability"), groups: config.atributos });
			}
			else if (config.scores != undefined) {
				PTUTokenBar.requestoptions.push({ id: "scores", text: i18n("PTUTokenBar.Ability"), groups: config.scores });
			}
			//Saving Throw
			if (config.saves != undefined) {
				PTUTokenBar.requestoptions.push({ id: "save", text: i18n("PTUTokenBar.SavingThrow"), groups: config.saves });
			}
			else if (config.savingThrows != undefined) {
				PTUTokenBar.requestoptions.push({ id: "save", text: i18n("PTUTokenBar.SavingThrow"), groups: config.savingThrows });
			}
			else if (config.resistencias != undefined) {
				PTUTokenBar.requestoptions.push({ id: "save", text: i18n("PTUTokenBar.SavingThrow"), groups: config.resistencias });
			}
			else if (config.saves_long != undefined) {
				PTUTokenBar.requestoptions.push({ id: "save", text: i18n("PTUTokenBar.SavingThrow"), groups: config.saves_long });
			}
			else if (["dnd5e"].includes(game.system.id)) {
				PTUTokenBar.requestoptions.push({ id: "save", text: i18n("PTUTokenBar.SavingThrow"), groups: config.abilities });
			}

			//Skills
			if (config.skills != undefined) {
				PTUTokenBar.requestoptions.push({ id: "skill", text: i18n("PTUTokenBar.Skill"), groups: config.skills });
			}
			else if (config.pericias != undefined) {
				PTUTokenBar.requestoptions.push({ id: "skill", text: i18n("PTUTokenBar.Skill"), groups: config.pericias });
			}
		}
        PTUTokenBar.requestoptions.push({
            id: "dice", text: "Dice", groups: { "1d2": "1d2", "1d4": "1d4", "1d6": "1d6", "1d8": "1d8", "1d10": "1d10", "1d12": "1d12", "1d20": "1d20", "1d100": "1d100" }
        });

        if ((game.user.isGM || setting("allow-player")) && !setting("disable-tokenbar")) {
            PTUTokenBar.tokenbar = new TokenBar();
            PTUTokenBar.tokenbar.refresh();
        }
    }

    static onMessage(data) {
        switch (data.msgtype) {
            case 'rollability': {
                if (game.user.isGM) {
                    let message = game.messages.get(data.msgid);
                    const revealDice = game.dice3d ? game.settings.get("dice-so-nice", "immediatelyDisplayChatMessages") : true;
                    for (let response of data.response) {
                        let r = Roll.fromData(response.roll);
                        response.roll = r;
                    }
                }
            } break;
            case 'finishroll': {
                if (game.user.isGM) {
                    let message = game.messages.get(data.msgid);
                }
            } break;
            case 'movementchange': {
                if (data.tokenid == undefined || canvas.tokens.get(data.tokenid)?.owner) {
                    ui.notifications.warn(data.msg);
                    log('movement change');
                    if (PTUTokenBar.tokenbar != undefined) {
                        PTUTokenBar.tokenbar.render(true);
                    }
                }
            }
        }
    }

    static isMovement(movement) {
        return movement != undefined && MTB_MOVEMENT_TYPE[movement.toUpperCase()] != undefined;
    }

    static getDiceSound(hasMaestroSound = false) {
        const has3DDiceSound = game.dice3d ? game.settings.get("dice-so-nice", "settings").enabled : false;
        const playRollSounds = true; //game.settings.get("betterrolls5e", "playRollSounds")

        if (playRollSounds && !has3DDiceSound && !hasMaestroSound) {
            return CONFIG.sounds.dice;
        }

        return null;
    }

    static async changeGlobalMovement(movement) {
        if (movement == MTB_MOVEMENT_TYPE.COMBAT && (game.combat == undefined || !game.combat.started))
            return;

        log('Changing global movement', movement);
        await game.settings.set("ptu-tokenbar", "movement", movement);
        //clear all the tokens individual movement settings
        if (PTUTokenBar.tokenbar != undefined) {
            let tokenbar = PTUTokenBar.tokenbar;
            for (let i = 0; i < tokenbar.tokens.length; i++) {
                await tokenbar.tokens[i].token.setFlag("ptu-tokenbar", "movement", null);
                tokenbar.tokens[i].token.unsetFlag("ptu-tokenbar", "notified");
            };
            tokenbar.render(true);
        }

        PTUTokenBar.displayNotification(movement);
    }

    static async changeTokenMovement(movement, tokens) {
        if (tokens == undefined)
            return;

        if (!PTUTokenBar.isMovement(movement))
            return;

        tokens = tokens instanceof Array ? tokens : [tokens];

        log('Changing token movement', tokens);

        let newMove = (game.settings.get("ptu-tokenbar", "movement") != movement ? movement : null);
        for (let token of tokens) {
            let oldMove = token.getFlag("ptu-tokenbar", "movement");
            if (newMove != oldMove) {
                await token.setFlag("ptu-tokenbar", "movement", newMove);
                await token.unsetFlag("ptu-tokenbar", "notified");

                let dispMove = token.getFlag("ptu-tokenbar", "movement") || game.settings.get("ptu-tokenbar", "movement") || MTB_MOVEMENT_TYPE.FREE;
                PTUTokenBar.displayNotification(dispMove, token);

                /*if (PTUTokenBar.tokenbar != undefined) {
                    let tkn = PTUTokenBar.tokenbar.tokens.find(t => { return t.id == token.id });
                    if (tkn != undefined)
                        tkn.movement = newMove;
                } */
            }
        }

        //if (PTUTokenBar.tokenbar != undefined)
        //    PTUTokenBar.tokenbar.render(true);
    }

    static displayNotification(movement, token) {
        if (game.settings.get("ptu-tokenbar", "notify-on-change")) {
            let msg = (token != undefined ? token.name + ": " : "") + i18n("PTUTokenBar.MovementChanged") + (movement == MTB_MOVEMENT_TYPE.FREE ? i18n("PTUTokenBar.FreeMovement") : (movement == MTB_MOVEMENT_TYPE.NONE ? i18n("PTUTokenBar.NoMovement") : i18n("PTUTokenBar.CombatTurn")));
            ui.notifications.warn(msg);
            log('display notification');
            game.socket.emit(
                PTUTokenBar.SOCKET,
                {
                    msgtype: 'movementchange',
                    senderId: game.user._id,
                    msg: msg,
                    tokenid: token?.id
                },
                (resp) => { }
            );
        }
    }

    static allowMovement(token, notify = true) {
        let blockCombat = function (token) {
            //combat movement is only acceptable if the token is the current token.
            //or the previous token
            //let allowPrevMove = game.settings.get("combatdetails", "allow-previous-move");
            let curCombat = game.combats.active;

            if (curCombat && curCombat.started) {
                let entry = curCombat.combatant;
                // prev combatant
                /*
                let prevturn = (curCombat.turn || 0) - 1;
                if (prevturn == -1) prevturn = (curCombat.turns.length - 1);
                let preventry = curCombat.turns[prevturn];

                //find the next one that hasn't been defeated
                while (preventry.defeated && preventry != curCombat.turn) {
                    prevturn--;
                    if (prevturn == -1) prevturn = (curCombat.turns.length - 1);
                    preventry = curCombat.turns[prevturn];
                }*/
                log('Blocking movement', entry.name, token.name, entry, token.id, token);
                return !(entry.tokenId == token.id); // || preventry.tokenId == tokenId);
            }

            return true;
        }

        if (!game.user.isGM && token != undefined) {
            let movement = token.getFlag("ptu-tokenbar", "movement") || game.settings.get("ptu-tokenbar", "movement") || MTB_MOVEMENT_TYPE.FREE;
            if (movement == MTB_MOVEMENT_TYPE.NONE ||
                (movement == MTB_MOVEMENT_TYPE.COMBAT && blockCombat(token))) {
                //prevent the token from moving
                if (notify && (!token.getFlag("ptu-tokenbar", "notified") || false)) {
                    ui.notifications.warn(movement == MTB_MOVEMENT_TYPE.COMBAT ? i18n("PTUTokenBar.CombatTurnMovementLimited") : i18n("PTUTokenBar.NormalMovementLimited"));
                    token.setFlag("ptu-tokenbar", "notified", true);
                    setTimeout(function (token) {
                        log('unsetting notified', token);
                        token.unsetFlag("ptu-tokenbar", "notified");
                    }, 30000, token);
                }
                return false;
            }
        }

        return true;
    }

    static async onDeleteCombat(combat) {
        if (game.user.isGM) {
            if (combat.started == true) {

            }

            if (game.combats.combats.length == 0) {
                //set movement to free movement
                let movement = setting("movement-after-combat");
                if (movement != 'ignore')
                    PTUTokenBar.changeGlobalMovement(movement);
            }
        }
    }
}

Hooks.once('init', async function () {
    log('Initializing Combat Details');
    // Assign custom classes and constants here
    // Register custom module settings
    PTUTokenBar.init();
    PTUTokenBarAPI.init();

    //$('body').on('click', $.proxy(PTUTokenBar.setGrabMessage, PTUTokenBar, null));
});

Hooks.on("deleteCombat", PTUTokenBar.onDeleteCombat);

Hooks.on("updateCombat", function (combat, delta) {
    if (game.user.isGM) {
        if (PTUTokenBar.tokenbar) {
            $(PTUTokenBar.tokenbar.tokens).each(function () {
                this.token.unsetFlag("ptu-tokenbar", "nofified");
            });
        }

        if (delta.round === 1 && combat.turn === 0 && combat.started === true && setting("change-to-combat")) {
            PTUTokenBar.changeGlobalMovement(MTB_MOVEMENT_TYPE.COMBAT);
        }
    }
});

Hooks.on("ready", PTUTokenBar.ready);

Hooks.on('preUpdateToken', (scene, data, update, options, userId) => {
    if ((update.x != undefined || update.y != undefined) && !game.user.isGM) {
        let token = canvas.tokens.get(data._id);
        let allow = PTUTokenBar.allowMovement(token);
        if (!allow) {
            delete update.x;
            delete update.y;
        }
    }
});
