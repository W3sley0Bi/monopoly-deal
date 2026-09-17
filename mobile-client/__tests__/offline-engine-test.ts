import { describe, expect, it } from '@jest/globals';

import { OfflineGame } from '../src/game/offline/engine';

function makeGame() {
    return new OfflineGame({
        playerId: 'human',
        playerName: 'Ada',
        roomName: "Ada's table",
        bots: 2,
        difficulty: 'normal',
    });
}

describe('offline game engine', () => {
    it('starts a complete private solo game without a server snapshot', () => {
        const game = makeGame();
        const room = game.view();

        expect(room.id).toBe('SOLO');
        expect(room.game.state).toBe('playing');
        expect(room.game.players).toHaveLength(3);
        expect(room.game.players.find((player) => player.id === 'human')?.hand).toBeDefined();
        expect(room.game.players.filter((player) => player.bot).every((player) => player.hand === undefined)).toBe(true);
        expect(room.game.deck_count).toBeLessThan(106);
        expect(room.game.colors).toHaveLength(10);
    });

    it('advances robot turns and accepts a normal human card play', () => {
        let game = makeGame();
        for (let i = 0; i < 30 && game.view().game.players[game.view().game.current_turn].id !== 'human'; i++) {
            game = makeGame();
        }

        const before = game.view();
        expect(before.game.players[before.game.current_turn].id).toBe('human');
        const me = before.game.players.find((player) => player.id === 'human')!;
        const card = me.hand![0];

        if (card.type === 'property' || card.type === 'property_wildcard') {
            const color = card.colors?.includes('all') ? 'brown' : card.colors![0];
            game.dispatch({ type: 'play_property', card_id: card.id, color });
        } else {
            game.dispatch({ type: 'play_bank', card_id: card.id });
        }

        const after = game.view();
        expect(after.game.plays_left).toBe(before.game.plays_left - 1);
        expect(after.game.players.find((player) => player.id === 'human')?.hand_count).toBe(me.hand_count - 1);

        let robotGame = makeGame();
        for (let i = 0; i < 30 && !robotGame.isBotWaiting(); i++) robotGame = makeGame();
        const robotBefore = JSON.stringify(robotGame.view().game);
        robotGame.stepBot();
        expect(JSON.stringify(robotGame.view().game)).not.toBe(robotBefore);
    });
});
