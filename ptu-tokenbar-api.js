import { PTUTokenBar, log, i18n, setting, MTB_MOVEMENT_TYPE } from "./ptu-tokenbar.js";

export class PTUTokenBarAPI {
    static init() {
        game.PTUTokenBar = PTUTokenBarAPI;
    }

    static changeMovement(movement, tokens) {
        if (!game.user.isGM)
            return;
        if (!PTUTokenBar.isMovement(movement))
            return;

        if (tokens != undefined) {
            PTUTokenBar.changeTokenMovement(movement, tokens);
        }else
            PTUTokenBar.changeGlobalMovement(movement);
    }
}
