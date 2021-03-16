import { MonksTokenBar, log, i18n, setting, MTB_MOVEMENT_TYPE } from "./monks-tokenbar.js";

export class MonksTokenBarAPI {
    static init() {
        game.MonksTokenBar = MonksTokenBarAPI;
    }

    static changeMovement(movement, tokens) {
        if (!game.user.isGM)
            return;
        if (!MonksTokenBar.isMovement(movement))
            return;

        if (tokens != undefined) {
            MonksTokenBar.changeTokenMovement(movement, tokens);
        }else
            MonksTokenBar.changeGlobalMovement(movement);
    }
}
