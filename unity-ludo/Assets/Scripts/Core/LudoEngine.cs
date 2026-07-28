using System.Collections.Generic;
using System.Linq;

namespace LudoKing3D
{
    /// <summary>
    /// Pure C# state machine that implements the full Ludo game logic.
    /// Fully self-contained and testable.
    /// </summary>
    public static class LudoEngine
    {
        /// <summary>
        /// Creates the initial game state.
        /// </summary>
        public static LudoGameState CreateGame(PlayerState[] players, LudoRules rules = null)
        {
            var gameState = new LudoGameState
            {
                players = players,
                rules = rules ?? new LudoRules(),
                activePlayerIndex = 0,
                phase = GamePhase.Rolling,
                diceValue = 0,
                consecutiveSixes = 0,
                legalTokenIndexes = new List<int>(),
                winnerOrder = new List<PlayerColor>(),
                nextRank = 1,
                revision = 1
            };
            return gameState;
        }

        /// <summary>
        /// Processes a dice roll and updates the state.
        /// </summary>
        public static LudoGameState RollDice(LudoGameState state, int value)
        {
            if (state.phase != GamePhase.Rolling) return state;

            state.diceValue = value;
            state.revision++;

            if (value == 6)
            {
                state.consecutiveSixes++;
                if (state.rules.threeSixesLoseTurn && state.consecutiveSixes == 3)
                {
                    state.consecutiveSixes = 0;
                    return AdvanceTurn(state);
                }
            }
            else
            {
                state.consecutiveSixes = 0;
            }

            state.legalTokenIndexes = GetLegalTokenIndexes(state);

            if (state.legalTokenIndexes.Count == 0)
            {
                return AdvanceTurn(state);
            }

            state.phase = GamePhase.Moving;
            return state;
        }

        /// <summary>
        /// Returns a list of token indexes that can legally move with the current dice value.
        /// </summary>
        public static List<int> GetLegalTokenIndexes(LudoGameState state)
        {
            var legal = new List<int>();
            var player = state.ActivePlayer;
            var color = player.color;

            for (int i = 0; i < LudoConstants.TOKENS_PER_PLAYER; i++)
            {
                var token = player.tokens[i];
                if (token.position == LudoConstants.FINISH_POSITION) continue;

                int dest = GetDestination(token.position, state.diceValue, state.rules.requireSixToLeaveHome);
                if (dest < 0) continue; // Invalid destination (e.g. requires 6 to leave home or moves past finish)

                if (state.rules.blockadesEnabled)
                {
                    if (WouldCrossBlockade(state, color, token.position, dest)) continue;
                    if (IsBlockedLanding(state, color, dest)) continue;
                }

                legal.Add(i);
            }

            return legal;
        }

        /// <summary>
        /// Executes a move for the specified token and updates the game state.
        /// </summary>
        public static MoveResult MoveToken(LudoGameState state, int tokenIndex)
        {
            var player = state.ActivePlayer;
            var color = player.color;
            int fromPos = player.tokens[tokenIndex].position;
            int destPos = GetDestination(fromPos, state.diceValue, state.rules.requireSixToLeaveHome);

            // Determine captures before moving the token
            var captures = GetCaptures(state, color, destPos);
            foreach (var cap in captures)
            {
                var opponent = state.players.First(p => p.color == cap.color);
                opponent.tokens[cap.tokenIndex].position = LudoConstants.HOME_POSITION;
            }

            // Move token
            player.tokens[tokenIndex].position = destPos;

            bool leftHome = (fromPos == LudoConstants.HOME_POSITION && destPos == 0);
            bool reachedFinish = (destPos == LudoConstants.FINISH_POSITION);

            if (reachedFinish && player.IsFinished())
            {
                if (state.rules.rankedFinish)
                {
                    player.rank = state.nextRank++;
                }
                state.winnerOrder.Add(player.color);
            }

            // Determine if an extra turn is granted
            bool extraTurn = (state.diceValue == 6);
            if (captures.Count > 0 && state.rules.captureGrantsExtraTurn) extraTurn = true;
            if (reachedFinish && state.rules.finishGrantsExtraTurn) extraTurn = true;

            var result = new MoveResult
            {
                tokenIndex = tokenIndex,
                fromPosition = fromPos,
                toPosition = destPos,
                diceValue = state.diceValue,
                leftHome = leftHome,
                reachedFinish = reachedFinish,
                extraTurn = extraTurn,
                captures = captures
            };

            state.revision++;
            state.legalTokenIndexes.Clear();

            if (IsGameFinished(state))
            {
                state.phase = GamePhase.Finished;
            }
            else
            {
                if (extraTurn)
                {
                    state.phase = GamePhase.Rolling;
                }
                else
                {
                    AdvanceTurn(state);
                }
            }

            return result;
        }

        /// <summary>
        /// Advances the turn to the next active player, skipping finished players.
        /// </summary>
        public static LudoGameState AdvanceTurn(LudoGameState state)
        {
            state.consecutiveSixes = 0;
            state.phase = GamePhase.Rolling;
            state.activePlayerIndex = FindNextPlayerIndex(state, state.activePlayerIndex);
            state.revision++;
            return state;
        }

        /// <summary>
        /// Forfeits the current player's turn.
        /// </summary>
        public static LudoGameState ForfeitTurn(LudoGameState state)
        {
            return AdvanceTurn(state);
        }

        // --- Helper Methods ---

        private static int GetDestination(int position, int diceValue, bool requireSix)
        {
            if (position == LudoConstants.HOME_POSITION)
            {
                if (requireSix && diceValue != 6) return -2;
                return 0; // Leaves home, lands on relative position 0
            }

            int newPos = position + diceValue;
            if (newPos > LudoConstants.FINISH_POSITION) return -2; // Cannot overshoot the finish line

            return newPos;
        }

        private static List<CaptureInfo> GetCaptures(LudoGameState state, PlayerColor moverColor, int destinationPosition)
        {
            var captures = new List<CaptureInfo>();
            if (destinationPosition < 0 || destinationPosition >= LudoConstants.HOME_LANE_START)
            {
                return captures; // No captures inside home or home lane
            }

            int destRingIndex = LudoUtil.ToRingIndex(moverColor, destinationPosition);
            if (LudoUtil.IsSafeRing(destRingIndex))
            {
                return captures; // Cannot capture on safe squares
            }

            for (int pIndex = 0; pIndex < state.players.Length; pIndex++)
            {
                var p = state.players[pIndex];
                if (p.color == moverColor) continue;

                for (int i = 0; i < LudoConstants.TOKENS_PER_PLAYER; i++)
                {
                    int pos = p.tokens[i].position;
                    if (pos >= 0 && pos < LudoConstants.HOME_LANE_START)
                    {
                        if (LudoUtil.ToRingIndex(p.color, pos) == destRingIndex)
                        {
                            captures.Add(new CaptureInfo
                            {
                                color = p.color,
                                tokenIndex = i,
                                fromRingIndex = destRingIndex
                            });
                        }
                    }
                }
            }

            return captures;
        }

        private static bool IsBlockedLanding(LudoGameState state, PlayerColor color, int position)
        {
            if (position < 0 || position >= LudoConstants.HOME_LANE_START) return false;

            int targetRingIdx = LudoUtil.ToRingIndex(color, position);
            var blockades = GetOpponentBlockadeRingIndexes(state, color);
            return blockades.Contains(targetRingIdx);
        }

        private static bool WouldCrossBlockade(LudoGameState state, PlayerColor color, int from, int to)
        {
            if (from < 0) return false; // Leaving home checks IsBlockedLanding instead

            var blockades = GetOpponentBlockadeRingIndexes(state, color);

            // Check intermediate steps
            for (int p = from + 1; p < to; p++)
            {
                if (p >= LudoConstants.HOME_LANE_START) break; // Home lane has no opponents
                int ringIdx = LudoUtil.ToRingIndex(color, p);
                if (blockades.Contains(ringIdx))
                {
                    return true;
                }
            }
            return false;
        }

        private static HashSet<int> GetOpponentBlockadeRingIndexes(LudoGameState state, PlayerColor playerColor)
        {
            var blockades = new HashSet<int>();

            foreach (var p in state.players)
            {
                if (p.color == playerColor) continue;

                var ringCounts = new Dictionary<int, int>();
                for (int i = 0; i < LudoConstants.TOKENS_PER_PLAYER; i++)
                {
                    int pos = p.tokens[i].position;
                    if (pos >= 0 && pos < LudoConstants.HOME_LANE_START)
                    {
                        int ringIndex = LudoUtil.ToRingIndex(p.color, pos);
                        ringCounts.TryGetValue(ringIndex, out int count);
                        ringCounts[ringIndex] = count + 1;
                    }
                }

                foreach (var kvp in ringCounts)
                {
                    if (kvp.Value >= 2)
                    {
                        blockades.Add(kvp.Key);
                    }
                }
            }

            return blockades;
        }

        private static bool IsGameFinished(LudoGameState state)
        {
            int unfinishedCount = 0;
            foreach (var p in state.players)
            {
                if (!p.IsFinished())
                {
                    unfinishedCount++;
                }
            }
            return unfinishedCount <= 1; // Game over if 1 or 0 players remain unfinished
        }

        private static int FindNextPlayerIndex(LudoGameState state, int currentIndex)
        {
            int next = (currentIndex + 1) % state.players.Length;
            while (next != currentIndex && state.players[next].IsFinished())
            {
                next = (next + 1) % state.players.Length;
            }
            return next;
        }
    }
}
